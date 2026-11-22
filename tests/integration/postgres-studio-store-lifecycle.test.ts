import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";
import { salonClock } from "@/concept/tools/clock";
import { databaseClock, drainPendingEffects, type EffectDelivery, type TenantKind } from "@/concept/store/effect-outbox";
import { DEMO_TENANT_ID, PostgresStudioStore, type PostgresStudioStoreOptions } from "@/concept/store/postgres-studio-store";
import { MAX_DOCUMENT_BYTES } from "@/concept/store/store-metrics";
import { sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes } from "@/concept/store/store-sweepers";
import type { StoreChange } from "@/concept/store/studio-store";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { withOwnSlug } from "./own-slug";

const setupDb = createDatabaseClient();
const schema = `studio_lifecycle_${randomUUID().replaceAll("-", "")}`;
const connection = new URL(process.env.DATABASE_URL!);
const connectionOptions = connection.searchParams.get("options") ?? "";
connection.searchParams.set("options", `${connectionOptions} -c search_path=${schema}`.trim());
const db = createDatabaseClient(connection.href);
const secondDb = createDatabaseClient(connection.href);
const tables = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"];
let schemaCreated = false;
const hmacSecret = randomBytes(32).toString("hex");
const day = salonClock().today;
const stores: PostgresStudioStore[] = [];

beforeAll(async () => {
  // All maintenance queries resolve only the cloned tables, even on a reused database.
  await setupDb.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
    for (const table of tables) {
      await tx.$executeRawUnsafe(`CREATE TABLE ${schema}.${table} (LIKE ${table} INCLUDING ALL)`);
    }
  });
  schemaCreated = true;
});

function store(options: Partial<PostgresStudioStoreOptions> = {}) {
  const instance = new PostgresStudioStore({
    prisma: db, hmacSecret, listenerConnectionString: connection.href, sinks: { payment() {}, message() {} }, ...options,
  });
  stores.push(instance);
  return instance;
}

async function seed(kind: TenantKind = "salon", state: DemoState = createDemoState(day), id: string = randomUUID()) {
  const kinds = { salon: Prisma.sql`'salon'`, demo: Prisma.sql`'demo'`, sandbox: Prisma.sql`'sandbox'` };
  await db.$executeRaw`
    INSERT INTO tenant_state (tenant_id, kind, doc)
    VALUES (${id}, ${kinds[kind]}, ${JSON.stringify(withOwnSlug(state, id))}::jsonb)`;
  return id;
}

afterEach(async () => {
  for (const instance of stores.splice(0)) instance.close();
  if (schemaCreated) await db.$executeRaw`TRUNCATE tenant_state, tenant_action, tenant_effect, tenant_idempotency`;
});

afterAll(async () => {
  try {
    await Promise.all([db.$disconnect(), secondDb.$disconnect()]);
    if (schemaCreated) await setupDb.$executeRawUnsafe(`DROP SCHEMA ${schema} CASCADE`);
  } finally {
    await setupDb.$disconnect();
  }
});

const dismiss = (id: string): DemoAction => ({ type: "card/dismiss", id });

