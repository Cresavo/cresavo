import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { salonClock } from "@/concept/tools/clock";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import { sweepActivityPersonalData, sweepJournalAccessRows, sweepOutboxBodies, sweepRateLimits } from "@/concept/store/store-sweepers";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { withOwnSlug } from "./own-slug";
import { installStoreFunctions } from "./store-functions";

// The retention sweeps (src/concept/privacy/retention.ts) and the journal read
// log against a disposable local database. The tables are cloned into a private
// schema, so the sweeps only see this test's rows. Every clock is fixed.

const setupDb = createDatabaseClient();
const schema = `store_retention_${randomUUID().replaceAll("-", "")}`;
const connection = new URL(process.env.DATABASE_URL!);
connection.searchParams.set("options", `${connection.searchParams.get("options") ?? ""} -c search_path=${schema}`.trim());
const db = createDatabaseClient(connection.href);
const tables = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect", `"RateLimitBucket"`];
let schemaCreated = false;
const hmacSecret = randomBytes(32).toString("hex");

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
const now = async () => NOW;
const DAY = 86_400_000;
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

beforeAll(async () => {
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    for (const table of tables) await tx.$executeRawUnsafe(`CREATE TABLE ${schema}.${table} (LIKE ${table} INCLUDING ALL)`);
  });
  schemaCreated = true;
  await installStoreFunctions(schema);
});

afterEach(async () => {
  if (schemaCreated) await db.$executeRawUnsafe(`TRUNCATE tenant_state, tenant_action, tenant_effect, tenant_idempotency, "RateLimitBucket"`);
});

afterAll(async () => {
  try {
    await db.$disconnect();
    if (schemaCreated) await setupDb.$executeRawUnsafe(`DROP SCHEMA ${schema} CASCADE`);
  } finally {
    await setupDb.$disconnect();
  }
});

async function action(tenantId: string, seq: number, when: number, body: unknown, key: string | null = null, redacted = false) {
  await db.$executeRaw`
    INSERT INTO tenant_action (tenant_id, seq, action, actor, source, at, idempotency_key, resulting_version, subject_ids, redacted_at)
    VALUES (${tenantId}, ${seq}, ${JSON.stringify(body)}::jsonb, 'owner', 'button', ${at(when)}::timestamptz, ${key}, ${seq}, ARRAY[]::text[],
      ${redacted ? at(when) : null}::timestamptz)`;
}

async function effect(tenantId: string, seq: number, kind: string, status: string, payload: unknown) {
  await db.$executeRaw`
    INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, status, next_attempt_at)
    VALUES (${tenantId}, ${seq}, 0, ${`${tenantId}-${seq}-${randomUUID()}`}, 'f', ${kind}, ${JSON.stringify(payload)}::jsonb, ${status}, ${at(0)}::timestamptz)`;
}

const rows = async (table: "tenant_effect" | "tenant_action") =>
  (await db.$queryRawUnsafe<Array<{ seq: bigint; payload?: Record<string, unknown>; action?: Record<string, unknown>; key?: string | null; redacted?: boolean }>>(
    table === "tenant_effect"
      ? "SELECT seq, payload FROM tenant_effect ORDER BY seq"
      : "SELECT seq, action, idempotency_key AS key, redacted_at IS NOT NULL AS redacted FROM tenant_action ORDER BY seq")).map((row) => ({ ...row, seq: Number(row.seq) }));

const mail = { port: "email", action: "send", to: "lena@example.test", subject: "Your visit", body: "Hello Lena, your visit is on Friday.", cost: null, delivery: { sent: true, mail: { subject: "Your visit", text: "Hello Lena", html: "<p>Hello Lena</p>" } } };

