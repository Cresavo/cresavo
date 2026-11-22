import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import type { OutboxEntry } from "@/concept/connections/simulated/outbox";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { Customer, DemoState, Service, StaffId } from "@/concept/data/types";
import { bookableServices } from "@/concept/selectors";
import { drainPendingEffects, type EffectDelivery, type EffectSink, type EffectSinks, type TenantKind } from "@/concept/store/effect-outbox";
import { EFFECT_LEASE_MS, LOCK_TIMEOUT_MS, PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { withOwnSlug } from "./own-slug";

// Step 2 items 4, 5 and 7 of docs/design/STUDIO_STORE.md against a disposable
// local database (vitest.integration refuses anything but a loopback *_test or
// *_demo database): the outbox poller, concurrency with real connections, and
// erasure. Run migrations first. All data is fictional.

process.env.STUDIO_STORE_TEST_HMAC_SECRET ??= randomBytes(32).toString("hex");
const hmacSecret = process.env.STUDIO_STORE_TEST_HMAC_SECRET;

const clients: PrismaClient[] = [];
function client(max = 5): PrismaClient {
  const db = createDatabaseClient(process.env.DATABASE_URL, max) as PrismaClient;
  clients.push(db);
  return db;
}
const db = client();
const PREFIX = `pgd-${randomUUID().slice(0, 8)}`;
const created: string[] = [];
const tenantIds = (label: string) => {
  const id = `${PREFIX}-${label}-${randomUUID().slice(0, 8)}`;
  created.push(id);
  return id;
};

/**
 * The poller, restricted to this run's tenants: the database may hold other
 * runs' rows, and a claim is already a decision (filtering in the sink is too late).
 */
const drain = (options: Omit<Parameters<typeof drainPendingEffects>[0], "tenants">) =>
  drainPendingEffects({ ...options, tenants: [...created] });
const TABLES = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"] as const;

afterAll(async () => {
  for (const table of TABLES) await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id LIKE $1`, `${PREFIX}-%`);
  await Promise.all(clients.map((c) => c.$disconnect()));
});

async function seed(tenantId: string, saved: unknown, kind: TenantKind = "salon") {
  await db.$executeRaw`
    INSERT INTO tenant_state (tenant_id, kind, version, doc) VALUES (${tenantId}, ${kind}::tenant_kind, 0, ${JSON.stringify(kind === "salon" ? withOwnSlug(saved, tenantId) : saved)}::jsonb)`;
}

/** Records every delivery. */
function recordingSinks(onDeliver?: (delivery: EffectDelivery) => void | Promise<void>) {
  const delivered: EffectDelivery[] = [];
  const sink: EffectSink = async (delivery) => {
    await onDeliver?.(delivery);
    delivered.push(delivery);
  };
  const sinks: EffectSinks = { payment: sink, message: sink };
  return { delivered, sinks, of: (tenantId: string) => delivered.filter((d) => d.tenantId === tenantId) };
}

const today = toKey(new Date());

function depositState(): { state: DemoState; deposit: Service } {
  const base = createDemoState(today);
  const [deposit] = bookableServices(base);
  return { state: { ...base, cancellationPolicy: { ...DEFAULT_POLICY, deposits: { [deposit.id]: 20_000 } } }, deposit };
}

/** A free slot at least `fromDay` days out. */
function slotFor(state: DemoState, service: Service, fromDay = 1): { staffId: StaffId; date: string; start: number } {
  for (let i = fromDay; i <= 28; i++) {
    const date = addDays(today, i);
    for (const staffId of service.staffIds) {
      const start = freeStarts(state, staffId, date, needOf(service))[0];
      if (start !== undefined) return { staffId, date, start };
    }
  }
  throw new Error("no free slot");
}

const guest = { name: "Fictional Erasable", phone: "0700001234", email: "erasable@example.test" };
const NEEDLES = [guest.name, guest.phone, "700001234", guest.email];

const hold = (service: Service, slot: { staffId: StaffId; date: string; start: number }, who = guest): DemoAction => ({
  type: "online/hold", serviceId: service.id, ...slot,
  guest: { ...who, at: { date: today, time: 8 * 60 } },
  notice: { title: `Request from ${who.name}`, body: `Call ${who.phone}` },
});

/** Hold then pay a deposit: one payment effect plus confirmation messages. */
async function payDeposit(store: PostgresStudioStore, tenantId: string, state: DemoState, deposit: Service, fromDay = 7, who = guest) {
  const held = await store.apply(tenantId, hold(deposit, slotFor(state, deposit, fromDay), who));
  if (!held.ok) throw new Error("hold refused");
  const paid = await store.apply(tenantId, { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" });
  if (!paid.ok) throw new Error("pay refused");
  return paid;
}

async function effectRows(tenantId: string) {
  return db.$queryRaw<Array<{ id: string; seq: bigint; n: number; kind: string; status: string; attempts: number; next_ms: number; payload: OutboxEntry }>>`
    SELECT id, seq, n, kind, status, attempts, (extract(epoch FROM next_attempt_at) * 1000)::float8 AS next_ms, payload
    FROM tenant_effect WHERE tenant_id = ${tenantId} ORDER BY seq, n`;
}

describe("effect outbox poller (item 4)", () => {
  it("delivers exactly once what a crash between commit and drain left behind", async () => {
    const id = tenantIds("crash");
    const { state, deposit } = depositState();
    await seed(id, state);
    const crashed = recordingSinks();
    // The process "dies" after COMMIT: nothing is delivered after the commit.
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: crashed.sinks, deliverAfterCommit: false });
    const paid = await payDeposit(store, id, state, deposit);
    expect(paid.effects.some((e) => e.kind === "payment")).toBe(true);
    expect(crashed.delivered).toEqual([]);
    const pending = await effectRows(id);
    expect(pending.length).toBeGreaterThan(1);
    expect(pending.every((row) => row.status === "pending" && row.attempts === 0)).toBe(true);

    const live = recordingSinks();
    const first = await drain({ prisma: client(2), sinks: live.sinks, limit: 1000 });
    expect(first.delivered).toBeGreaterThanOrEqual(pending.length);
    const second = await drain({ prisma: client(2), sinks: live.sinks, limit: 1000 });
    expect(live.of(id).map((d) => d.id).sort()).toEqual(pending.map((row) => row.id).sort());
    expect(second.delivered).toBe(0);
    expect((await effectRows(id)).map((row) => [row.status, row.attempts])).toEqual(pending.map(() => ["delivered", 1]));
    // Commit order: the payment row comes in its (seq, n) place.
    expect(live.of(id).map((d) => [d.seq, d.n])).toEqual(pending.map((row) => [Number(row.seq), row.n]));
  });

  it("retries a row whose deliverer died after claiming it only once its lease has run out", async () => {
    const id = tenantIds("lease");
    const { state, deposit } = depositState();
    await seed(id, state);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false });
    await payDeposit(store, id, state, deposit);
    const rows = await effectRows(id);
    // A deliverer claims the first row and never returns (the process died mid-send).
    let claimed!: () => void;
    const isClaimed = new Promise<void>((resolve) => { claimed = resolve; });
    const hanging: EffectSink = (delivery) => {
      if (delivery.tenantId !== id) return;
      claimed();
      return new Promise<void>(() => {});
    };
    void drain({ prisma: client(1), sinks: { payment: hanging, message: hanging }, limit: 1000 });
    await isClaimed;
    const live = recordingSinks();
    const clock = Date.now();
    await drain({ prisma: db, sinks: live.sinks, limit: 1000, now: async () => clock });
    // Everything but the leased row went out.
    expect(live.of(id).map((d) => d.id)).toEqual(rows.slice(1).map((row) => row.id));
    await drain({ prisma: db, sinks: live.sinks, limit: 1000, now: async () => clock + EFFECT_LEASE_MS + 1_000 });
    expect(live.of(id).map((d) => d.id).sort()).toEqual(rows.map((row) => row.id).sort());
    expect((await effectRows(id)).every((row) => row.status === "delivered")).toBe(true);
  });

  it("never delivers one row twice with four pollers running at once", async () => {
    const ids = [tenantIds("many-a"), tenantIds("many-b"), tenantIds("many-c")];
    const expected: string[] = [];
    for (const id of ids) {
      const { state, deposit } = depositState();
      await seed(id, state);
      const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false });
      await payDeposit(store, id, state, deposit);
      const texts = state.customers.slice(0, 12).map((c) => ({ customerId: c.id, title: "Fictional note", body: `Fictional text for ${c.id}` }));
      expect((await store.apply(id, { type: "customers/message", texts, at: { date: today, time: 9 * 60 } })).ok).toBe(true);
      expected.push(...(await effectRows(id)).map((row) => row.id));
    }
    expect(expected.length).toBeGreaterThan(40);
    const live = recordingSinks(() => new Promise((resolve) => setTimeout(resolve, 2)));
    const reports = await Promise.all([0, 1, 2, 3].map(() => drain({ prisma: client(1), sinks: live.sinks, limit: 1000 })));
    const delivered = live.delivered.filter((d) => ids.includes(d.tenantId)).map((d) => d.id);
    expect(new Set(delivered).size).toBe(delivered.length);
    expect(delivered.sort()).toEqual(expected.sort());
    expect(reports.filter((r) => r.delivered > 0).length).toBeGreaterThan(1);
    for (const id of ids) {
      const deliveries = live.of(id);
      // Within a tenant, payments still go out in commit order.
      const payments = deliveries.filter((d) => d.effect.kind === "payment").map((d) => d.seq * 1000 + d.n);
      expect(payments).toEqual([...payments].sort((a, b) => a - b));
    }
  });

  it("backs off exponentially, gives up as failed, and keeps later payments of the tenant waiting", async () => {
    const id = tenantIds("backoff");
    const { state, deposit } = depositState();
    await seed(id, state);
    let now = Date.now();
    const clock = async () => now;
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false, now: clock });
    const paid = await payDeposit(store, id, state, deposit);
    const checkout = (await effectRows(id)).find((row) => row.kind === "payment")!;
    let calls = 0;
    const failing: EffectSink = (delivery) => {
      if (delivery.tenantId !== id) return;
      if (delivery.effect.kind === "payment") { calls++; throw new Error("provider down"); }
    };
    const sinks = { payment: failing, message: failing };
    const run = () => drain({ prisma: db, sinks, now: clock, maxAttempts: 3, limit: 1000 });
    const row = async () => (await effectRows(id)).find((r) => r.id === checkout.id)!;

    await run();
    expect(await row()).toMatchObject({ status: "pending", attempts: 1 });
    expect(Math.round((await row()).next_ms)).toBe(now + 2_000);
    now += 1_999;
    await run();
    expect(calls).toBe(1);
    now += 1;
    await run();
    expect(await row()).toMatchObject({ status: "pending", attempts: 2 });
    expect(Math.round((await row()).next_ms)).toBe(now + 4_000);
    now += 4_000;
    await run();
    expect(await row()).toMatchObject({ status: "failed", attempts: 3 });
    expect(calls).toBe(3);
    now += 3_600_000;
    await run();
    expect(calls).toBe(3);

    // Cancelling refunds the deposit, but the refund waits behind the failed checkout.
    const booking = (await store.load(id))!.state.bookings.find((b) => b.protection?.deposit)!;
    const cancelled = await store.apply(id, { type: "booking/cancel", id: booking.id });
    expect(cancelled.ok && cancelled.effects.map((e) => e.record.action)).toContain("refund");
    const live = recordingSinks();
    await drain({ prisma: db, sinks: live.sinks, now: clock, limit: 1000 });
    expect(live.of(id).filter((d) => d.effect.kind === "payment")).toEqual([]);
    const refund = (await effectRows(id)).find((r) => r.payload.action === "refund")!;
    expect(refund).toMatchObject({ status: "pending", attempts: 0 });
    expect(paid.ok).toBe(true);
  });

  it("claims only the tenants it is given", async () => {
    const mine = tenantIds("scope-mine");
    // Not registered with this run's tenants: another run's salon in the same database.
    const foreign = `${PREFIX}-scope-foreign-${randomUUID().slice(0, 8)}`;
    for (const id of [mine, foreign]) {
      const { state, deposit } = depositState();
      await seed(id, state);
      const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false });
      await payDeposit(store, id, state, deposit);
    }
    const live = recordingSinks();
    await drain({ prisma: db, sinks: live.sinks, limit: 1000 });
    expect(live.of(mine).length).toBeGreaterThan(0);
    expect(live.of(foreign)).toEqual([]);
    expect((await effectRows(foreign)).every((row) => row.status === "pending" && row.attempts === 0)).toBe(true);
  });

  it("routes demo and sandbox effects to the simulated sinks only, by tenant kind", async () => {
    const kinds: TenantKind[] = ["salon", "demo", "sandbox"];
    const ids = Object.fromEntries(kinds.map((kind) => [kind, tenantIds(`kind-${kind}`)])) as Record<TenantKind, string>;
    for (const kind of kinds) {
      const { state, deposit } = depositState();
      await seed(ids[kind], state, kind);
      const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false });
      await payDeposit(store, ids[kind], state, deposit);
    }
    // Without live sinks the poller leaves salon effects alone (not even claimed).
    const simulatedOnly = recordingSinks();
    await drain({ prisma: db, simulatedSinks: simulatedOnly.sinks, limit: 1000 });
    expect(simulatedOnly.of(ids.salon)).toEqual([]);
    expect((await effectRows(ids.salon)).every((row) => row.status === "pending" && row.attempts === 0)).toBe(true);
    expect(simulatedOnly.of(ids.demo).length).toBeGreaterThan(0);
    expect(simulatedOnly.of(ids.sandbox).length).toBeGreaterThan(0);
    expect(simulatedOnly.of(ids.demo).every((d) => d.tenantKind === "demo")).toBe(true);

    const live = recordingSinks();
    const simulated = recordingSinks();
    await drain({ prisma: db, sinks: live.sinks, simulatedSinks: simulated.sinks, limit: 1000 });
    expect(live.of(ids.salon).length).toBe((await effectRows(ids.salon)).length);
    expect(live.delivered.some((d) => d.tenantId === ids.demo || d.tenantId === ids.sandbox)).toBe(false);

    // The in-apply drain follows the same routing.
    const demo = tenantIds("kind-demo-apply");
    const { state, deposit } = depositState();
    await seed(demo, state, "demo");
    const liveApply = recordingSinks();
    const simulatedApply = recordingSinks();
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: liveApply.sinks, simulatedSinks: simulatedApply.sinks });
    await payDeposit(store, demo, state, deposit);
    expect(liveApply.of(demo)).toEqual([]);
    expect(simulatedApply.of(demo).some((d) => d.effect.kind === "payment" && d.tenantKind === "demo")).toBe(true);
  });
});

describe("concurrency with real connections (item 5)", () => {
  it("lets exactly one of 20 parallel bookings of one slot win", async () => {
    const id = tenantIds("twenty");
    const state = createDemoState(today);
    await seed(id, state);
    const service = bookableServices(state).find((s) => s.price > 0)!;
    const slot = slotFor(state, service);
    const customers = state.customers.slice(0, 20);
    expect(customers).toHaveLength(20);
    const stores = customers.map(() => new PostgresStudioStore({ prisma: client(1), hmacSecret, sinks: recordingSinks().sinks }));
    const results = await Promise.all(stores.map((store, i) =>
      store.apply(id, { type: "booking/create", customerId: customers[i].id, serviceId: service.id, ...slot, source: "phone" })));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    for (const result of results.filter((r) => !r.ok)) expect(["rejected", "conflict"]).toContain(!result.ok && result.reason);
    const after = (await stores[0].load(id))!;
    expect(after.version).toBe(1);
    expect(after.state.bookings.filter((b) => b.status !== "cancelled" && b.staffId === slot.staffId && b.date === slot.date && b.start === slot.start)).toHaveLength(1);
    expect(await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM tenant_action WHERE tenant_id = ${id}`).toEqual([{ n: 1 }]);
  });

  it("charges one deposit when 20 connections pay the same hold at once", async () => {
    const id = tenantIds("twenty-pay");
    const { state, deposit } = depositState();
    await seed(id, state);
    const recorder = recordingSinks();
    const first = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recorder.sinks });
    const held = await first.apply(id, hold(deposit, slotFor(state, deposit)));
    if (!held.ok) throw new Error("hold refused");
    const pay: DemoAction = { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" };
    const stores = Array.from({ length: 20 }, () => new PostgresStudioStore({ prisma: client(1), hmacSecret, sinks: recorder.sinks }));
    const results = await Promise.all(stores.map((store) => store.apply(id, pay)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM tenant_action WHERE tenant_id = ${id}`).toEqual([{ n: 2 }]);
    expect(await db.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM tenant_effect WHERE tenant_id = ${id} AND kind = 'payment'`).toEqual([{ n: 1 }]);
    expect(recorder.of(id).filter((d) => d.effect.kind === "payment")).toHaveLength(1);
  });

  it("keeps versions and seq gap-free while two instances interleave applies on one tenant", async () => {
    const id = tenantIds("interleave");
    await seed(id, createDemoState(today));
    const one = new PostgresStudioStore({ prisma: client(2), hmacSecret, sinks: recordingSinks().sinks });
    const two = new PostgresStudioStore({ prisma: client(2), hmacSecret, sinks: recordingSinks().sinks });
    const run = async (store: PostgresStudioStore, label: string) => {
      const versions: number[] = [];
      for (let i = 0; i < 15; i++) {
        const result = await store.apply(id, { type: "card/dismiss", id: `${label}-${i}` });
        if (!result.ok) throw new Error(`apply refused: ${result.reason}`);
        versions.push(result.version);
      }
      return versions;
    };
    const [a, b] = await Promise.all([run(one, "one"), run(two, "two")]);
    expect([...a, ...b].sort((x, y) => x - y)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    // Each instance saw its own versions increase.
    expect(a).toEqual([...a].sort((x, y) => x - y));
    expect(b).toEqual([...b].sort((x, y) => x - y));
    expect((await one.load(id))?.version).toBe(30);
    const rows = await db.$queryRaw<Array<{ seq: bigint; resulting_version: number }>>`
      SELECT seq, resulting_version FROM tenant_action WHERE tenant_id = ${id} ORDER BY seq`;
    expect(rows.map((r) => [Number(r.seq), r.resulting_version])).toEqual(Array.from({ length: 30 }, (_, i) => [i + 1, i + 1]));
    const history = await two.history(id, { limit: 100 });
    expect(history.entries.map((e) => e.seq)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it("maps a row lock held too long by another connection to conflict", async () => {
    expect(LOCK_TIMEOUT_MS).toBe(2_000);
    const id = tenantIds("lock-timeout");
    const state = createDemoState(today);
    await seed(id, state);
    const store = new PostgresStudioStore({ prisma: client(2), hmacSecret, sinks: recordingSinks().sinks, lockTimeoutMs: 300 });
    const blocker = client(1);
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => { locked = resolve; });
    const holding = blocker.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM tenant_state WHERE tenant_id = ${id} FOR UPDATE`;
      locked();
      await released;
    }, { timeout: 15_000 });
    await isLocked;
    try {
      const started = Date.now();
      expect(await store.apply(id, { type: "card/dismiss", id: "waits" })).toEqual({ ok: false, reason: "conflict" });
      const waited = Date.now() - started;
      expect(waited).toBeGreaterThanOrEqual(250);
      expect(waited).toBeLessThan(LOCK_TIMEOUT_MS);
      expect(await store.eraseSubject(id, state.customers[0].id)).toEqual({ ok: false, reason: "conflict" });
    } finally {
      release();
      await holding;
    }
    expect((await store.load(id))?.version).toBe(0);
    expect(await db.$queryRaw`SELECT seq FROM tenant_action WHERE tenant_id = ${id}`).toEqual([]);
    expect((await store.apply(id, { type: "card/dismiss", id: "waits" })).ok).toBe(true);
  });
});

/** Every row of every tenant table for one tenant, as text, that contains a needle (case-insensitive). */
async function personalDataHits(tenantId: string, needles = NEEDLES): Promise<string[]> {
  const found: string[] = [];
  for (const table of TABLES) {
    const rows = await db.$queryRawUnsafe<Array<{ row: string }>>(`SELECT t::text AS row FROM ${table} t WHERE tenant_id = $1`, tenantId);
    for (const { row } of rows) {
      for (const needle of needles) if (row.toLowerCase().includes(needle.toLowerCase())) found.push(`${table}: ${needle}`);
    }
  }
  return found;
}

/** The guest's phone as an earlier booking-page visit typed it, and private text that names nobody. */
const FORMATTED_PHONE = "+46 70 000 12 34";
const PRIVATE = "Fictional private reason";
const ERASURE_NEEDLES = [...NEEDLES, FORMATTED_PHONE, PRIVATE];

/**
 * A tenant where the fictional guest books with a deposit, gets texts (one
 * shared with another customer), a note, a hold typed with a formatted phone
 * and no email, and a second booking under a key that holds their email,
 * cancelled with a private reason. Another customer is texted too.
 */
async function erasableTenant(id: string, store: PostgresStudioStore, kind: TenantKind = "salon") {
  const { state, deposit } = depositState();
  await seed(id, state, kind);
  await payDeposit(store, id, state, deposit, 7);
  const loaded = (await store.load(id))!.state;
  const customer = loaded.customers.find((c) => c.phone === guest.phone)!;
  expect(customer).toBeDefined();
  const other = loaded.customers.find((c) => c.id !== customer.id)!;
  const steps: DemoAction[] = [
    { type: "customer/note", id: customer.id, note: `Fictional note about ${guest.name}` },
    { type: "customers/message", texts: [{ customerId: customer.id, title: "Fictional reminder", body: `Hi ${guest.name}, see you soon.` }], at: { date: today, time: 9 * 60 } },
    { type: "customers/message", texts: [{ customerId: other.id, title: "Fictional reminder", body: "Hi, see you soon." }], at: { date: today, time: 9 * 60 } },
    {
      type: "customers/message", at: { date: today, time: 10 * 60 },
      texts: [{ customerId: customer.id, title: "Fictional offer", body: "A gap opened today." }, { customerId: other.id, title: "Fictional offer", body: "A gap opened today." }],
    },
  ];
  for (const step of steps) expect((await store.apply(id, step)).ok).toBe(true);
  // A later visit to the booking page with the same number typed differently, under another name and no email.
  const formatted = await store.apply(id, hold(deposit, slotFor((await store.load(id))!.state, deposit, 14), { name: "F. Guest", phone: FORMATTED_PHONE, email: "" }));
  expect(formatted.ok).toBe(true);
  const plain = bookableServices(loaded).find((s) => s.id !== deposit.id)!;
  const second = await store.apply(id, { type: "booking/create", customerId: customer.id, serviceId: plain.id, ...slotFor((await store.load(id))!.state, plain, 10), source: "phone" }, {}, { idempotencyKey: `studio:book-${guest.email}` });
  if (!second.ok) throw new Error("booking refused");
  const booking = second.state.bookings.at(-1)!;
  expect((await store.apply(id, { type: "booking/cancel", id: booking.id, reason: PRIVATE })).ok).toBe(true);
  return { customer: customer as Customer, other };
}

describe("erasure (item 7)", () => {
  it("leaves no trace of a deleted customer's name, phone, email or private text in any tenant table", async () => {
    const id = tenantIds("erase");
    const recorder = recordingSinks();
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recorder.sinks });
    const { customer, other } = await erasableTenant(id, store);
    // Sanity: the data is everywhere before.
    const before = await personalDataHits(id, ERASURE_NEEDLES);
    for (const table of TABLES) expect(before.some((hit) => hit.startsWith(`${table}:`))).toBe(true);
    for (const needle of [FORMATTED_PHONE, PRIVATE]) expect(before.some((hit) => hit.endsWith(needle))).toBe(true);
    expect(recorder.of(id).some((d) => d.effect.kind === "payment")).toBe(true);
    expect(recorder.of(id).some((d) => d.effect.kind === "message" && d.effect.record.body.includes(guest.name))).toBe(true);

    // The owner deletes the customer (trash), then the erasure runs.
    expect((await store.apply(id, { type: "customer/delete", id: customer.id })).ok).toBe(true);
    const version = (await store.load(id))!.version;
    const erased = await store.eraseSubject(id, customer.id);
    if (!erased.ok) throw new Error(`erase refused: ${erased.reason}`);
    expect(erased.version).toBe(version + 1);
    expect(erased.entry?.action).toEqual({ type: "customer/erase", id: customer.id });
    expect(erased.redacted.idempotencyKeys).toBe(1);
    expect(erased.redacted.actions).toBeGreaterThanOrEqual(7);
    expect(erased).toMatchObject({ pendingPayments: 0, inFlightMessages: 0 });

    expect(await personalDataHits(id, ERASURE_NEEDLES)).toEqual([]);
    const after = (await store.load(id))!;
    expect(after.state.customers.some((c) => c.id === customer.id)).toBe(false);
    expect(after.state.trash.some((e) => e.kind === "customer" && e.customer.id === customer.id)).toBe(false);
    expect(after.state.customers.some((c) => c.id === other.id)).toBe(true);
    expect(after.state.salon.slug).toBe(id);
    // The log keeps its shape: rows naming the customer are marked redacted, the other customer's text is intact.
    const rows = await db.$queryRaw<Array<{ seq: bigint; type: string; redacted: boolean; action: DemoAction; key: string | null }>>`
      SELECT seq, action->>'type' AS type, redacted_at IS NOT NULL AS redacted, action, idempotency_key AS key FROM tenant_action WHERE tenant_id = ${id} ORDER BY seq`;
    expect(rows.filter((r) => r.type === "online/hold").every((r) => r.redacted && (r.action as { guest: { phone: string } }).guest.phone === "[redacted]")).toBe(true);
    expect(rows.find((r) => r.type === "customer/note")?.redacted).toBe(true);
    expect(rows.find((r) => r.type === "booking/create")?.key).toBe("studio:book-[redacted]");
    const otherText = rows.find((r) => r.type === "customers/message" && JSON.stringify(r.action).includes(other.id) && !JSON.stringify(r.action).includes(customer.id))!;
    expect(otherText.redacted).toBe(false);
    expect(otherText.action).toMatchObject({ texts: [{ body: "Hi, see you soon." }] });
    expect((await store.history(id, { limit: 100 })).entries.find((e) => e.action.type === "booking/create")?.idempotencyKey).toBe("studio:book-[redacted]");
    // Messages to the other customer, including the one sent with the guest's, are untouched.
    const effects = await effectRows(id);
    const toOther = effects.filter((row) => row.payload.to === `customer:${other.id}`);
    expect(toOther.length).toBeGreaterThanOrEqual(2);
    expect(toOther.every((row) => row.status === "delivered" && row.payload.body !== "[redacted]")).toBe(true);
    expect(effects.filter((row) => row.payload.to === `customer:${customer.id}`)).toEqual([]);
    // The delivered payment keeps its amount for the books.
    const payment = effects.find((row) => row.kind === "payment")!;
    expect(payment).toMatchObject({ status: "delivered" });
    expect(payment.payload.cost).toMatchObject({ amountMinor: 20_000 });
    // The key is kept under its hash, with its fingerprint: a retry never runs again, and another request under it is a mismatch.
    expect(await store.apply(id, { type: "booking/create", customerId: customer.id, serviceId: "x", staffId: "x" as StaffId, date: today, start: 600, source: "phone" }, {}, { idempotencyKey: `studio:book-${guest.email}` }))
      .toMatchObject({ ok: false, reason: "idempotency-mismatch" });
  });

  it("keeps other retries protected when an erasure finds nothing of theirs", async () => {
    const id = tenantIds("erase-keys");
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    const { customer } = await erasableTenant(id, store);
    expect(await store.eraseSubject(id, customer.id)).toMatchObject({ ok: true, redacted: { idempotencyKeys: 1 } });
    // A keyed change after the erasure: its stored result no longer holds the customer.
    const stock = (await store.load(id))!.state.stock[0];
    const adjust: DemoAction = { type: "stock/adjust", id: stock.id, delta: 1 };
    expect(await store.apply(id, adjust, {}, { idempotencyKey: "stock-1" })).toMatchObject({ ok: true, replayed: false });
    // A typo and a repeated request both leave the key alone, so a retry still does not adjust twice.
    expect(await store.eraseSubject(id, "k-typo")).toMatchObject({ ok: true, redacted: { idempotencyKeys: 0 } });
    expect(await store.eraseSubject(id, customer.id)).toMatchObject({ ok: true, redacted: { idempotencyKeys: 0 } });
    expect(await store.apply(id, adjust, {}, { idempotencyKey: "stock-1" })).toMatchObject({ ok: true, replayed: true });
    expect((await store.load(id))!.state.stock[0].inStock).toBe(stock.inStock + 1);
  });

  it("cancels unsent messages to the erased customer only and keeps a pending payment for delivery", async () => {
    const id = tenantIds("erase-pending");
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false });
    const { customer, other } = await erasableTenant(id, store);
    const erased = await store.eraseSubject(id, customer.id);
    if (!erased.ok) throw new Error("erase refused");
    expect(erased.pendingPayments).toBe(1);
    const rows = await effectRows(id);
    expect(rows.find((row) => row.kind === "payment")?.status).toBe("pending");
    const theirs = rows.filter((row) => row.kind === "message" && row.payload.to === "[redacted]");
    expect(theirs.length).toBeGreaterThanOrEqual(3);
    expect(theirs.every((row) => row.status === "cancelled")).toBe(true);
    // Both messages to the other customer, one from the same action as the guest's, are still pending and get sent.
    const toOther = rows.filter((row) => row.payload.to === `customer:${other.id}`);
    expect(toOther.map((row) => row.status)).toEqual(["pending", "pending"]);
    const live = recordingSinks();
    await drain({ prisma: db, sinks: live.sinks, limit: 1000 });
    expect(live.of(id).map((d) => d.effect.kind).sort()).toEqual(["message", "message", "payment"]);
    expect(live.of(id).some((d) => JSON.stringify(d).includes(guest.name))).toBe(false);
  });

  it.each(["statements", "function"] as const)("cancels a message a deliverer holds during the erasure (%s) and records its true outcome", async (erasure) => {
    const id = tenantIds(`erase-in-flight-${erasure}`);
    const state = createDemoState(today);
    await seed(id, state);
    if (erasure === "function") await db.$transaction(async (tx) => { for (const statement of await eraseSubjectStatements()) await tx.$executeRawUnsafe(statement); }, { timeout: 15_000 });
    try {
      const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false, erasure });
      const service = bookableServices(state)[0];
      const created = await store.apply(id, {
        type: "booking/create", serviceId: service.id, ...slotFor(state, service), source: "phone",
        newCustomer: { name: guest.name, phone: guest.phone, email: guest.email, since: today },
      });
      if (!created.ok) throw new Error("booking refused");
      const customer = created.state.customers.find((c) => c.phone === guest.phone)!;
      const text = (body: string): DemoAction => ({ type: "customers/message", texts: [{ customerId: customer.id, title: "Fictional", body }], at: { date: today, time: 9 * 60 } });
      expect((await store.apply(id, text("First fictional text"))).ok).toBe(true);
      expect((await store.apply(id, text("Second fictional text"))).ok).toBe(true);

      // The first message is in flight: its sink waits, then fails, while the erasure runs.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let entered!: () => void;
      const inFlight = new Promise<void>((resolve) => { entered = resolve; });
      let calls = 0;
      const message: EffectSink = async () => { calls++; entered(); await gate; throw new Error("provider timeout"); };
      const sending = drain({ prisma: client(1), sinks: { payment: () => {}, message }, limit: 1 });
      await inFlight;
      const erased = await store.eraseSubject(id, customer.id);
      expect(erased).toMatchObject({ ok: true, inFlightMessages: 1 });
      const during = await effectRows(id);
      // Claimed or pending, both are cancelled in the erasure's own transaction.
      expect(during.map((row) => row.status)).toEqual(["cancelled", "cancelled"]);
      expect(during.every((row) => row.payload.body === "[redacted]")).toBe(true);
      release();
      await sending;
      // The failed send stays cancelled, never retried, even after its lease and backoff.
      expect((await effectRows(id)).map((row) => row.status)).toEqual(["cancelled", "cancelled"]);
      await drain({ prisma: db, sinks: { payment: () => {}, message }, limit: 10, now: async () => Date.now() + 2 * EFFECT_LEASE_MS });
      expect(calls).toBe(1);
    } finally {
      if (erasure === "function") {
        await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS erase_subject(text, text), studio_scrub(jsonb, text[]), studio_scrub_text(text, text[]),
          studio_redact_path(jsonb, text[]), studio_phone_digits(text)`);
      }
    }
  });

  it("records a send that succeeded during the erasure as delivered, with the payload redacted", async () => {
    const id = tenantIds("erase-in-flight-ok");
    const state = createDemoState(today);
    await seed(id, state);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, deliverAfterCommit: false });
    const customer = state.customers[0];
    expect((await store.apply(id, { type: "customers/message", texts: [{ customerId: customer.id, title: "Fictional", body: "Fictional text" }], at: { date: today, time: 9 * 60 } })).ok).toBe(true);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const inFlight = new Promise<void>((resolve) => { entered = resolve; });
    const sending = drain({ prisma: client(1), sinks: { payment: () => {}, message: async () => { entered(); await gate; } }, limit: 1 });
    await inFlight;
    expect(await store.eraseSubject(id, customer.id)).toMatchObject({ ok: true, inFlightMessages: 1 });
    release();
    expect(await sending).toMatchObject({ delivered: 1 });
    const [row] = await effectRows(id);
    expect(row).toMatchObject({ status: "delivered" });
    expect(row.payload).toMatchObject({ to: "[redacted]", body: "[redacted]" });
  });

  it("refuses customer/erase through apply, so the log is never left unredacted", async () => {
    const id = tenantIds("erase-apply");
    const state = createDemoState(today);
    await seed(id, state);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    expect(await store.apply(id, { type: "customer/erase", id: state.customers[0].id })).toEqual({ ok: false, reason: "rejected" });
    expect(await store.eraseSubject(tenantIds("nobody"), "k-1")).toEqual({ ok: false, reason: "not-found" });
    // A customer the document no longer holds: the tables are still redacted by subject_ids, without a new version.
    expect((await store.apply(id, { type: "customer/note", id: state.customers[0].id, note: "Fictional note" })).ok).toBe(true);
    const gone = await store.eraseSubject(id, "k-unknown");
    expect(gone).toMatchObject({ ok: true, version: 1, redacted: { actions: 0, effects: 0, idempotencyKeys: 0 } });
  });
});