describe("Postgres studio change notifications", () => {
  it("delivers committed versions across separate clients and skips the sender's echo", async () => {
    const tenantId = await seed();
    const otherId = await seed();
    const writer = store();
    const reader = store({ prisma: secondDb });
    const local: StoreChange[] = [];
    const remote: StoreChange[] = [];
    const other: StoreChange[] = [];
    writer.subscribe(tenantId, (change) => local.push(change));
    const unsubscribe = reader.subscribe(tenantId, (change) => remote.push(change));
    reader.subscribe(otherId, (change) => other.push(change));
    await expect.poll(() => writer.notificationsReady && reader.notificationsReady).toBe(true);

    expect(await writer.apply(tenantId, dismiss("first"))).toMatchObject({ ok: true, version: 1 });
    await expect.poll(() => remote).toEqual([{ tenantId, version: 1, effects: [] }]);
    expect(await reader.load(tenantId)).toMatchObject({ version: 1 });
    unsubscribe();

    expect(await writer.apply(tenantId, dismiss("second"))).toMatchObject({ ok: true, version: 2 });
    expect(await writer.apply(otherId, dismiss("different"))).toMatchObject({ ok: true, version: 1 });
    await expect.poll(() => other).toEqual([{ tenantId: otherId, version: 1, effects: [] }]);
    expect(remote).toHaveLength(1);
    expect(local.map((change) => [change.version, change.entry?.action])).toEqual([[1, dismiss("first")], [2, dismiss("second")]]);
  });

  it("reconnects its dedicated listener after PostgreSQL terminates it", async () => {
    const tenantId = await seed();
    const applicationName = `studio-listener-${randomUUID()}`;
    const listenerConnection = new URL(connection);
    listenerConnection.searchParams.set("application_name", applicationName);
    const writer = store();
    const reader = store({ prisma: secondDb, listenerConnectionString: listenerConnection.href });
    const versions: number[] = [];
    const refreshes: Array<ReturnType<typeof reader.load>> = [];
    const unsubscribe = reader.subscribe(tenantId, (change) => versions.push(change.version), {
      onRefresh: () => { refreshes.push(reader.load(tenantId)); },
    });
    const listenerPid = async () => {
      const [row] = await db.$queryRaw<Array<{ pid: number }>>`
        SELECT pid FROM pg_stat_activity WHERE application_name = ${applicationName}`;
      return row?.pid;
    };
    await expect.poll(() => reader.notificationsReady).toBe(true);
    expect(refreshes).toHaveLength(1);
    expect(await refreshes[0]).toMatchObject({ version: 0 });
    const pid = (await listenerPid())!;
    await writer.apply(tenantId, dismiss("before"));
    await expect.poll(() => versions).toEqual([1]);
    expect(await db.$queryRaw`SELECT pg_terminate_backend(${pid}::int) AS terminated`).toEqual([{ terminated: true }]);
    await expect.poll(async () => {
      const connected = await listenerPid();
      return reader.notificationsReady && connected !== undefined && connected !== pid;
    }).toBe(true);
    expect(refreshes).toHaveLength(2);
    expect(await refreshes[1]).toMatchObject({ version: 1 });
    await writer.apply(tenantId, dismiss("after"));
    await expect.poll(() => versions).toEqual([1, 2]);
    unsubscribe();
    await expect.poll(listenerPid).toBeUndefined();
  });
});