describe("sweepRateLimits", () => {
  it("deletes rows that expired more than a day before the fixed clock, in batches", async () => {
    for (const [key, offset] of [["a", -3 * DAY], ["b", -2 * DAY], ["c", -DAY - 1000], ["edge", -DAY], ["recent", -12 * 3_600_000], ["live", 15 * 60_000]] as const) {
      await db.$executeRaw`INSERT INTO "RateLimitBucket" ("key", "generation", "expiresAt", "count") VALUES (${key}, 'g', ${at(offset)}::timestamptz, 1)`;
    }
    expect(await sweepRateLimits({ prisma: db, now, batch: 2 })).toBe(3);
    expect((await db.$queryRawUnsafe<Array<{ key: string }>>(`SELECT "key" FROM "RateLimitBucket" ORDER BY "key"`)).map((r) => r.key)).toEqual(["edge", "live", "recent"]);
    expect(await sweepRateLimits({ prisma: db, now, batch: 2 })).toBe(0);
    // A day and a second later the edge row goes too.
    expect(await sweepRateLimits({ prisma: db, now: async () => NOW + 1000 })).toBe(1);
  });
});

describe("sweepOutboxBodies", () => {
  it("blanks body, subject and address of settled messages older than 90 days and nothing else", async () => {
    const t = "tenant-outbox";
    for (const [seq, when] of [[1, -100 * DAY], [2, -10 * DAY], [3, -100 * DAY], [4, -100 * DAY], [5, -100 * DAY], [6, -100 * DAY], [7, -90 * DAY - 1000], [8, -89 * DAY]] as const) {
      await action(t, seq, when, { type: "booking/create" });
    }
    await effect(t, 1, "message", "delivered", mail);
    await effect(t, 2, "message", "delivered", mail);
    await effect(t, 3, "message", "pending", mail);
    await effect(t, 4, "payment", "delivered", { port: "payments", action: "collect", body: "Deposit Lena", reference: "dep-1", cost: null });
    await effect(t, 5, "message", "failed", { port: "sms", action: "send", to: "customer:k-lena", body: "Hi Lena", reference: "r", cost: null });
    await effect(t, 6, "message", "cancelled", { port: "sms", action: "send", to: "customer:k-1, customer:k-2", body: "Hi both", cost: null });
    await effect(t, 7, "message", "delivered", { port: "sms", action: "send", to: "+46700001111", body: "Call me", cost: null });
    await effect(t, 8, "message", "delivered", mail);

    expect(await sweepOutboxBodies({ prisma: db, now, batch: 2 })).toBe(4);
    const bySeq = Object.fromEntries((await rows("tenant_effect")).map((r) => [r.seq, r.payload!]));
    // The stored copy of the mail goes; the outcome stays for reconciliation.
    expect(bySeq[1]).toEqual({ port: "email", action: "send", to: "[redacted]", subject: "[redacted]", body: "[redacted]", cost: null, delivery: { sent: true } });
    expect(bySeq[2]).toEqual(mail);
    expect(bySeq[3]).toEqual(mail);
    expect(bySeq[4]).toMatchObject({ body: "Deposit Lena", reference: "dep-1" });
    // An opaque customer reference stays; a phone number or address does not.
    expect(bySeq[5]).toEqual({ port: "sms", action: "send", to: "customer:k-lena", body: "[redacted]", reference: "r", cost: null });
    expect(bySeq[6]).toMatchObject({ to: "customer:k-1, customer:k-2", body: "[redacted]" });
    expect(bySeq[7]).toMatchObject({ to: "[redacted]", body: "[redacted]" });
    expect(bySeq[8]).toEqual(mail);
    expect(JSON.stringify([bySeq[1], bySeq[5], bySeq[6], bySeq[7]])).not.toMatch(/Lena|Call me|lena@/);
    // Safe to run again: nothing is left to do.
    expect(await sweepOutboxBodies({ prisma: db, now })).toBe(0);
    // Three months later the rest follow.
    expect(await sweepOutboxBodies({ prisma: db, now: async () => NOW + 90 * DAY })).toBe(2);
  });

  it("finishes a row whose body was blanked but whose subject, address or mail copy was not, and keeps an uncertain send's reason", async () => {
    const t = "tenant-partial";
    for (const seq of [1, 2]) await action(t, seq, -100 * DAY, { type: "booking/create" });
    await effect(t, 1, "message", "delivered", { port: "email", action: "send", to: "lena@example.test", subject: "Your visit", body: "[redacted]", cost: null });
    await effect(t, 2, "message", "failed", { port: "email", action: "send", to: "customer:k-1", body: "[redacted]", cost: null, delivery: { reason: "uncertain", dispatched: true, mail: { subject: "s", text: "Hello Lena", html: "<p>Hello Lena</p>" } } });
    expect(await sweepOutboxBodies({ prisma: db, now })).toBe(2);
    const bySeq = Object.fromEntries((await rows("tenant_effect")).map((r) => [r.seq, r.payload!]));
    expect(bySeq[1]).toMatchObject({ to: "[redacted]", subject: "[redacted]", body: "[redacted]" });
    expect(bySeq[2]).toEqual({ port: "email", action: "send", to: "customer:k-1", body: "[redacted]", cost: null, delivery: { reason: "uncertain", dispatched: true } });
    expect(await sweepOutboxBodies({ prisma: db, now })).toBe(0);
  });

  it("uses the commit time of the action, so a retry that moved the due time does not keep a body alive", async () => {
    await action("tenant-retry", 1, -120 * DAY, { type: "booking/create" });
    await db.$executeRaw`
      INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, status, next_attempt_at, delivered_at)
      VALUES ('tenant-retry', 1, 0, ${randomUUID()}, 'f', 'message', ${JSON.stringify(mail)}::jsonb, 'delivered', ${at(-1 * DAY)}::timestamptz, ${at(-1 * DAY)}::timestamptz)`;
    expect(await sweepOutboxBodies({ prisma: db, now })).toBe(1);
  });
});

