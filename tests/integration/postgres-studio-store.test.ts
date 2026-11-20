import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import type { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import type { OutboxEntry } from "@/concept/connections/simulated/outbox";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { DemoState, Service, StaffId } from "@/concept/data/types";
import { bookableServices } from "@/concept/selectors";
import { effectId } from "@/concept/store/staged-channels";
import { SALON_TIMEZONE } from "@/concept/tools/clock";
import { IDEMPOTENCY_TTL_MS, PostgresStudioStore, type EffectDelivery, type EffectSink, type TenantKind } from "@/concept/store/postgres-studio-store";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { runStudioStoreContract } from "../store-contract/contract";

// PostgresStudioStore against a disposable local database (vitest.integration
// refuses anything but a loopback *_test or *_demo database). Run migrations
// first: DATABASE_URL=… npx prisma migrate deploy. All data is fictional.

// A throwaway secret that lives in this process's environment only and is never printed.
process.env.STUDIO_STORE_TEST_HMAC_SECRET ??= randomBytes(32).toString("hex");
const hmacSecret = process.env.STUDIO_STORE_TEST_HMAC_SECRET;

const clients: PrismaClient[] = [];
function client(max = 5): PrismaClient {
  const db = createDatabaseClient(process.env.DATABASE_URL, max) as PrismaClient;
  clients.push(db);
  return db;
}
const db = client();
const PREFIX = `pgs-${randomUUID().slice(0, 8)}`;
const tenantIds = (label: string) => `${PREFIX}-${label}-${randomUUID().slice(0, 8)}`;

afterAll(async () => {
  for (const table of ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"]) {
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id LIKE $1`, `${PREFIX}-%`);
  }
  await Promise.all(clients.map((c) => c.$disconnect()));
});

async function seed(tenantId: string, saved: unknown, kind: TenantKind = "salon", expiresAt: number | null = null) {
  await db.$executeRaw`
    INSERT INTO tenant_state (tenant_id, kind, version, doc, expires_at)
    VALUES (${tenantId}, ${kind}::tenant_kind, 0, ${JSON.stringify(saved) ?? "null"}::jsonb,
            ${expiresAt === null ? null : new Date(expiresAt).toISOString()}::timestamptz)`;
}

/** Records every delivery per tenant, like the payment sink a provider would see. */
function recordingSinks() {
  const delivered: EffectDelivery[] = [];
  const sink: EffectSink = (delivery) => { delivered.push(delivery); };
  const of = (kind: "payment" | "message") => (tenantId: string): OutboxEntry[] =>
    delivered.filter((d) => d.tenantId === tenantId && d.effect.kind === kind).map((d) => d.effect.record);
  return { delivered, sinks: { payment: sink, message: sink }, payments: of("payment"), messages: of("message") };
}

let contractStore: PostgresStudioStore | undefined;
afterEach(() => {
  contractStore?.close();
  contractStore = undefined;
});

runStudioStoreContract("PostgresStudioStore", async (seeds) => {
  const a = tenantIds("a");
  const b = tenantIds("b");
  await seed(a, seeds.a);
  await seed(b, seeds.b, "salon");
  const { sinks, payments, messages } = recordingSinks();
  const store = contractStore = new PostgresStudioStore({ prisma: db, hmacSecret, sinks });
  return { store, tenants: { a, b }, open: async () => {}, payments, messages };
});

const today = toKey(new Date());

function depositState(): { state: DemoState; deposit: Service } {
  const base = createDemoState(today);
  const [deposit] = bookableServices(base);
  return { state: { ...base, cancellationPolicy: { ...DEFAULT_POLICY, deposits: { [deposit.id]: 20_000 } } }, deposit };
}

function slotFor(state: DemoState, service: Service, skip = 0) {
  const found: Array<{ staffId: StaffId; date: string; start: number }> = [];
  for (let i = 1; i <= 21 && found.length <= skip; i++) {
    const date = addDays(today, i);
    for (const staffId of service.staffIds) {
      for (const start of freeStarts(state, staffId, date, needOf(service))) found.push({ staffId, date, start });
    }
  }
  return found[skip];
}

const hold = (service: Service, slot: { staffId: StaffId; date: string; start: number }): DemoAction => ({
  type: "online/hold", serviceId: service.id, ...slot,
  guest: { name: "Fictional Guest", phone: "0700009911", at: { date: today, time: 8 * 60 } },
  notice: { title: "Demo request", body: "Demo appointment" },
});

async function dbClock(): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ ms: number }>>`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms`;
  return row.ms;
}

describe("PostgresStudioStore specifics", () => {
  it("refuses a short HMAC secret without echoing it", () => {
    const { sinks } = recordingSinks();
    expect(() => new PostgresStudioStore({ prisma: db, hmacSecret: "short", sinks })).toThrow(/^STUDIO_STORE_SECRET_INVALID$/);
  });

  it("stamps entries with the database clock and ignores meta.at", async () => {
    const id = tenantIds("clock");
    await seed(id, createDemoState(today));
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    const before = await dbClock();
    const result = await store.apply(id, { type: "card/dismiss", id: "c1" }, { at: Date.UTC(2001, 0, 1) });
    const after = await dbClock();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entry.at).toBeGreaterThanOrEqual(Math.floor(before));
    expect(result.entry.at).toBeLessThanOrEqual(Math.ceil(after));
    const [row] = await db.$queryRaw<Array<{ at_ms: number }>>`
      SELECT (extract(epoch FROM at) * 1000)::float8 AS at_ms FROM tenant_action WHERE tenant_id = ${id} AND seq = 1`;
    expect(Math.round(row.at_ms)).toBe(result.entry.at);
  });

  it("uses meta.at only with trustCallerClock, and never goes back before the previous entry", async () => {
    const id = tenantIds("trusted");
    await seed(id, createDemoState(today));
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, trustCallerClock: true });
    const t = Date.now();
    const one = await store.apply(id, { type: "card/dismiss", id: "t1" }, { at: t });
    const two = await store.apply(id, { type: "card/dismiss", id: "t2" }, { at: t - 60_000 });
    expect(one.ok && one.entry.at).toBe(t);
    expect(two.ok && two.entry.at).toBe(t);
    // An injected clock that runs backwards is clamped as well.
    let reading = t + 5_000;
    const backwards = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks, now: async () => reading });
    const three = await backwards.apply(id, { type: "card/dismiss", id: "t3" });
    reading = t + 1_000;
    const four = await backwards.apply(id, { type: "card/dismiss", id: "t4" });
    expect(three.ok && three.entry.at).toBe(t + 5_000);
    expect(four.ok && four.entry.at).toBe(t + 5_000);
    const history = (await store.history(id, { limit: 10 })).entries.map((e) => e.at);
    expect(history).toEqual([t, t, t + 5_000, t + 5_000]);
  });

  it("forgets idempotency keys after 24 hours: a replayed booking is rejected, a replayed payment charges once", async () => {
    const id = tenantIds("ttl");
    const { state, deposit } = depositState();
    await seed(id, state);
    let now = Date.now();
    const recorder = recordingSinks();
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recorder.sinks, now: async () => now });
    const customer = state.customers[0];
    const plain = bookableServices(state).find((s) => s.id !== deposit.id)!;
    const slot = slotFor(state, plain);
    const book: DemoAction = { type: "booking/create", customerId: customer.id, serviceId: plain.id, ...slot, source: "phone" };
    const booked = await store.apply(id, book, {}, { idempotencyKey: "book-1" });
    expect(booked.ok).toBe(true);
    const held = await store.apply(id, hold(deposit, slotFor((await store.load(id))!.state, deposit)));
    if (!held.ok) throw new Error("hold refused");
    const pay: DemoAction = { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" };
    const paid = await store.apply(id, pay, {}, { idempotencyKey: "pay-1" });
    expect(paid.ok && paid.effects.some((e) => e.kind === "payment")).toBe(true);
    expect(recorder.payments(id)).toHaveLength(1);

    // Just inside the window: both keys replay.
    now += IDEMPOTENCY_TTL_MS - 1_000;
    expect(await store.apply(id, book, {}, { idempotencyKey: "book-1" })).toMatchObject({ ok: true, replayed: true });
    expect(await store.apply(id, pay, {}, { idempotencyKey: "pay-1" })).toMatchObject({ ok: true, replayed: true });

    // Past 24 hours the keys are forgotten and the rules run again.
    now += 2_000;
    expect(await store.apply(id, book, {}, { idempotencyKey: "book-1" })).toMatchObject({ ok: false, reason: "rejected" });
    expect(await store.apply(id, pay, {}, { idempotencyKey: "pay-1" })).toMatchObject({ ok: false, reason: "rejected" });
    expect(recorder.payments(id)).toHaveLength(1);
    // A forgotten key can carry a new action: no idempotency-mismatch.
    expect(await store.apply(id, { type: "card/dismiss", id: "reuse" }, {}, { idempotencyKey: "book-1" })).toMatchObject({ ok: true, replayed: false });
  });

  it("stores only an HMAC of the action as the fingerprint", async () => {
    const id = tenantIds("hmac");
    await seed(id, createDemoState(today));
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    await store.apply(id, { type: "card/dismiss", id: "fp" }, {}, { idempotencyKey: "fp-1" });
    const [row] = await db.$queryRaw<Array<{ fingerprint_hmac: string }>>`SELECT fingerprint_hmac FROM tenant_idempotency WHERE tenant_id = ${id}`;
    expect(row.fingerprint_hmac).toMatch(/^[0-9a-f]{64}$/);
    expect(row.fingerprint_hmac).not.toContain("card/dismiss");
    // Another secret cannot replay the key: the fingerprint no longer matches.
    const other = new PostgresStudioStore({ prisma: db, hmacSecret: randomBytes(32).toString("hex"), sinks: recordingSinks().sinks });
    expect(await other.apply(id, { type: "card/dismiss", id: "fp" }, {}, { idempotencyKey: "fp-1" })).toMatchObject({ ok: false, reason: "idempotency-mismatch" });
  });

  it("writes effects in the apply transaction and delivers each once", async () => {
    const id = tenantIds("effects");
    const { state, deposit } = depositState();
    await seed(id, state);
    const recorder = recordingSinks();
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recorder.sinks });
    const held = await store.apply(id, hold(deposit, slotFor(state, deposit)));
    if (!held.ok) throw new Error("hold refused");
    const pay: DemoAction = { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" };

    // A failure late in the transaction (after the effect rows) rolls everything back.
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION pgs_test_explode() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.key = 'explode' THEN RAISE EXCEPTION 'pgs test failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER pgs_test_explode BEFORE INSERT ON tenant_idempotency FOR EACH ROW EXECUTE FUNCTION pgs_test_explode()`);
    try {
      await expect(store.apply(id, pay, {}, { idempotencyKey: "explode" })).rejects.toThrow();
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER pgs_test_explode ON tenant_idempotency`);
      await db.$executeRawUnsafe(`DROP FUNCTION pgs_test_explode()`);
    }
    expect((await store.load(id))?.version).toBe(held.version);
    expect(await db.$queryRaw`SELECT seq FROM tenant_action WHERE tenant_id = ${id} AND seq > ${held.entry.seq}::bigint`).toEqual([]);
    const rowsBefore = await db.$queryRaw<Array<{ seq: bigint }>>`SELECT seq FROM tenant_effect WHERE tenant_id = ${id} AND kind = 'payment'`;
    expect(rowsBefore).toEqual([]);
    expect(recorder.payments(id)).toHaveLength(0);

    const paid = await store.apply(id, pay, {}, { idempotencyKey: "pay-1" });
    if (!paid.ok) throw new Error("pay refused");
    const rows = await db.$queryRaw<Array<{ seq: bigint; id: string; status: string; attempts: number; delivered: boolean; payload: OutboxEntry }>>`
      SELECT seq, id, status, attempts, delivered_at IS NOT NULL AS delivered, payload FROM tenant_effect
      WHERE tenant_id = ${id} AND kind = 'payment'`;
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].seq)).toBe(paid.entry.seq);
    expect(rows[0]).toMatchObject({ status: "delivered", attempts: 1, delivered: true });
    expect(rows[0].payload.id).toBe(paid.effects.find((e) => e.kind === "payment")!.record.id);
    const deliveries = recorder.delivered.filter((d) => d.tenantId === id && d.effect.kind === "payment");
    expect(deliveries.map((d) => d.id)).toEqual([rows[0].id]);
    expect(deliveries[0]).toMatchObject({ tenantKind: "salon", seq: paid.entry.seq });
    // A replay neither inserts nor delivers again.
    expect(await store.apply(id, pay, {}, { idempotencyKey: "pay-1" })).toMatchObject({ ok: true, replayed: true });
    expect(recorder.payments(id)).toHaveLength(1);
    expect(await db.$queryRaw`SELECT id FROM tenant_effect WHERE tenant_id = ${id} AND kind = 'payment'`).toHaveLength(1);
  });

  it("keeps a failed delivery pending for the poller and still commits", async () => {
    const id = tenantIds("failing-sink");
    const { state, deposit } = depositState();
    await seed(id, state);
    let calls = 0;
    const failing: EffectSink = () => { calls++; throw new Error("provider down"); };
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: { payment: failing, message: failing } });
    const held = await store.apply(id, hold(deposit, slotFor(state, deposit)));
    if (!held.ok) throw new Error("hold refused");
    const paid = await store.apply(id, { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" });
    expect(paid.ok).toBe(true);
    expect(calls).toBeGreaterThan(0);
    const rows = await db.$queryRaw<Array<{ status: string; attempts: number; later: boolean }>>`
      SELECT status, attempts, next_attempt_at > clock_timestamp() AS later FROM tenant_effect WHERE tenant_id = ${id} AND kind = 'payment'`;
    expect(rows).toEqual([{ status: "pending", attempts: 1, later: true }]);
  });

  it("returns null for unknown and expired tenants", async () => {
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    expect(await store.load(tenantIds("nobody"))).toBeNull();
    const expired = tenantIds("sbx-expired");
    await seed(expired, createDemoState(today), "sandbox", Date.now() - 1_000);
    expect(await store.load(expired)).toBeNull();
    expect(await store.apply(expired, { type: "card/dismiss", id: "x" })).toEqual({ ok: false, reason: "not-found" });
    const live = tenantIds("sbx-live");
    await seed(live, createDemoState(today), "sandbox", Date.now() + 60_000);
    expect(await store.load(live)).not.toBeNull();
  });

  it("records the customers an action touches in subject_ids", async () => {
    const id = tenantIds("subjects");
    const state = createDemoState(today);
    await seed(id, state);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recordingSinks().sinks });
    const customer = state.customers[1];
    expect((await store.apply(id, { type: "customer/note", id: customer.id, note: "Prefers mornings" })).ok).toBe(true);
    const rows = await db.$queryRaw<Array<{ seq: bigint }>>`
      SELECT seq FROM tenant_action WHERE tenant_id = ${id} AND subject_ids @> ARRAY[${customer.id}]::text[]`;
    expect(rows.map((r) => Number(r.seq))).toEqual([1]);
  });

  it("serializes two instances on separate connections behind the row lock: one booking wins", async () => {
    const id = tenantIds("lock");
    const state = createDemoState(today);
    await seed(id, state);
    const plain = bookableServices(state).find((s) => s.price > 0)!;
    const slot = slotFor(state, plain);
    const [first, second] = state.customers;
    const one = new PostgresStudioStore({ prisma: client(2), hmacSecret, sinks: recordingSinks().sinks });
    const two = new PostgresStudioStore({ prisma: client(2), hmacSecret, sinks: recordingSinks().sinks });
    const blocker = client(1);
    const watcher = client(1);
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => { locked = resolve; });
    // A third connection holds the row lock until both applies are waiting on it.
    const holding = blocker.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM tenant_state WHERE tenant_id = ${id} FOR UPDATE`;
      locked();
      await released;
    }, { timeout: 15_000 });
    await isLocked;
    const results = Promise.all([
      one.apply(id, { type: "booking/create", customerId: first.id, serviceId: plain.id, ...slot, source: "phone" }),
      two.apply(id, { type: "booking/create", customerId: second.id, serviceId: plain.id, ...slot, source: "phone" }),
    ]);
    let waiting = 0;
    for (let i = 0; i < 100 && waiting < 2; i++) {
      const [row] = await watcher.$queryRaw<Array<{ n: number }>>`
        SELECT count(*)::int AS n FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%FROM tenant_state WHERE tenant_id%FOR UPDATE%'`;
      waiting = row.n;
      if (waiting < 2) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(waiting).toBe(2);
    release();
    await holding;
    const settled = await results;
    expect(settled.filter((r) => r.ok)).toHaveLength(1);
    expect(settled.find((r) => !r.ok)).toMatchObject({ ok: false, reason: "rejected" });
    const after = (await one.load(id))!;
    expect(after.version).toBe(1);
    expect(after.state.bookings.filter((b) => b.status !== "cancelled" && b.staffId === slot.staffId && b.date === slot.date && b.start === slot.start)).toHaveLength(1);
    expect((await two.history(id, { limit: 10 })).entries.map((e) => e.seq)).toEqual([1]);
  });
});