describe("Postgres studio retention and lifecycle", () => {
  it("sweeps expired idempotency rows in batches and preserves current keys", async () => {
    const tenantId = await seed();
    const writer = store();
    for (const key of ["expired-1", "expired-2", "current"]) {
      expect(await writer.apply(tenantId, dismiss(key), {}, { idempotencyKey: key })).toMatchObject({ ok: true });
    }
    await db.$executeRaw`
      UPDATE tenant_idempotency SET expires_at = clock_timestamp() - interval '1 second'
      WHERE tenant_id = ${tenantId} AND key LIKE 'expired-%'`;
    expect(await sweepExpiredIdempotency({ prisma: db, batch: 1 })).toBe(2);
    expect(await sweepExpiredIdempotency({ prisma: db, batch: 1 })).toBe(0);
    expect(await writer.apply(tenantId, dismiss("current"), {}, { idempotencyKey: "current" })).toMatchObject({ ok: true, replayed: true });
    expect(await writer.apply(tenantId, dismiss("reuse"), {}, { idempotencyKey: "expired-1" })).toMatchObject({ ok: true, replayed: false });
  });

  it("replaces state through a privileged system action and preserves its counter", async () => {
    const fixture = createDemoState(day);
    const tenantId = await seed("salon", { ...fixture, seq: 123 });
    const writer = store();
    const remote = store({ prisma: secondDb });
    const versions: number[] = [];
    remote.subscribe(tenantId, (change) => versions.push(change.version));
    await expect.poll(() => remote.notificationsReady).toBe(true);
    expect(() => writer.replaceState(tenantId, fixture, { actor: "system", reason: "" })).toThrow(RangeError);
    expect(await writer.replaceState(tenantId, fixture, { actor: "system", reason: "Restore fixture" }))
      .toEqual({ ok: true, changed: true, version: 1 });
    expect(await writer.load(tenantId)).toMatchObject({ state: { seq: 123 }, version: 1 });
    expect((await writer.history(tenantId, { limit: 10 })).entries).toMatchObject([
      { seq: 1, actor: "system", source: "system", action: { type: "system/replace", payload: { reason: "Restore fixture" } } },
    ]);
    await expect.poll(() => versions).toEqual([1]);
  });

  it("resets only the demo once a day and keeps sequence numbers after old demo rows are purged", async () => {
    const oldDay = addDays(day, -1);
    const fixture = createDemoState(oldDay);
    const id = await seed("demo", { ...fixture, seq: 42 }, DEMO_TENANT_ID);
    const salon = await seed("salon", fixture);
    const sandbox = await seed("sandbox", fixture);
    const writer = store();
    const reader = store({ prisma: secondDb });
    for (const tenantId of [id, salon, sandbox]) {
      expect(await writer.apply(tenantId, dismiss("edited"))).toMatchObject({ ok: true, version: 1 });
    }
    await db.$executeRaw`
      UPDATE tenant_action SET at = clock_timestamp() - interval '8 days'
      WHERE tenant_id = ANY(${[id, salon, sandbox]}::text[])`;
    expect(await sweepDemoActions({ prisma: db, batch: 1 })).toBe(1);
    expect((await writer.history(id, { limit: 10 })).entries).toEqual([]);

    const requests = await Promise.all([writer.resetDemoTenant({ generatedFor: day }), reader.resetDemoTenant({ generatedFor: day })]);
    expect(requests).toEqual(expect.arrayContaining([
      { ok: true, changed: true, version: 2 }, { ok: true, changed: false, version: 2 },
    ]));
    expect(await writer.load(id)).toMatchObject({ version: 2, state: { seq: 42, generatedFor: day, dismissedCards: [] } });
    expect((await writer.history(id, { limit: 10 })).entries).toMatchObject([
      { seq: 2, actor: "system", action: { type: "system/reset", payload: { generatedFor: day } }, resultingVersion: 2 },
    ]);
    expect(await writer.apply(id, dismiss("after-reset"))).toMatchObject({ ok: true, entry: { seq: 3 }, version: 3 });
    expect(await reader.resetDemoTenant({ generatedFor: oldDay })).toEqual({ ok: true, changed: false, version: 3 });
    expect(await writer.load(id)).toMatchObject({ version: 3, state: { generatedFor: day, dismissedCards: ["after-reset"] } });
    expect((await writer.history(id, { limit: 10 })).entries.map(({ seq }) => seq)).toEqual([2, 3]);
    for (const tenantId of [salon, sandbox]) {
      expect(await writer.load(tenantId)).toMatchObject({ version: 1, state: { generatedFor: oldDay, dismissedCards: ["edited"] } });
      expect((await writer.history(tenantId, { limit: 10 })).entries).toHaveLength(1);
    }
    await db.$executeRaw`UPDATE tenant_state SET kind = 'salon' WHERE tenant_id = ${id}`;
    expect(await writer.resetDemoTenant({ generatedFor: addDays(day, 1) })).toEqual({ ok: false, reason: "not-found" });
  });

  it("opens a sandbox on its first committed write, simulates its effects and sweeps its four tables", async () => {
    const live: EffectDelivery[] = [];
    const simulated: EffectDelivery[] = [];
    const receiveLive = (item: EffectDelivery) => { live.push(item); };
    const receiveSimulated = (item: EffectDelivery) => { simulated.push(item); };
    const sinks = { message: receiveLive, payment: receiveLive };
    const simulatedSinks = { message: receiveSimulated, payment: receiveSimulated };
    const writer = store({ sinks, simulatedSinks });
    const reader = store({ prisma: secondDb, sinks, simulatedSinks, deliverAfterCommit: false });
    const token = randomUUID();
    const sandbox = writer.openSandboxTenant(token);
    const duplicate = reader.openSandboxTenant(token);
    expect(await sandbox.load()).toBeNull();
    expect(await sandbox.apply({ type: "service/price", id: "missing", price: 90 })).toMatchObject({ ok: false, reason: "rejected" });
    expect(await sandbox.load()).toBeNull();

    const before = await databaseClock(db);
    const results = await Promise.all([sandbox.apply(dismiss("first")), duplicate.apply(dismiss("second"))]);
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ ok: true, version: 1 }), expect.objectContaining({ ok: true, version: 2 }),
    ]));
    const loaded = (await sandbox.load())!;
    const id = loaded.tenantId;
    const tokenPrefix = `sbx_${createHash("sha256").update(token).digest("hex").slice(0, 32)}_`;
    expect(id.startsWith(tokenPrefix)).toBe(true);
    expect(await duplicate.load()).toMatchObject({ tenantId: id });
    for (const result of results) expect(result).toMatchObject({ entry: { tenantId: id } });
    const [row] = await db.$queryRaw<Array<{ kind: TenantKind; expires: number }>>`
      SELECT kind::text, (extract(epoch FROM expires_at) * 1000)::float8 AS expires FROM tenant_state WHERE tenant_id = ${id}`;
    expect(row.kind).toBe("sandbox");
    expect(row.expires).toBeGreaterThanOrEqual(before + 86_400_000);
    const after = await databaseClock(db);
    expect(row.expires).toBeLessThanOrEqual(after + 86_400_000);
    const fixtureDay = loaded.state.generatedFor;
    expect([salonClock(new Date(before)).today, salonClock(new Date(after)).today]).toContain(fixtureDay);
    expect(loaded.state.bookings).toEqual(JSON.parse(JSON.stringify(createDemoState(fixtureDay).bookings)));
    const text: DemoAction = {
      type: "customers/message",
      texts: [{ customerId: loaded.state.customers[0].id, title: "Fictional reminder", body: "Have a good day." }],
      at: { date: fixtureDay, time: 9 * 60 },
    };
    expect(await writer.apply(id, text, {}, { expectedVersion: loaded.version, idempotencyKey: "send" })).toMatchObject({ ok: true, version: 3 });
    expect(simulated).toHaveLength(1);
    expect(simulated[0]).toMatchObject({ tenantKind: "sandbox" });
    expect(await duplicate.apply({ ...text, at: { date: fixtureDay, time: 9 * 60 + 1 } }))
      .toMatchObject({ ok: true, version: 4 });
    await db.$executeRaw`UPDATE tenant_state SET expires_at = clock_timestamp() - interval '1 second' WHERE tenant_id = ${id}`;
    expect(await writer.load(id)).toBeNull();
    expect(await writer.history(id, { limit: 10 })).toEqual({ entries: [], next: null });
    expect(await duplicate.apply(dismiss("expired"))).toEqual({ ok: false, reason: "not-found" });
    expect(await drainPendingEffects({ prisma: db, sinks, simulatedSinks, tenants: [id] })).toEqual({ delivered: 0, retried: 0, failed: 0 });
    expect(live).toEqual([]);
    expect(simulated).toHaveLength(1);
    expect(await sweepExpiredSandboxes({ prisma: db, batch: 1 })).toEqual({ tenants: 1, actions: 4, effects: 2, idempotencyKeys: 1 });
    expect(await sweepExpiredSandboxes({ prisma: db, batch: 1 })).toEqual({ tenants: 0, actions: 0, effects: 0, idempotencyKeys: 0 });

    const reopened = reader.openSandboxTenant(token);
    expect(await reopened.apply(dismiss("stale-bootstrap"), {}, { expectedVersion: 1 })).toEqual({ ok: false, reason: "conflict" });
    expect(await reopened.load()).toBeNull();
    const recreated = await reopened.apply(dismiss("fresh"), {}, { expectedVersion: 0 });
    if (!recreated.ok) throw new Error("Sandbox recreation refused");
    const newId = recreated.entry.tenantId;
    expect(newId).not.toBe(id);
    expect(recreated).toMatchObject({ version: 1, entry: { seq: 1 } });
    expect(await writer.apply(id, dismiss("stale"), {}, { expectedVersion: 1 })).toEqual({ ok: false, reason: "not-found" });
    expect(await sandbox.apply(dismiss("stale"), {}, { expectedVersion: 1 })).toEqual({ ok: false, reason: "conflict" });
    expect(await writer.history(id, { after: 1, limit: 10 })).toEqual({ entries: [], next: null });
    expect(await reader.history(newId, { limit: 10 })).toMatchObject({ entries: [{ tenantId: newId, seq: 1 }] });
    expect(await reopened.load()).toMatchObject({ tenantId: newId, version: 1, state: { dismissedCards: ["fresh"] } });
  });
});