describe("sweepActivityPersonalData", () => {
  it("redacts the personal fields of audit rows older than 13 months, once, and clears the key column", async () => {
    const t = "tenant-activity";
    const old = -14 * 30 * DAY;
    await action(t, 1, old, { type: "customer/note", id: "k-1", note: "Fictional private note" }, "owner:lena@example.test-1");
    await action(t, 2, old, { type: "online/book", guest: { name: "Lena Aktivitet", phone: "0700003333", email: "lena@example.test" }, serviceId: "s-1", staffId: "anna", date: "2026-01-02", start: 600, notice: { title: "Lena", body: "Hi", kind: "request" } });
    await action(t, 3, old, { type: "customer/update", id: "k-1", patch: { phone: "070 000 44 44", firstName: "Lena" } });
    await action(t, 4, -30 * DAY, { type: "customer/note", id: "k-1", note: "Recent note" });
    await action(t, 5, old, { type: "card/dismiss", id: "welcome" }, "key-5");
    await action(t, 6, old, { type: "customer/note", id: "k-2", note: "Already erased" }, null, true);
    // Four rows are redacted (1, 2, 3 and 6, which had a partial erasure) and two old keys cleared (rows 1 and 5, a type without personal fields).
    expect(await sweepActivityPersonalData({ prisma: db, now, batch: 2 })).toBe(6);
    const bySeq = Object.fromEntries((await rows("tenant_action")).map((r) => [r.seq, r]));
    expect(bySeq[1].action).toEqual({ type: "customer/note", id: "k-1", note: "[redacted]", retentionRedacted: true });
    expect(bySeq[1].key).toBeNull();
    expect(bySeq[1].redacted).toBe(true);
    expect(bySeq[2].action).toMatchObject({ type: "online/book", guest: { name: "[redacted]", phone: "[redacted]", email: "[redacted]" }, serviceId: "s-1", date: "2026-01-02", notice: { title: "[redacted]", body: "[redacted]", kind: "request" } });
    expect(bySeq[3].action).toEqual({ type: "customer/update", id: "k-1", patch: { phone: "[redacted]", firstName: "[redacted]" }, retentionRedacted: true });
    expect(bySeq[4].action).toMatchObject({ note: "Recent note" });
    expect(bySeq[4].redacted).toBe(false);
    // A key can embed an address whatever the action was; this row has no personal fields, so only the key goes.
    expect(bySeq[5]).toMatchObject({ key: null, redacted: false });
    expect(bySeq[5].action).toEqual({ type: "card/dismiss", id: "welcome" });
    // A partial erasure set `redacted_at` earlier; the age-based redaction still runs on the row.
    expect(bySeq[6].action).toEqual({ type: "customer/note", id: "k-2", note: "[redacted]", retentionRedacted: true });
    expect(await sweepActivityPersonalData({ prisma: db, now })).toBe(0);
    // A year later the recent note follows.
    expect(await sweepActivityPersonalData({ prisma: db, now: async () => NOW + 13 * 30 * DAY })).toBe(1);
  });

  it("deletes the audit copies of journal reads after 24 months", async () => {
    const t = "tenant-views";
    await action(t, 1, -25 * 30 * DAY, { type: "journal/view", customerId: "k-1", actor: "owner" });
    await action(t, 2, -23 * 30 * DAY, { type: "journal/view", customerId: "k-1", actor: "owner" });
    await action(t, 3, -25 * 30 * DAY, { type: "customer/note", id: "k-1", note: "kept for the other sweep" });
    expect(await sweepJournalAccessRows({ prisma: db, now, batch: 1 })).toBe(1);
    expect((await rows("tenant_action")).map((r) => r.seq)).toEqual([2, 3]);
    expect(await sweepJournalAccessRows({ prisma: db, now })).toBe(0);
  });
});