describe("PostgresStudioStore review fixes", () => {
  const sinks = () => recordingSinks().sinks;

  it("hides history once the tenant has expired or its state row is gone", async () => {
    const id = tenantIds("sbx-history");
    let now = Date.now();
    await seed(id, createDemoState(today), "sandbox", now + 60_000);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks(), now: async () => now });
    expect((await store.apply(id, { type: "card/dismiss", id: "h" })).ok).toBe(true);
    expect((await store.history(id, { limit: 10 })).entries).toHaveLength(1);
    now += 120_000;
    expect(await store.load(id)).toBeNull();
    expect(await store.history(id, { limit: 10 })).toEqual({ entries: [], next: null });

    const gone = tenantIds("gone");
    await seed(gone, createDemoState(today));
    const plain = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks() });
    expect((await plain.apply(gone, { type: "card/dismiss", id: "g" })).ok).toBe(true);
    await db.$executeRaw`DELETE FROM tenant_state WHERE tenant_id = ${gone}`;
    expect(await plain.history(gone, { limit: 10 })).toEqual({ entries: [], next: null });
  });

  it("judges booking cutoffs and support grants by the store clock, not the caller's", async () => {
    // 18:00 in the salon on the fixture's day, so the morning has already passed.
    const evening = DateTime.fromISO(`${today}T18:00`, { zone: SALON_TIMEZONE }).toMillis();
    const { state, deposit: service } = depositState();
    // A start that is already past the cutoff at 18:00 (a one-hour lead).
    const morning = service.staffIds.flatMap((staffId) =>
      freeStarts(state, staffId, today, needOf(service)).filter((start) => start <= 16 * 60).map((start) => ({ staffId, start })))[0];
    if (!morning) throw new Error("no free start before the cutoff");
    // The caller claims it is still midnight.
    const late: DemoAction = {
      type: "online/hold", serviceId: service.id, staffId: morning.staffId, date: today, start: morning.start,
      guest: { name: "Fictional Guest", phone: "0700009911", at: { date: today, time: 0 } },
      notice: { title: "Demo request", body: "Demo appointment" },
    };
    const strict = tenantIds("cutoff");
    await seed(strict, state);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks(), now: async () => evening });
    expect(await store.apply(strict, late)).toMatchObject({ ok: false, reason: "rejected" });
    // Only an import that trusts the caller's clock takes the reported time.
    const imported = tenantIds("cutoff-import");
    await seed(imported, state);
    const importer = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks(), now: async () => evening, trustCallerClock: true });
    expect((await importer.apply(imported, late, { at: evening })).ok).toBe(true);

    // A support grant starts now and lasts one hour, whatever `at` the caller sends.
    const grant = await store.apply(strict, { type: "support/grant", hours: 1, at: evening + 30 * 86_400_000 });
    if (!grant.ok) throw new Error("grant refused");
    expect(grant.state.supportGrants[0]).toMatchObject({ grantedAt: evening, until: evening + 3_600_000 });
    expect(grant.entry.action).toMatchObject({ at: evening });
  });

  it("refuses a change whose provider key was already used for a different request", async () => {
    const id = tenantIds("effect-key");
    const { state, deposit } = depositState();
    await seed(id, state);
    const recorder = recordingSinks();
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: recorder.sinks });
    const held = await store.apply(id, hold(deposit, slotFor(state, deposit)));
    if (!held.ok) throw new Error("hold refused");
    const h = held.state.checkoutHolds.at(-1)!;
    // The durable id comes from the full provider key, so plant a row under it with another request's fingerprint.
    const key = `${held.state.salon.slug}-${h.id}-${h.expiresAt}-deposit`;
    const planted = effectId(id, { port: "payments", operation: "checkout", key, request: {}, record: { id: "x", port: "payments", action: "checkout", body: "", cost: null } });
    await db.$executeRaw`
      INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, status)
      VALUES (${id}, 999, 0, ${planted}, 'another-request', 'payment', '{}'::jsonb, 'delivered')`;
    expect(await store.apply(id, { type: "online/pay", id: h.id, method: "card" })).toMatchObject({ ok: false, reason: "rejected" });
    expect((await store.load(id))?.version).toBe(held.version);
    expect(recorder.payments(id)).toHaveLength(0);
    await db.$executeRaw`DELETE FROM tenant_effect WHERE id = ${planted}`;
    const paid = await store.apply(id, { type: "online/pay", id: h.id, method: "card" });
    expect(paid.ok).toBe(true);
    const [row] = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM tenant_effect WHERE tenant_id = ${id} AND kind = 'payment'`;
    expect(row.id).toBe(planted);
  });

  it("indexes customers named in nested and multi-recipient actions", async () => {
    const id = tenantIds("nested-subjects");
    const state = createDemoState(today);
    await seed(id, state);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks() });
    const [first, second, third] = state.customers;
    const sent = await store.apply(id, {
      type: "customers/message",
      texts: [
        { customerId: first.id, title: "Fictional reminder", body: "See you soon at the salon." },
        { customerId: second.id, title: "Fictional reminder", body: "Time for a new visit?" },
      ],
      at: { date: today, time: 9 * 60 },
    });
    expect(sent.ok).toBe(true);
    const subjects = async (customerId: string) => (await db.$queryRaw<Array<{ seq: bigint }>>`
      SELECT seq FROM tenant_action WHERE tenant_id = ${id} AND subject_ids @> ARRAY[${customerId}]::text[]`).map((r) => Number(r.seq));
    expect(await subjects(first.id)).toEqual([1]);
    expect(await subjects(second.id)).toEqual([1]);
    expect(await subjects(third.id)).toEqual([]);
  });

  it("treats resubmitting the loaded booking page as a no-op", async () => {
    const id = tenantIds("page-noop");
    await seed(id, createDemoState(today));
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks() });
    // One commit first, so the page comes back from jsonb with its keys reordered.
    expect((await store.apply(id, { type: "card/dismiss", id: "p" })).ok).toBe(true);
    const loaded = (await store.load(id))!;
    expect(await store.apply(id, { type: "page/set", page: loaded.state.page })).toMatchObject({ ok: false, reason: "rejected" });
    expect((await store.load(id))?.version).toBe(loaded.version);
    expect((await store.history(id, { limit: 10 })).entries).toHaveLength(1);
  });

  it("keeps the 24-hour key window on the store clock, whatever the imported event stamps", async () => {
    const id = tenantIds("key-clock");
    await seed(id, createDemoState(today));
    let now = Date.now();
    const importer = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks(), trustCallerClock: true, now: async () => now });
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks(), now: async () => now });
    // Backdated by 30 hours: the key is still live for a normal retry.
    const backdated = await importer.apply(id, { type: "card/dismiss", id: "old" }, { at: now - 30 * 3_600_000 }, { idempotencyKey: "import-1" });
    expect(backdated.ok).toBe(true);
    expect(await store.apply(id, { type: "card/dismiss", id: "old" }, {}, { idempotencyKey: "import-1" })).toMatchObject({ ok: true, replayed: true });
    // Future-dated by 30 days: later stamps are clamped forward, but keys still expire 24 hours after the clock.
    expect((await importer.apply(id, { type: "card/dismiss", id: "future" }, { at: now + 30 * 86_400_000 })).ok).toBe(true);
    expect((await store.apply(id, { type: "card/dismiss", id: "later" }, {}, { idempotencyKey: "later-1" })).ok).toBe(true);
    expect(await store.apply(id, { type: "card/dismiss", id: "later" }, {}, { idempotencyKey: "later-1" })).toMatchObject({ ok: true, replayed: true });
    now += IDEMPOTENCY_TTL_MS + 1_000;
    expect(await store.apply(id, { type: "card/dismiss", id: "other" }, {}, { idempotencyKey: "later-1" })).toMatchObject({ ok: true, replayed: false });
  });

  it("acknowledges each delivery on its own: an earlier send stays delivered while a later one is in flight", async () => {
    const id = tenantIds("ack");
    const state = createDemoState(today);
    await seed(id, state);
    const [first, second] = state.customers;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const inFlight = new Promise<void>((resolve) => { entered = resolve; });
    let calls = 0;
    const message: EffectSink = async () => {
      calls++;
      if (calls === 2) { entered(); await gate; throw new Error("provider timeout"); }
    };
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: { payment: () => {}, message } });
    const applying = store.apply(id, {
      type: "customers/message",
      texts: [
        { customerId: first.id, title: "Fictional note", body: "First fictional text." },
        { customerId: second.id, title: "Fictional note", body: "Second fictional text." },
      ],
      at: { date: today, time: 9 * 60 },
    });
    await inFlight;
    // Seen from another connection while the second send is still running.
    const during = await db.$queryRaw<Array<{ n: number; status: string }>>`SELECT n, status FROM tenant_effect WHERE tenant_id = ${id} ORDER BY n`;
    expect(during).toEqual([{ n: 0, status: "delivered" }, { n: 1, status: "pending" }]);
    release();
    expect((await applying).ok).toBe(true);
    const after = await db.$queryRaw<Array<{ n: number; status: string }>>`SELECT n, status FROM tenant_effect WHERE tenant_id = ${id} ORDER BY n`;
    expect(after).toEqual([{ n: 0, status: "delivered" }, { n: 1, status: "pending" }]);
  });

  it("never lets a refund overtake the checkout it refunds", async () => {
    const id = tenantIds("order");
    const { state, deposit } = depositState();
    await seed(id, state);
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let entered!: () => void;
    const checkoutInFlight = new Promise<void>((resolve) => { entered = resolve; });
    const payment: EffectSink = async (delivery) => {
      if (delivery.effect.record.action === "checkout") { entered(); await gate; }
      order.push(delivery.effect.record.action);
    };
    const one = new PostgresStudioStore({ prisma: client(2), hmacSecret, sinks: { payment, message: () => {} } });
    const two = new PostgresStudioStore({ prisma: client(2), hmacSecret, sinks: { payment, message: () => {} } });
    // A slot a week out, so cancelling is free and refunds the deposit.
    const weekOut = (() => {
      for (let i = 7; i <= 21; i++) {
        const date = addDays(today, i);
        for (const staffId of deposit.staffIds) {
          const start = freeStarts(state, staffId, date, needOf(deposit))[0];
          if (start !== undefined) return { staffId, date, start };
        }
      }
      throw new Error("no slot a week out");
    })();
    const held = await one.apply(id, hold(deposit, weekOut));
    if (!held.ok) throw new Error("hold refused");
    const paying = one.apply(id, { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" });
    await checkoutInFlight;
    const booking = (await two.load(id))!.state.bookings.find((b) => b.protection?.deposit)!;
    const cancelled = await two.apply(id, { type: "booking/cancel", id: booking.id });
    expect(cancelled.ok && cancelled.effects.map((e) => e.record.action)).toContain("refund");
    // The refund is committed but waits for the checkout acknowledgement.
    expect(order).toEqual([]);
    const [refund] = await db.$queryRaw<Array<{ status: string }>>`SELECT status FROM tenant_effect WHERE tenant_id = ${id} AND payload->>'action' = 'refund'`;
    expect(refund.status).toBe("pending");
    release();
    expect((await paying).ok).toBe(true);
    // The deliverer that finished the checkout carries on with the refund it unblocked.
    expect(order).toEqual(["checkout", "refund"]);
  });

  it("writes activity text in the tenant's language and currency", async () => {
    const id = tenantIds("locale");
    const base = createDemoState(today);
    const state = { ...base, localization: { ...base.localization, language: "sv" as const, currency: "EUR" } };
    await seed(id, state);
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: sinks() });
    const service = state.services.find((s) => s.price > 0)!;
    const changed = await store.apply(id, { type: "service/price", id: service.id, price: service.price + 100 });
    if (!changed.ok) throw new Error("price refused");
    const entry = changed.state.log[0];
    expect(entry.summary).toBe(`Ändrade priset på ${service.name}`);
    expect(entry.after).toContain("€");
    expect(entry.after).not.toMatch(/kr/);
  });

  it("can verify that a role is not able to change the audit log", async () => {
    // Role creation is not possible here (the test role has no CREATEROLE), so the
    // check runs against the connecting role, which owns the tables and must be flagged.
    const sql = readFileSync(new URL("../../prisma/grants/verify-studio-store.sql", import.meta.url), "utf8");
    const [{ role }] = await db.$queryRaw<Array<{ role: string }>>`SELECT current_user::text AS role`;
    const query = sql.replaceAll(":'app_role'", `'${role.replaceAll("'", "''")}'`);
    const problems = await db.$queryRawUnsafe<Array<{ problem: string }>>(query);
    const text = problems.map((p) => p.problem);
    expect(text).toContain("owns tenant_action");
    expect(text).toEqual(expect.arrayContaining(["can UPDATE tenant_action", "can DELETE tenant_action", "can TRUNCATE tenant_action"]));
  });
});
