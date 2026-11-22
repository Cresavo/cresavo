import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { DemoState, Service, StaffId } from "@/concept/data/types";
import { bookableServices } from "@/concept/selectors";
import { drainPendingEffects, type EffectDelivery, type EffectSinks } from "@/concept/store/effect-outbox";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import type { StoreChange } from "@/concept/store/studio-store";
import {
  sweepActivityPersonalData, sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes, sweepJournalAccessRows, sweepOutboxBodies,
} from "@/concept/store/store-sweepers";
import { enterScope, inScope, OUTBOX_SCOPE, scoped, SWEEP_SCOPE, type StoreScope } from "@/concept/store/tenant-scope";
import { createOwnerAccount } from "@/lib/owner-accounts";
import { findSalonTenant, loadPublicTenant } from "@/lib/public-booking";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { withOwnSlug } from "./own-slug";

// Row-level security on the studio store (migration store_rls_policies,
// prisma/grants/rls-enable.sql) against a disposable local *_test database.
// The grants files are applied as in roles.sql's header, RLS is switched on,
// and the store runs as real logins: an application login (member of
// cresavo_app) and a sweeper login (member of cresavo_sweeper). Skipped when
// the connecting role cannot create roles or alter the store tables. RLS is
// switched off again afterwards. All data is fictional.

const adminUrl = process.env.DATABASE_URL!;
const run = randomUUID().slice(0, 8);
const PREFIX = `rls-${run}`;
const hmacSecret = randomBytes(32).toString("hex");
const STORE = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"] as const;
const grant = (name: string) => readFileSync(new URL(`../../prisma/grants/${name}`, import.meta.url), "utf8");

const holder = vi.hoisted(() => ({ db: undefined as unknown as import("@prisma/client").PrismaClient }));
// The address lookups, sign-up and owner pages use the app's `db`: here, the application login.
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, {
    get(_, property) {
      const value = Reflect.get(holder.db, property);
      return typeof value === "function" ? value.bind(holder.db) : value;
    },
  }),
}));

const clients: PrismaClient[] = [];
const client = (url: string, max = 3) => {
  const made = createDatabaseClient(url, max) as PrismaClient;
  clients.push(made);
  return made;
};
const admin = client(adminUrl);

/** Superuser, or CREATEROLE and the owner of the store tables: what roles.sql and rls-enable.sql need. */
async function capable() {
  const [row] = await admin.$queryRaw<Array<{ ok: boolean; superuser: boolean }>>`
    SELECT r.rolsuper OR (r.rolcreaterole AND pg_has_role(c.relowner, 'USAGE')) AS ok, r.rolsuper AS superuser
    FROM pg_roles r, pg_class c WHERE r.rolname = current_user AND c.oid = 'tenant_state'::regclass`;
  return row;
}
const able = await capable();

describe("store scope settings", () => {
  it("are transaction-local: a pooled connection never carries a tenant into the next statement", async () => {
    const single = client(adminUrl, 1);
    const setting = (db: Pick<PrismaClient, "$queryRaw">) =>
      db.$queryRaw<Array<{ tenant: string | null; cross: string | null }>>`
        SELECT current_setting('cresavo.tenant_id', true) AS tenant, current_setting('cresavo.cross_tenant', true) AS cross`;
    expect(await scoped(single, { tenant: `${PREFIX}-a` }, setting)).toEqual([{ tenant: `${PREFIX}-a`, cross: "" }]);
    const [after] = await setting(single);
    expect(after.tenant ?? "").toBe("");
    // A transaction that fails leaves nothing behind either, and a later scope replaces an earlier one entirely.
    await expect(inScope(single, OUTBOX_SCOPE, async () => { throw new Error("rollback"); })).rejects.toThrow("rollback");
    const [failed] = await setting(single);
    expect([failed.tenant ?? "", failed.cross ?? ""]).toEqual(["", ""]);
    const switched = await single.$transaction(async (tx) => {
      await enterScope(tx, OUTBOX_SCOPE);
      await enterScope(tx, { tenant: `${PREFIX}-b` });
      return setting(tx);
    });
    expect(switched).toEqual([{ tenant: `${PREFIX}-b`, cross: "" }]);
    const [last] = await setting(single);
    expect(last.tenant ?? "").toBe("");
  });
});