describe("journal reads on the Postgres store", () => {
  it("records who and which customer, never the content, and does not log a repeat", async () => {
    const day = salonClock().today;
    const state = createDemoState(day);
    const tenantId = `tenant-${randomUUID()}`;
    await db.$executeRaw`INSERT INTO tenant_state (tenant_id, kind, doc) VALUES (${tenantId}, 'salon', ${JSON.stringify(withOwnSlug(state, tenantId))}::jsonb)`;
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: { payment() {}, message() {} }, now });
    try {
      const customer = state.customers[0];
      expect(await store.apply(tenantId, { type: "journal/view", customerId: customer.id, actor: "owner" }, { actor: "owner", source: "button" })).toMatchObject({ ok: true, version: 1 });
      // Within a minute: the reducer returns the same state, which the store refuses as no change.
      expect(await store.apply(tenantId, { type: "journal/view", customerId: customer.id, actor: "owner" })).toMatchObject({ ok: false, reason: "rejected" });
      // The load of the whole salon is a read of every journal, logged without a customer.
      expect(await store.apply(tenantId, { type: "journal/view", actor: "owner" })).toMatchObject({ ok: true, version: 2 });
      // A second load within ten minutes is refused as a repeat, with no detail (the load route serves it); a full document would carry one.
      const loaded = (await store.load(tenantId))!.state;
      expect(loaded.journalAccess).toEqual([
        { id: expect.any(String), at: NOW, actor: "owner" },
        { id: expect.any(String), at: NOW, actor: "owner", customerId: customer.id },
      ]);
      expect(loaded.log).toEqual(state.log);
      const history = (await store.history(tenantId, { limit: 10 })).entries;
      expect(history.map((entry) => entry.action)).toEqual([
        { type: "journal/view", customerId: customer.id, actor: "owner" },
        { type: "journal/view", actor: "owner" },
      ]);
      expect(JSON.stringify(history)).not.toMatch(/treatment|observations|advice/);
    } finally {
      store.close();
    }
  });

  it("redacts a corrected phone number from the audit log when the customer is erased", async () => {
    const state = createDemoState(salonClock().today);
    const tenantId = `tenant-${randomUUID()}`;
    await db.$executeRaw`INSERT INTO tenant_state (tenant_id, kind, doc) VALUES (${tenantId}, 'salon', ${JSON.stringify(withOwnSlug(state, tenantId))}::jsonb)`;
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: { payment() {}, message() {} }, now });
    try {
      const customer = state.customers[0];
      const patch = { phone: "070 123 99 88", email: "corrected.address@example.test", firstName: "Korrigerad" };
      expect(await store.apply(tenantId, { type: "customer/update", id: customer.id, patch })).toMatchObject({ ok: true });
      expect(JSON.stringify(await rows("tenant_action"))).toContain("corrected.address@example.test");
      expect(await store.eraseSubject(tenantId, customer.id)).toMatchObject({ ok: true });
      const text = JSON.stringify(await rows("tenant_action"));
      for (const secret of ["corrected.address@example.test", "070 123 99 88", "Korrigerad"]) expect(text, secret).not.toContain(secret);
      expect((await store.load(tenantId))!.state.customers.some((c) => c.id === customer.id)).toBe(false);
    } finally {
      store.close();
    }
  });
});

