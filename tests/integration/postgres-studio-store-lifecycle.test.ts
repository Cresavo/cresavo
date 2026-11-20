import { createHash, randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";
import { salonClock } from "@/concept/tools/clock";
import { databaseClock, drainPendingEffects, type EffectDelivery, type TenantKind } from "@/concept/store/effect-outbox";
import { DEMO_TENANT_ID, PostgresStudioStore, type PostgresStudioStoreOptions } from "@/concept/store/postgres-studio-store";
import { sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes } from "@/concept/store/store-sweepers";
import type { StoreChange } from "@/concept/store/studio-store";
import { createDatabaseClient } from "../../scripts/database.mjs";

const db = createDatabaseClient();
const secondDb = createDatabaseClient();
const hmacSecret = randomBytes(32).toString("hex");
const day = salonClock().today;
const tenants = new Set<string>();
const stores: PostgresStudioStore[] = [];

function store(options: Partial<PostgresStudioStoreOptions> = {}) {
  const instance = new PostgresStudioStore({
    prisma: db, hmacSecret, sinks: { payment() {}, message() {} }, ...options,
  });
  stores.push(instance);
  return instance;
}

async function seed(kind: TenantKind = "salon", state: DemoState = createDemoState(day), id: string = randomUUID()) {
  await db.$executeRaw`
    INSERT INTO tenant_state (tenant_id, kind, doc)
    VALUES (${id}, ${kind}::tenant_kind, ${JSON.stringify(state)}::jsonb)`;
  tenants.add(id);
  return id;
}

afterEach(async () => {
  for (const instance of stores.splice(0)) instance.close();
  const ids = [...tenants];
  if (!ids.length) return;
  await db.$transaction([
    db.$executeRaw`DELETE FROM tenant_action WHERE tenant_id = ANY(${ids}::text[])`,
    db.$executeRaw`DELETE FROM tenant_effect WHERE tenant_id = ANY(${ids}::text[])`,
    db.$executeRaw`DELETE FROM tenant_idempotency WHERE tenant_id = ANY(${ids}::text[])`,
    db.$executeRaw`DELETE FROM tenant_state WHERE tenant_id = ANY(${ids}::text[])`,
  ]);
  tenants.clear();
});

afterAll(async () => {
  await Promise.all([db.$disconnect(), secondDb.$disconnect()]);
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
    const connection = new URL(process.env.DATABASE_URL!);
    connection.searchParams.set("application_name", applicationName);
    const writer = store();
    const reader = store({ prisma: secondDb, listenerConnectionString: connection.href });
    const versions: number[] = [];
    const unsubscribe = reader.subscribe(tenantId, (change) => versions.push(change.version));
    const listenerPid = async () => {
      const [row] = await db.$queryRaw<Array<{ pid: number }>>`
        SELECT pid FROM pg_stat_activity WHERE application_name = ${applicationName}`;
      return row?.pid;
    };
    await expect.poll(() => reader.notificationsReady).toBe(true);
    const pid = (await listenerPid())!;
    await writer.apply(tenantId, dismiss("before"));
    await expect.poll(() => versions).toEqual([1]);
    expect(await db.$queryRaw`SELECT pg_terminate_backend(${pid}::int) AS terminated`).toEqual([{ terminated: true }]);
    await expect.poll(async () => {
      const connected = await listenerPid();
      return reader.notificationsReady && connected !== undefined && connected !== pid;
    }).toBe(true);
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
    const id = sandbox.tenantId;
    tenants.add(id);
    expect(id).toBe(`sbx_${createHash("sha256").update(token).digest("hex").slice(0, 32)}`);
    expect(duplicate.tenantId).toBe(id);
    expect(await writer.load(id)).toBeNull();
    expect(await sandbox.apply({ type: "service/price", id: "missing", price: 90 })).toMatchObject({ ok: false, reason: "rejected" });
    expect(await writer.load(id)).toBeNull();

    const before = await databaseClock(db);
    const results = await Promise.all([sandbox.apply(dismiss("first")), duplicate.apply(dismiss("second"))]);
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ ok: true, version: 1 }), expect.objectContaining({ ok: true, version: 2 }),
    ]));
    const [row] = await db.$queryRaw<Array<{ kind: TenantKind; expires: number }>>`
      SELECT kind::text, (extract(epoch FROM expires_at) * 1000)::float8 AS expires FROM tenant_state WHERE tenant_id = ${id}`;
    expect(row.kind).toBe("sandbox");
    expect(row.expires).toBeGreaterThanOrEqual(before + 86_400_000);
    const after = await databaseClock(db);
    expect(row.expires).toBeLessThanOrEqual(after + 86_400_000);
    const loaded = (await writer.load(id))!;
    const fixtureDay = loaded.state.generatedFor;
    expect([salonClock(new Date(before)).today, salonClock(new Date(after)).today]).toContain(fixtureDay);
    expect(loaded.state.bookings).toEqual(JSON.parse(JSON.stringify(createDemoState(fixtureDay).bookings)));
    const text: DemoAction = {
      type: "customers/message",
      texts: [{ customerId: loaded.state.customers[0].id, title: "Fictional reminder", body: "Have a good day." }],
      at: { date: fixtureDay, time: 9 * 60 },
    };
    expect(await sandbox.apply(text, {}, { idempotencyKey: "send" })).toMatchObject({ ok: true, version: 3 });
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
});