describe("Postgres studio metrics", () => {
  it("records commit samples and refuses an oversized UTF-8 document without writing", async () => {
    const fixture = createDemoState(day);
    const tenantId = await seed("salon", fixture);
    const writer = store({ deliverAfterCommit: false });
    const options = { idempotencyKey: "stable" };
    const committed = await writer.apply(tenantId, dismiss("committed"), {}, options);
    if (!committed.ok) throw new Error("Fixture update refused");
    const metrics = writer.store_metrics();
    expect(metrics).toMatchObject({
      commits: 1, sizeRefusals: 0, documentBytes: Buffer.byteLength(JSON.stringify(committed.state)), bookings: fixture.bookings.length,
    });
    expect(metrics.applyDurationMs).toBeGreaterThan(0);
    expect(await writer.apply(tenantId, dismiss("committed"), {}, options)).toMatchObject({ ok: true, replayed: true });

    const oversized = { type: "customer/note" as const, id: fixture.customers[0].id, note: "ä".repeat(4_000_000) };
    expect(await writer.apply(tenantId, oversized, {}, { idempotencyKey: "retry" })).toEqual({
      ok: false, reason: "rejected", version: 1, detail: "Document exceeds the 8 MB limit.",
    });
    expect(await writer.history(tenantId, { limit: 10 })).toMatchObject({ entries: [{ seq: 1 }], next: null });
    expect((await writer.load(tenantId))?.version).toBe(1);
    expect(writer.store_metrics()).toEqual({ ...metrics, sizeRefusals: 1 });
    expect(await writer.apply(tenantId, dismiss("another"), {}, { idempotencyKey: "retry" })).toMatchObject({ ok: true, version: 2 });
  });

  it("permits shrinking writes, access revocation and atomic erasure above the document limit", async () => {
    const fixture = createDemoState(day);
    const [first, ...others] = fixture.customers;
    const [other, third] = others;
    const customer = { ...first, firstName: "Jo", lastName: "Li" };
    const grantedAt = await databaseClock(db);
    const tenantId = await seed("salon", {
      ...fixture, customers: [customer, ...others],
      supportGrants: [{ id: "legacy-grant", grantedAt, until: grantedAt + 3_600_000 }],
    });
    const writer = store({ deliverAfterCommit: false });
    const sent = await writer.apply(tenantId, {
      type: "customers/message",
      texts: [{ customerId: customer.id, title: "Fictional reminder", body: "See you soon." }],
      at: { date: day, time: 9 * 60 },
    }, {}, { idempotencyKey: "send" });
    if (!sent.ok) throw new Error("Fixture message refused");

    const log = [...sent.state.log, ...Array.from({ length: 100 - sent.state.log.length }, (_, i) => ({
      id: `legacy-${i}`, type: "customer/note", summary: i === 99 - sent.state.log.length ? "Historical note ".repeat(200) : "",
      at: grantedAt, actor: "owner", source: "button",
    }))];
    // The redaction marker is longer than the name it replaces in this note.
    const customers = sent.state.customers.map((item) => item.id === other.id
      ? { ...item, note: "ä".repeat(MAX_DOCUMENT_BYTES / 2) + " Jo Li".repeat(30_000) }
      : item);
    const legacy = JSON.stringify({ ...sent.state, customers, log });
    await db.$executeRaw`UPDATE tenant_state SET doc = ${legacy}::jsonb WHERE tenant_id = ${tenantId}`;
    expect(await writer.apply(tenantId, dismiss("would-grow"))).toMatchObject({
      ok: false, reason: "rejected", version: 1, detail: "Document exceeds the 8 MB limit.",
    });
    expect(await writer.apply(tenantId, { type: "customer/note", id: third.id, note: "Short note" }))
      .toMatchObject({ ok: true, version: 2 });
    const shrunkBytes = writer.store_metrics().documentBytes;
    expect(shrunkBytes).toBeLessThan(Buffer.byteLength(legacy));
    expect(shrunkBytes).toBeGreaterThan(MAX_DOCUMENT_BYTES);
    expect(await writer.apply(tenantId, { type: "support/revoke", at: grantedAt })).toMatchObject({
      ok: true, version: 3, state: { supportGrants: [{ revokedAt: expect.any(Number) }] },
    });
    const revokedBytes = writer.store_metrics().documentBytes;
    expect(revokedBytes).toBeGreaterThan(shrunkBytes);

    expect(await writer.eraseSubject(tenantId, customer.id)).toMatchObject({
      ok: true, version: 4, redacted: { actions: 1, effects: 1, idempotencyKeys: 1 },
      entry: { action: { type: "customer/erase", id: customer.id } },
    });
    const loaded = (await writer.load(tenantId))!;
    expect(loaded.version).toBe(4);
    expect(loaded.state.customers.some(({ id }) => id === customer.id)).toBe(false);
    expect(loaded.state.customers.find(({ id }) => id === other.id)?.note).not.toContain("Jo Li");
    expect(writer.store_metrics().documentBytes).toBeGreaterThan(revokedBytes);
    expect(await db.$queryRaw`
      SELECT redacted_at IS NOT NULL AS redacted FROM tenant_action WHERE tenant_id = ${tenantId} AND seq = 1`)
      .toEqual([{ redacted: true }]);
    expect(await db.$queryRaw`SELECT status FROM tenant_effect WHERE tenant_id = ${tenantId}`)
      .toEqual([{ status: "cancelled" }]);
    expect(await db.$queryRaw`SELECT key, result FROM tenant_idempotency WHERE tenant_id = ${tenantId}`).toEqual([{ key: "send", result: { erased: true } }]);
  });
});