describe("erasure and stored replays", () => {
  it("answers another customer's retry identically after an erasure, and never runs a retry of the erased customer's change again", async () => {
    const state = createDemoState(salonClock().today);
    const [a, b] = state.customers;
    const tenantId = `tenant-${randomUUID()}`;
    await db.$executeRaw`INSERT INTO tenant_state (tenant_id, kind, doc) VALUES (${tenantId}, 'salon', ${JSON.stringify(withOwnSlug(state, tenantId))}::jsonb)`;
    const store = new PostgresStudioStore({ prisma: db, hmacSecret, sinks: { payment() {}, message() {} }, now });
    try {
      const keyOfA = `studio:note-${a.email}`;
      const first = await store.apply(tenantId, { type: "customer/note", id: b.id, note: "Fictional note for B" }, {}, { idempotencyKey: "b-key" });
      const own = await store.apply(tenantId, { type: "customer/note", id: a.id, note: "Fictional note for A" }, {}, { idempotencyKey: keyOfA });
      if (!first.ok || !own.ok) throw new Error("fixture refused");

      expect(await store.eraseSubject(tenantId, a.id)).toMatchObject({ ok: true });
      const version = (await store.load(tenantId))!.version;

      // B's retry: the same answer (version, entry), flagged as a replay, with nothing of A in it.
      const again = await store.apply(tenantId, { type: "customer/note", id: b.id, note: "Fictional note for B" }, {}, { idempotencyKey: "b-key" });
      expect(again).toMatchObject({ ok: true, replayed: true, version: first.version });
      if (!again.ok) throw new Error("replay refused");
      expect(again.entry.seq).toBe(first.entry.seq);
      expect(again.state.customers.some((c) => c.id === a.id)).toBe(false);
      expect(JSON.stringify(again)).not.toContain(a.email);

      // A's key held their address: it is stored under its hash, and a retry under the same key is still recognised, never applied again.
      const keys = (await db.$queryRawUnsafe<Array<{ key: string }>>("SELECT key FROM tenant_idempotency WHERE tenant_id = $1", tenantId)).map((r) => r.key);
      expect(keys.some((key) => key.includes(a.email))).toBe(false);
      expect(keys.some((key) => key.startsWith("erased-"))).toBe(true);
      // The stored action of A's own entry lost its personal field, though the text names nobody.
      const stored = await db.$queryRawUnsafe<Array<{ result: { entry: { action: { note?: string } } } }>>("SELECT result FROM tenant_idempotency WHERE tenant_id = $1 AND key LIKE 'erased-%'", tenantId);
      expect(stored[0].result.entry.action.note).toBe("[redacted]");
      const retryA = await store.apply(tenantId, { type: "customer/note", id: a.id, note: "Fictional note for A" }, {}, { idempotencyKey: keyOfA });
      expect(retryA).toMatchObject({ ok: true, replayed: true });
      expect((await store.load(tenantId))!.version).toBe(version);
    } finally {
      store.close();
    }
  });
});