const today = toKey(new Date());
const tenant = (label: string) => `${PREFIX}-${label}`;
const A = tenant("a");
const B = tenant("b");
const DEMO = tenant("demo");
const SANDBOX = tenant("sbx-expired");
const LOGINS = { app: `cresavo_rls_app_${run}`, sweeper: `cresavo_rls_sweeper_${run}`, support: `cresavo_rls_support_${run}` };
const password = randomBytes(24).toString("hex");
const asLogin = (login: string) => {
  const url = new URL(adminUrl);
  url.username = login;
  url.password = password;
  return url.href;
};

/** Runs a file of SQL (its own BEGIN/COMMIT, DO blocks) on one connection, as psql would. */
async function runSql(sql: string) {
  const connection = new pg.Client({ connectionString: adminUrl });
  await connection.connect();
  try {
    await connection.query(sql);
  } finally {
    await connection.end();
  }
}

const count = async (db: Pick<PrismaClient, "$queryRawUnsafe">, table: string, where = "true") => {
  const [row] = await db.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(tenant_id)::int AS n FROM ${table} WHERE ${where}`);
  return row.n;
};
const ours = `tenant_id LIKE '${PREFIX}-%'`;

/** The outcome of one statement in a scope: rows changed, or the SQLSTATE it failed with. */
async function attempt(db: PrismaClient, scope: StoreScope, sql: string): Promise<number | string> {
  try {
    return await scoped(db, scope, (tx) => tx.$executeRawUnsafe(sql));
  } catch (error) {
    const text = String((error as { message?: unknown }).message ?? error);
    if (/row-level security/i.test(text)) return "rls";
    if (/permission denied/i.test(text)) return "denied";
    throw error;
  }
}

function depositState(id: string): { state: DemoState; deposit: Service } {
  const base = withOwnSlug(createDemoState(today), id);
  const [deposit] = bookableServices(base);
  return { state: { ...base, cancellationPolicy: { ...DEFAULT_POLICY, deposits: { [deposit.id]: 20_000 } } }, deposit };
}

function slotFor(state: DemoState, service: Service, fromDay = 7): { staffId: StaffId; date: string; start: number } {
  for (let i = fromDay; i <= 28; i++) {
    const date = addDays(today, i);
    for (const staffId of service.staffIds) {
      const start = freeStarts(state, staffId, date, needOf(service))[0];
      if (start !== undefined) return { staffId, date, start };
    }
  }
  throw new Error("no free slot");
}

const guest = { name: "Fictional Rowlevel", phone: "0700005678", email: "rowlevel@example.test" };
const hold = (service: Service, slot: { staffId: StaffId; date: string; start: number }): DemoAction => ({
  type: "online/hold", serviceId: service.id, ...slot,
  guest: { ...guest, at: { date: today, time: 8 * 60 } },
  notice: { title: `Request from ${guest.name}`, body: `Call ${guest.phone}` },
});
const dismiss = (id: string): DemoAction => ({ type: "card/dismiss", id });

let eraseSubjectInstalled = false;
let rlsOn = false;

describe.skipIf(!able?.ok)("row-level security on the store (rls-enable.sql)", () => {
  let app: PrismaClient;
  let sweeper: PrismaClient;
  let support: PrismaClient;
  const delivered: EffectDelivery[] = [];
  const sinks: EffectSinks = { payment: (d) => { delivered.push(d); }, message: (d) => { delivered.push(d); } };
  const appStore = (options: Partial<ConstructorParameters<typeof PostgresStudioStore>[0]> = {}) =>
    new PostgresStudioStore({ prisma: app, hmacSecret, sinks, erasure: "function", deliverAfterCommit: false, listenerConnectionString: asLogin(LOGINS.app), ...options });

  beforeAll(async () => {
    const [{ exists }] = await admin.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regprocedure('erase_subject(text, text)') IS NOT NULL AS exists`;
    eraseSubjectInstalled = !exists;
    // The order of roles.sql's header: roles, store grants, the erase function, logins; then the operator step.
    await runSql(grant("roles.sql"));
    await runSql(grant("studio-store.sql"));
    await runSql("GRANT cresavo_eraser TO CURRENT_USER WITH SET TRUE; GRANT CREATE ON SCHEMA public TO cresavo_eraser");
    try {
      await runSql(grant("erase-subject.sql").replaceAll(':"eraser_role"', "cresavo_eraser").replaceAll(':"app_role"', "cresavo_app"));
    } finally {
      await runSql("REVOKE CREATE ON SCHEMA public FROM cresavo_eraser; REVOKE cresavo_eraser FROM CURRENT_USER");
    }
    await runSql([
      `CREATE ROLE ${LOGINS.app} LOGIN PASSWORD '${password}' IN ROLE cresavo_app`,
      `CREATE ROLE ${LOGINS.sweeper} LOGIN PASSWORD '${password}' IN ROLE cresavo_sweeper`,
      `CREATE ROLE ${LOGINS.support} LOGIN PASSWORD '${password}' IN ROLE cresavo_support`,
    ].join(";"));

    // Fixtures, written by the owner: two salons, a demo with an old log, an expired sandbox, and rows for the sweeps.
    const old = "2020-01-01T00:00:00Z";
    for (const [id, kind] of [[A, "salon"], [B, "salon"], [DEMO, "demo"]] as const) {
      await admin.$executeRaw`INSERT INTO tenant_state (tenant_id, kind, doc) VALUES (${id}, ${kind}::tenant_kind, ${JSON.stringify(depositState(id).state)}::jsonb)`;
    }
    await admin.$executeRaw`
      INSERT INTO tenant_state (tenant_id, kind, doc, expires_at) VALUES (${SANDBOX}, 'sandbox', ${JSON.stringify(createDemoState(today))}::jsonb, ${old}::timestamptz)`;
    const action = (id: string, seq: number, type: string, key: string | null) => admin.$executeRaw`
      INSERT INTO tenant_action (tenant_id, seq, action, actor, source, at, idempotency_key, resulting_version)
      VALUES (${id}, ${seq}::bigint, ${JSON.stringify({ type, id: "fixture" })}::jsonb, 'owner', 'button', ${old}::timestamptz, ${key}, ${seq})`;
    await action(B, 1, "journal/view", null);
    await action(B, 2, "card/dismiss", "key-with-an-address@example.test");
    await action(DEMO, 1, "card/dismiss", null);
    await action(SANDBOX, 1, "card/dismiss", null);
    await admin.$executeRaw`UPDATE tenant_state SET version = 2 WHERE tenant_id = ${B}`;
    const key = (id: string, name: string, expires: string) => admin.$executeRaw`
      INSERT INTO tenant_idempotency (tenant_id, key, fingerprint_hmac, seq, result, expires_at)
      VALUES (${id}, ${name}, '00', 1, '{}'::jsonb, ${expires}::timestamptz)`;
    await key(B, "expired", old);
    await key(B, "live", "2099-01-01T00:00:00Z");
    await key(SANDBOX, "sandbox-live", "2099-01-01T00:00:00Z");
    const effect = (id: string, n: number, name: string, status: string, next: string) => admin.$executeRaw`
      INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, status, next_attempt_at, delivered_at)
      VALUES (${id}, 2, ${n}, ${`${PREFIX}-${name}`}, 'f', 'message', ${JSON.stringify({ port: "email", body: "Fictional body", to: "someone@example.test" })}::jsonb,
              ${status}, ${next}::timestamptz, ${status === "delivered" ? old : null}::timestamptz)`;
    await effect(B, 0, "settled", "delivered", old);
    await effect(B, 1, "waiting", "pending", "2099-01-01T00:00:00Z");
    await effect(SANDBOX, 0, "sandbox", "pending", "2099-01-01T00:00:00Z");

    await runSql(grant("rls-enable.sql"));
    rlsOn = true;
    app = client(asLogin(LOGINS.app));
    sweeper = client(asLogin(LOGINS.sweeper));
    support = client(asLogin(LOGINS.support));
    holder.db = app;
  });

  afterAll(async () => {
    if (rlsOn) await runSql(grant("rls-disable.sql"));
    await admin.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
    for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "owner_account", "tenant_state"]) {
      await admin.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id LIKE $1 OR tenant_id = ANY($2)`, `${PREFIX}-%`, createdTenants);
    }
    await Promise.all(clients.filter((c) => c !== admin).map((c) => c.$disconnect()));
    await runSql(Object.values(LOGINS).map((login) => `DROP ROLE IF EXISTS ${login}`).join(";"));
    if (eraseSubjectInstalled) {
      await runSql(`DROP FUNCTION IF EXISTS erase_subject(text, text), studio_redact_replay(jsonb, text, text[], text[]),
        studio_redact_replay_action(jsonb, text, text[], text[], jsonb), studio_scrub(jsonb, text[]), studio_scrub_text(text, text[]),
        studio_redact_path(jsonb, text[]), studio_phone_digits(text)`);
    }
  }, 30_000);

  const createdTenants: string[] = [];

  it("reports every store table enabled, forced and with its policies", async () => {
    const connection = new pg.Client({ connectionString: adminUrl });
    await connection.connect();
    try {
      const { rows } = await connection.query(grant("verify-rls.sql"));
      expect(rows.map((r) => [r.table, r.enabled, r.forced, r.missing])).toEqual(
        [...STORE].sort().map((table) => [table, true, true, ""]));
    } finally {
      await connection.end();
    }
  });

  it("runs the store normally for the application login: load, apply, idempotency, history, outbox, erasure", async () => {
    const store = appStore();
    const listener = appStore({ prisma: client(asLogin(LOGINS.app)) });
    const changes: StoreChange[] = [];
    listener.subscribe(A, (change) => changes.push(change));
    await expect.poll(() => listener.notificationsReady).toBe(true);

    expect(await store.load(A)).toMatchObject({ version: 0 });
    const { deposit, state } = depositState(A);
    const held = await store.apply(A, hold(deposit, slotFor(state, deposit)), {}, { idempotencyKey: `${PREFIX}-hold` });
    if (!held.ok) throw new Error("hold refused");
    const replay = await store.apply(A, hold(deposit, slotFor(state, deposit)), {}, { idempotencyKey: `${PREFIX}-hold` });
    expect(replay).toMatchObject({ ok: true, replayed: true, version: held.version });
    const paid = await store.apply(A, { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" });
    if (!paid.ok) throw new Error("pay refused");
    expect(paid.effects.some((e) => e.kind === "payment")).toBe(true);
    await expect.poll(() => changes.map((c) => c.version)).toEqual([held.version, paid.version]);
    expect((await store.history(A, { limit: 10 })).entries.map((e) => e.seq)).toEqual([1, 2]);

    // The poller crosses tenants in the outbox scope and delivers A's effects; B's waiting row is not yet due.
    const report = await drainPendingEffects({ prisma: app, sinks, tenants: [A, B] });
    expect(report.delivered).toBeGreaterThan(0);
    expect(new Set(delivered.map((d) => d.tenantId))).toEqual(new Set([A]));

    // Erasure through the SECURITY DEFINER function, in A's scope.
    const customer = paid.state.customers.find((c) => c.email === guest.email || c.phone === guest.phone);
    if (!customer) throw new Error("no customer");
    const erased = await store.eraseSubject(A, customer.id);
    expect(erased).toMatchObject({ ok: true });
    if (!erased.ok) throw new Error("erase refused");
    expect(erased.redacted.actions).toBeGreaterThan(0);
    const leftovers = await admin.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM tenant_action WHERE tenant_id = ${A} AND action::text ILIKE ${`%${guest.email}%`}`;
    expect(leftovers).toEqual([{ n: 0 }]);
    store.close();
    listener.close();
  });

  it("resolves sandboxes, booking addresses and sign-ups only through their narrow scopes", async () => {
    const store = appStore();
    const sandbox = store.openSandboxTenant(`${PREFIX}-token`);
    expect(await sandbox.apply(dismiss("first"))).toMatchObject({ ok: true, version: 1 });
    const loaded = await sandbox.load();
    expect(loaded).toMatchObject({ version: 1 });
    createdTenants.push(loaded!.tenantId);
    // The key sees its own sandbox only.
    const key = loaded!.tenantId.replace(/_[^_]+$/, "");
    const lookup = (scope: StoreScope) => scoped(app, scope, (db) => db.$queryRaw<Array<{ tenant_id: string }>>`SELECT tenant_id FROM tenant_state`);
    expect(await lookup({ sandboxKey: key })).toEqual([{ tenant_id: loaded!.tenantId }]);
    expect(await lookup({ sandboxKey: "sbx_unknown" })).toEqual([]);
    expect(await attempt(app, { sandboxKey: key }, `UPDATE tenant_state SET version = version WHERE tenant_id = '${loaded!.tenantId}'`)).toBe(0);

    // Sign-up writes its salon in its own scope; the address scope finds exactly that salon, read only.
    const signup = await createOwnerAccount({ email: `owner-${run}@example.test`, password: "fictional-password-long", salonName: `Rls ${run}`, language: "en" });
    if (!signup.ok) throw new Error(`signup refused: ${signup.reason}`);
    createdTenants.push(signup.tenantId);
    const slug = (await store.load(signup.tenantId))!.state.salon.slug;
    expect(await findSalonTenant(slug)).toBe(signup.tenantId);
    expect(await loadPublicTenant(slug)).toMatchObject({ tenantId: signup.tenantId });
    expect(await lookup({ salonSlug: slug })).toEqual([{ tenant_id: signup.tenantId }]);
    expect(await attempt(app, { salonSlug: slug }, `UPDATE tenant_state SET version = version`)).toBe(0);
    expect(await findSalonTenant(`${slug}-none`)).toBeNull();
    store.close();
  });

  it("shows nothing to a raw query without a tenant", async () => {
    for (const table of STORE) {
      expect(await count(admin, table, ours), table).toBeGreaterThan(0);
      expect(await count(app, table), table).toBe(0);
      expect(await count(sweeper, table), table).toBe(0);
    }
    expect(await app.$executeRawUnsafe(`UPDATE tenant_state SET version = version WHERE ${ours}`)).toBe(0);
  });

  it("with tenant A set, hides B's rows and refuses every write to them", async () => {
    const a = { tenant: A };
    for (const table of STORE) {
      expect(await scoped(app, a, (db) => db.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = '${B}'`)), table).toEqual([{ n: 0 }]);
      expect(await scoped(app, { tenant: B }, (db) => db.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM ${table} WHERE tenant_id = '${B}'`)), table)
        .not.toEqual([{ n: 0 }]);
    }
    expect(await attempt(app, a, `UPDATE tenant_state SET version = version + 1 WHERE tenant_id = '${B}'`)).toBe(0);
    expect(await attempt(app, a, `UPDATE tenant_effect SET attempts = attempts WHERE tenant_id = '${B}'`)).toBe(0);
    expect(await attempt(app, a, `DELETE FROM tenant_idempotency WHERE tenant_id = '${B}'`)).toBe(0);
    expect(await attempt(app, a, `DELETE FROM tenant_state WHERE tenant_id = '${B}'`)).toBe(0);
    // Moving A's row to B, or writing a row for B, breaks the policy's check.
    expect(await attempt(app, a, `UPDATE tenant_idempotency SET tenant_id = '${B}' WHERE tenant_id = '${A}'`)).toBe("rls");
    expect(await attempt(app, a, `INSERT INTO tenant_action (tenant_id, seq, action, actor, source, at, resulting_version)
      VALUES ('${B}', 99, '{}'::jsonb, 'owner', 'button', now(), 99)`)).toBe("rls");
    expect(await attempt(app, a, `INSERT INTO tenant_state (tenant_id, kind, doc) VALUES ('${PREFIX}-intruder', 'salon', '{}'::jsonb)`)).toBe("rls");
    // The erase function runs as its own role under the same policy: it cannot reach another tenant either.
    await expect(scoped(app, a, (db) => db.$queryRaw`SELECT erase_subject(${B}, 'anyone')`)).rejects.toThrow(/unknown tenant/);
    // The store itself never reads across: A's history and B's load stay apart.
    const store = appStore();
    expect((await store.history(B, { limit: 10 })).entries.map((e) => e.tenantId)).toEqual([B, B]);
    store.close();
  });

  it("limits the outbox scope to the poller's work and to the application role", async () => {
    // Effects and tenant kind across tenants, read; nothing of the log or the replay results.
    expect(await count(app, "tenant_effect")).toBe(0);
    const outbox = (sql: string) => scoped(app, OUTBOX_SCOPE, (db) => db.$queryRawUnsafe<Array<{ n: number }>>(sql));
    expect((await outbox(`SELECT count(DISTINCT tenant_id)::int AS n FROM tenant_effect WHERE ${ours}`))[0].n).toBeGreaterThanOrEqual(2);
    expect((await outbox(`SELECT count(*)::int AS n FROM tenant_state WHERE ${ours}`))[0].n).toBeGreaterThanOrEqual(3);
    expect(await outbox(`SELECT count(*)::int AS n FROM tenant_action WHERE ${ours}`)).toEqual([{ n: 0 }]);
    expect(await outbox(`SELECT count(*)::int AS n FROM tenant_idempotency WHERE ${ours}`)).toEqual([{ n: 0 }]);
    // An undelivered row may be claimed; a delivered one is final; no document or other table changes.
    expect(await attempt(app, OUTBOX_SCOPE, `UPDATE tenant_effect SET attempts = attempts WHERE id = '${PREFIX}-waiting'`)).toBe(1);
    expect(await attempt(app, OUTBOX_SCOPE, `UPDATE tenant_effect SET attempts = attempts WHERE id = '${PREFIX}-settled'`)).toBe(0);
    expect(await attempt(app, OUTBOX_SCOPE, `UPDATE tenant_state SET version = version WHERE ${ours}`)).toBe(0);
    expect(await attempt(app, OUTBOX_SCOPE, `INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload)
      VALUES ('${B}', 9, 0, '${PREFIX}-forged', 'f', 'message', '{}'::jsonb)`)).toBe("rls");
    // The scope is the application's: the sweeper login sees nothing in it, and the app nothing in the sweep scope.
    expect(await scoped(sweeper, OUTBOX_SCOPE, (db) => db.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(tenant_id)::int AS n FROM tenant_effect`))).toEqual([{ n: 0 }]);
    expect(await scoped(app, SWEEP_SCOPE, (db) => db.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(*)::int AS n FROM tenant_effect`))).toEqual([{ n: 0 }]);
  });

  it("lets the sweeper login run every sweep and nothing beyond them", async () => {
    // Narrow first, before the sweeps remove the rows these statements aim at.
    const sweep = (sql: string) => attempt(sweeper, SWEEP_SCOPE, sql);
    expect(await sweep(`DELETE FROM tenant_state WHERE tenant_id = '${B}'`)).toBe(0);
    expect(await sweep(`DELETE FROM tenant_action WHERE tenant_id = '${B}' AND seq = 2`)).toBe(0);
    expect(await sweep(`DELETE FROM tenant_idempotency WHERE tenant_id = '${B}' AND key = 'live'`)).toBe(0);
    expect(await sweep(`UPDATE tenant_effect SET payload = '{}'::jsonb WHERE tenant_id = '${B}' AND seq = 2 AND n = 1`)).toBe(0);
    expect(await sweep(`UPDATE tenant_action SET idempotency_key = 'replaced' WHERE tenant_id = '${B}' AND seq = 2`)).toBe("rls");
    expect(await sweep(`UPDATE tenant_idempotency SET expires_at = expires_at WHERE tenant_id = '${B}'`)).toBe("rls");

    const sandbox = await sweepExpiredSandboxes({ prisma: sweeper });
    expect(sandbox.tenants).toBeGreaterThanOrEqual(1);
    expect(await sweepExpiredIdempotency({ prisma: sweeper })).toBeGreaterThanOrEqual(1);
    expect(await sweepDemoActions({ prisma: sweeper })).toBeGreaterThanOrEqual(1);
    expect(await sweepOutboxBodies({ prisma: sweeper })).toBeGreaterThanOrEqual(1);
    expect(await sweepActivityPersonalData({ prisma: sweeper })).toBeGreaterThanOrEqual(1);
    expect(await sweepJournalAccessRows({ prisma: sweeper })).toBeGreaterThanOrEqual(1);

    expect(await count(admin, "tenant_state", `tenant_id = '${SANDBOX}'`)).toBe(0);
    for (const table of ["tenant_action", "tenant_effect", "tenant_idempotency"]) expect(await count(admin, table, `tenant_id = '${SANDBOX}'`), table).toBe(0);
    expect(await count(admin, "tenant_action", `tenant_id = '${DEMO}'`)).toBe(0);
    expect(await admin.$queryRaw`SELECT key FROM tenant_idempotency WHERE tenant_id = ${B} ORDER BY key`).toEqual([{ key: "live" }]);
    expect(await admin.$queryRaw`SELECT seq, idempotency_key FROM tenant_action WHERE tenant_id = ${B} ORDER BY seq`).toEqual([{ seq: 2n, idempotency_key: null }]);
    expect(await admin.$queryRaw`SELECT payload ->> 'body' AS body FROM tenant_effect WHERE id = ${`${PREFIX}-settled`}`).toEqual([{ body: "[redacted]" }]);
    expect(await admin.$queryRaw`SELECT payload ->> 'body' AS body FROM tenant_effect WHERE id = ${`${PREFIX}-waiting`}`).toEqual([{ body: "Fictional body" }]);
  });

  it("gives the support login its diagnostic columns across tenants, read only", async () => {
    const [row] = await support.$queryRawUnsafe<Array<{ n: number }>>(`SELECT count(DISTINCT tenant_id)::int AS n FROM tenant_state WHERE ${ours}`);
    expect(row.n).toBeGreaterThanOrEqual(2);
    expect(await count(support, "tenant_effect", ours)).toBeGreaterThan(0);
    await expect(support.$queryRawUnsafe(`SELECT doc FROM tenant_state LIMIT 1`)).rejects.toThrow(/permission denied/);
  });

  it.skipIf(!able?.superuser)("keeps the table owner's access under FORCE through its own policy", async () => {
    const ROLLBACK = "rollback";
    const seen: number[] = [];
    // In one transaction that is rolled back: a fresh owner role sees every row through store_owner, and none without it.
    await expect(admin.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE ROLE ${PREFIX.replaceAll("-", "_")}_owner NOLOGIN`);
      await tx.$executeRawUnsafe(`ALTER TABLE tenant_state OWNER TO ${PREFIX.replaceAll("-", "_")}_owner`);
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${PREFIX.replaceAll("-", "_")}_owner`);
      seen.push(await count(tx, "tenant_state", ours));
      await tx.$executeRawUnsafe(`RESET ROLE`);
      await tx.$executeRawUnsafe(`DROP POLICY store_owner ON tenant_state`);
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${PREFIX.replaceAll("-", "_")}_owner`);
      seen.push(await count(tx, "tenant_state", ours));
      throw new Error(ROLLBACK);
    })).rejects.toThrow(ROLLBACK);
    expect(seen[0]).toBeGreaterThanOrEqual(3);
    expect(seen[1]).toBe(0);
  });
});