/** The statements of prisma/grants/erase-subject.sql, with both roles set to the connecting role (the test role cannot create roles). */
async function eraseSubjectStatements(): Promise<string[]> {
  const [{ role }] = await db.$queryRaw<Array<{ role: string }>>`SELECT current_user::text AS role`;
  const quoted = `"${role.replaceAll('"', '""')}"`;
  const sql = readFileSync(new URL("../../prisma/grants/erase-subject.sql", import.meta.url), "utf8");
  return sql.split("-- statement").slice(1)
    .map((statement) => statement.replaceAll(':"eraser_role"', quoted).replaceAll(':"app_role"', quoted))
    // The caller's transaction stands in for the script's own BEGIN and COMMIT.
    .filter((statement) => !/^\s*(BEGIN|COMMIT);/.test(statement));
}

const ROLLBACK = "rollback";

describe("erase_subject (prisma/grants/erase-subject.sql)", () => {
  it("redacts exactly as eraseSubject does and is not executable by PUBLIC", async () => {
    // Same history on two tenants with one fixed clock, so their rows are identical.
    const fixed = Date.now();
    const a = tenantIds("erase-ts");
    const b = tenantIds("erase-sql");
    const storeA = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, now: async () => fixed });
    const storeB = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, now: async () => fixed });
    // Demo tenants: salon rows may not share an address, and a deposit's id is derived from it.
    const { customer } = await erasableTenant(a, storeA, "demo");
    await erasableTenant(b, storeB, "demo");
    const ts = await storeA.eraseSubject(a, customer.id);
    if (!ts.ok) throw new Error("erase refused");
    const snapshot = async (tx: Pick<PrismaClient, "$queryRaw">, tenantId: string) => ({
      actions: await tx.$queryRaw<Array<{ seq: bigint; action: unknown; key: string | null; redacted: boolean }>>`
        SELECT seq, action, idempotency_key AS key, redacted_at IS NOT NULL AS redacted FROM tenant_action
        WHERE tenant_id = ${tenantId} AND seq <= ${ts.entry!.seq - 1}::bigint ORDER BY seq`,
      effects: await tx.$queryRaw<Array<{ seq: bigint; n: number; status: string; payload: unknown; erased: boolean }>>`
        SELECT seq, n, status, payload, erased_at IS NOT NULL AS erased FROM tenant_effect WHERE tenant_id = ${tenantId} ORDER BY seq, n`,
      keys: await tx.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int AS n FROM tenant_idempotency WHERE tenant_id = ${tenantId}`,
    });
    const expected = await snapshot(db, a);
    const statements = await eraseSubjectStatements();
    let seen: Awaited<ReturnType<typeof snapshot>> | undefined;
    let counts: unknown;
    let publicCanExecute: unknown;
    let scrubbed: unknown;
    // Created and run in a transaction that is rolled back, so nothing stays in the database.
    await expect(db.$transaction(async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
      [{ publicCanExecute }] = await tx.$queryRaw<Array<{ publicCanExecute: boolean }>>`
        SELECT has_function_privilege('public', 'erase_subject(text, text)', 'EXECUTE') AS "publicCanExecute"`;
      [{ scrubbed }] = await tx.$queryRaw<Array<{ scrubbed: unknown }>>`
        SELECT studio_scrub('{"700001234": 1700001234000, "s": "call 700001234", "n": [700001234, "x 700001234"]}'::jsonb, ARRAY['700001234']) AS scrubbed`;
      [{ counts }] = await tx.$queryRaw<Array<{ counts: unknown }>>`SELECT erase_subject(${b}, ${customer.id}) AS counts`;
      seen = await snapshot(tx, b);
      throw new Error(ROLLBACK);
    }, { timeout: 15_000 })).rejects.toThrow(ROLLBACK);
    expect(publicCanExecute).toBe(false);
    // Only string values change: keys and numbers are never rewritten.
    expect(scrubbed).toEqual({ "700001234": 1700001234000, s: "call [redacted]", n: [700001234, "x [redacted]"] });
    expect(counts).toEqual({ ...ts.redacted, pendingPayments: ts.pendingPayments, inFlightMessages: ts.inFlightMessages });
    expect(seen).toEqual(expected);
    // The rollback removed the functions again.
    expect(await db.$queryRaw`SELECT 1 FROM pg_proc WHERE proname = 'erase_subject'`).toEqual([]);
  });

  it("keeps another customer's replay and redacts the stored action of the erased customer's entry, as the statements do", async () => {
    const id = tenantIds("erase-replay");
    const plain = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    const { customer, other } = await erasableTenant(id, plain);
    const keyed: DemoAction = { type: "customer/note", id: customer.id, note: "Fictional private text that names nobody" };
    expect((await plain.apply(id, keyed, {}, { idempotencyKey: "replay-own" })).ok).toBe(true);
    const otherNote: DemoAction = { type: "customer/note", id: other.id, note: "Fictional note for the other customer" };
    const first = await plain.apply(id, otherNote, {}, { idempotencyKey: "replay-other" });
    if (!first.ok) throw new Error("fixture refused");
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, erasure: "function" });
    const statements = await eraseSubjectStatements();
    await db.$transaction(async (tx) => { for (const statement of statements) await tx.$executeRawUnsafe(statement); }, { timeout: 15_000 });
    try {
      expect(await store.eraseSubject(id, customer.id)).toMatchObject({ ok: true });
      const replay = await store.apply(id, otherNote, {}, { idempotencyKey: "replay-other" });
      expect(replay).toMatchObject({ ok: true, replayed: true, version: first.version });
      const stored = await db.$queryRaw<Array<{ result: { entry: { action: { note?: string } } } }>>`
        SELECT result FROM tenant_idempotency WHERE tenant_id = ${id} AND key = 'replay-own' OR (tenant_id = ${id} AND key LIKE 'erased-%')`;
      expect(stored.every((row) => row.result.entry.action.note === undefined || row.result.entry.action.note === "[redacted]")).toBe(true);
      expect(JSON.stringify(await db.$queryRaw`SELECT result FROM tenant_idempotency WHERE tenant_id = ${id}`)).not.toContain("names nobody");
    } finally {
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS erase_subject(text, text), studio_redact_replay_action(jsonb, text, text[], text[], jsonb), studio_redact_replay(jsonb, text, text[], text[]),
        studio_scrub(jsonb, text[]), studio_scrub_text(text, text[]), studio_redact_path(jsonb, text[]), studio_phone_digits(text)`);
    }
  }, 30_000);

  it("is what eraseSubject calls with erasure: \"function\"", async () => {
    const id = tenantIds("erase-fn");
    const plain = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    const { customer } = await erasableTenant(id, plain);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, erasure: "function" });
    // Without the function installed the erasure fails as a whole: nothing is half-erased.
    await expect(store.eraseSubject(id, customer.id)).rejects.toThrow();
    expect((await personalDataHits(id)).length).toBeGreaterThan(0);
    expect((await store.load(id))!.state.customers.some((c) => c.id === customer.id)).toBe(true);
    const statements = await eraseSubjectStatements();
    await db.$transaction(async (tx) => { for (const statement of statements) await tx.$executeRawUnsafe(statement); }, { timeout: 15_000 });
    try {
      const erased = await store.eraseSubject(id, customer.id);
      expect(erased).toMatchObject({ ok: true, redacted: { idempotencyKeys: 1 } });
      expect(await personalDataHits(id, ERASURE_NEEDLES)).toEqual([]);
    } finally {
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS erase_subject(text, text), studio_redact_replay_action(jsonb, text, text[], text[], jsonb), studio_redact_replay(jsonb, text, text[], text[]), studio_scrub(jsonb, text[]), studio_scrub_text(text, text[]),
        studio_redact_path(jsonb, text[]), studio_phone_digits(text)`);
    }
  });
});
