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
import { ok } from "@/concept/connections/core";
import type { EmailMessage, EmailPort } from "@/concept/connections/ports/email";
import { drainPendingEffects, SIMULATED_SINKS, type EffectDelivery, type EffectSinks } from "@/concept/store/effect-outbox";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import type { StoreChange } from "@/concept/store/studio-store";
import {
  sweepActivityPersonalData, sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes, sweepJournalAccessRows, sweepOutboxBodies,
} from "@/concept/store/store-sweepers";
import { enterScope, inScope, OUTBOX_SCOPE, scoped, SWEEP_SCOPE, type StoreScope } from "@/concept/store/tenant-scope";
import { messageSink } from "@/lib/message-sink";
import { messageReference } from "@/concept/booking/messages";
import { createOwnerAccount } from "@/lib/owner-accounts";
import { findSalonTenant, loadPublicTenant } from "@/lib/public-booking";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { withOwnSlug } from "./own-slug";

// Row-level security on the studio store (migration store_rls_policies,
// prisma/grants/rls-enable.sql) against a disposable local *_test database.
// The grants files are applied as in roles.sql's header, RLS is switched on,
// and the store runs as real logins: an application login (member of
// cresavo_app), a sweeper login (cresavo_sweeper), an outbox login
// (cresavo_outbox, the effects:drain poller) and a support login. Skipped when
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
const MAIL_A = tenant("mail-a");
const MAIL_B = tenant("mail-b");
const MAIL_C = tenant("mail-c");
const LOGINS = { app: `cresavo_rls_app_${run}`, sweeper: `cresavo_rls_sweeper_${run}`, support: `cresavo_rls_support_${run}`, outbox: `cresavo_rls_outbox_${run}` };
const password = randomBytes(24).toString("hex");
const asLogin = (login: string) => {
  const url = new URL(adminUrl);
  url.username = login;
  url.password = password;
  return url.href;
};

/** Runs a file of SQL (its own BEGIN/COMMIT, DO blocks) on one connection, as psql would, and returns each statement's rows. */
async function runSql(sql: string): Promise<Array<Record<string, unknown>[]>> {
  const connection = new pg.Client({ connectionString: adminUrl });
  await connection.connect();
  try {
    const results = await connection.query(sql);
    return (Array.isArray(results) ? results : [results]).map((result) => result.rows ?? []);
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

/** Hold then pay a deposit: a payment and the booking's confirmation messages. */
async function payDeposit(store: PostgresStudioStore, id: string) {
  const { deposit, state } = depositState(id);
  const held = await store.apply(id, hold(deposit, slotFor(state, deposit)));
  if (!held.ok) throw new Error("hold refused");
  const paid = await store.apply(id, { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" });
  if (!paid.ok) throw new Error("pay refused");
  return paid;
}

let eraseSubjectInstalled = false;
let rlsOn = false;

describe.skipIf(!able?.ok)("row-level security on the store (rls-enable.sql)", () => {
  let app: PrismaClient;
  let sweeper: PrismaClient;
  let support: PrismaClient;
  let outbox: PrismaClient;
  const delivered: EffectDelivery[] = [];
  const sinks: EffectSinks = { payment: (d) => { delivered.push(d); }, message: (d) => { delivered.push(d); } };
  const appStore = (options: Partial<ConstructorParameters<typeof PostgresStudioStore>[0]> = {}) =>
    new PostgresStudioStore({ prisma: app, hmacSecret, sinks, erasure: "function", deliverAfterCommit: false, listenerConnectionString: asLogin(LOGINS.app), ...options });

  beforeAll(async () => {
    const [{ exists }] = await admin.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regprocedure('erase_subject(text, text)') IS NOT NULL AS exists`;
    eraseSubjectInstalled = !exists;
    // The order of roles.sql's header: group roles, grants, the erase function, logins; then the operator step.
    await runSql(grant("bootstrap-roles.sql"));
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
      `CREATE ROLE ${LOGINS.outbox} LOGIN PASSWORD '${password}' IN ROLE cresavo_outbox`,
    ].join(";"));

    // Fixtures, written by the owner: two salons, a demo with an old log, an expired sandbox, and rows for the sweeps.
    const old = "2020-01-01T00:00:00Z";
    for (const [id, kind] of [[A, "salon"], [B, "salon"], [DEMO, "demo"], [MAIL_A, "salon"], [MAIL_B, "salon"], [MAIL_C, "salon"]] as const) {
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
    outbox = client(asLogin(LOGINS.outbox));
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
      await runSql(`DROP FUNCTION IF EXISTS erase_subject(text, text), studio_erase_journal_mentions(text, text, jsonb), studio_redact_replay(jsonb, text, text[], text[]),
        studio_redact_replay_action(jsonb, text, text[], text[], jsonb), studio_scrub(jsonb, text[]), studio_scrub_text(text, text[]),
        studio_redact_path(jsonb, text[]), studio_phone_digits(text)`);
    }
  }, 30_000);

  const createdTenants: string[] = [];

  it("reports every store table enabled, forced and with exactly its policies, and no login that can bypass them", async () => {
    const [tables, problems] = await runSql(grant("verify-rls.sql"));
    expect(tables.map((r) => [r.table, r.enabled, r.forced, r.missing, r.unexpected, r.changed])).toEqual(
      [...STORE, "journal_entry"].sort().map((table) => [table, true, true, "", "", ""]));
    expect(problems).toEqual([]);
    const [roleProblems] = await runSql(grant("verify-roles.sql")
      .replaceAll(":'app_login'", `'${LOGINS.app}'`).replaceAll(":'sweeper_login'", `'${LOGINS.sweeper}'`)
      .replaceAll(":'support_login'", `'${LOGINS.support}'`).replaceAll(":'outbox_login'", `'${LOGINS.outbox}'`));
    expect(roleProblems).toEqual([]);
  });

  it("refuses to enable beside an extra policy, reports changed or missing ones, and a login that can become a bypassing role", async () => {
    const ROLLBACK = "rollback";
    const connection = new pg.Client({ connectionString: adminUrl });
    await connection.connect();
    /** Runs `change`, then `script` without its own BEGIN and COMMIT, in one transaction that is rolled back. */
    const within = async (change: string, script: string) => {
      await connection.query("BEGIN");
      try {
        await connection.query(change);
        return await connection.query(grant(script).replace(/^BEGIN;$/m, "").replace(/^COMMIT;$/m, ""));
      } finally {
        await connection.query("ROLLBACK");
      }
    };
    const tables = async (change: string) =>
      ((await within(change, "verify-rls.sql")) as unknown as Array<{ rows: Array<Record<string, string>> }>)[0].rows;
    try {
      // rls-enable.sql replaces its own policies, so a policy someone added by hand stops it.
      await expect(within(`CREATE POLICY extra ON tenant_idempotency FOR SELECT USING (true)`, "rls-enable.sql"))
        .rejects.toThrow(/tenant_idempotency\.extra \(unexpected\)/);
      // Afterwards verify-rls.sql reports a changed or a dropped policy.
      expect((await tables(`ALTER POLICY store_tenant ON tenant_state USING (true)`)).find((r) => r.table === "tenant_state")?.changed).toBe("store_tenant");
      expect((await tables(`ALTER POLICY store_tenant ON tenant_effect TO PUBLIC`)).find((r) => r.table === "tenant_effect")?.changed).toBe("store_tenant");
      expect((await tables(`DROP POLICY store_support_read ON tenant_action`)).find((r) => r.table === "tenant_action")?.missing).toBe("store_support_read");
      // A login that may SET ROLE to the table owner, without inheriting it, is reported.
      await connection.query("BEGIN");
      try {
        const owner = (await connection.query("SELECT tableowner FROM pg_tables WHERE tablename = 'tenant_state'")).rows[0].tableowner as string;
        await connection.query(`GRANT "${owner}" TO ${LOGINS.app} WITH INHERIT FALSE, SET TRUE`);
        // ADMIN on a group role lets a login grant it to itself: reported. An admin-only grant (what a CREATEROLE
        // creator receives) does not make a runtime login of its holder.
        await connection.query(`GRANT cresavo_support TO ${LOGINS.outbox} WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`);
        await connection.query(`CREATE ROLE ${LOGINS.app}_creator LOGIN PASSWORD '${password}'`);
        await connection.query(`GRANT cresavo_app TO ${LOGINS.app}_creator WITH ADMIN TRUE, INHERIT FALSE, SET FALSE`);
        // A login that reaches a runtime group only through another role is found too.
        await connection.query(`CREATE ROLE ${LOGINS.app}_middle NOLOGIN IN ROLE cresavo_sweeper`);
        await connection.query(`CREATE ROLE ${LOGINS.app}_indirect LOGIN BYPASSRLS PASSWORD '${password}' IN ROLE ${LOGINS.app}_middle`);
        const results = await connection.query(grant("verify-rls.sql")) as unknown as Array<{ rows: Array<{ problem: string }> }>;
        const problems = results[1].rows.map((r) => r.problem).join("\n");
        expect(problems).toContain(`login ${LOGINS.app} can SET ROLE to`);
        expect(problems).toContain(`login ${LOGINS.app} can SET ROLE to the owner of tenant_state`);
        expect(problems).toContain(`login ${LOGINS.outbox} holds ADMIN OPTION on cresavo_support`);
        expect(problems).toContain(`login ${LOGINS.app}_indirect is superuser, createrole, replication or bypasses row-level security`);
        expect(problems).not.toContain(`${LOGINS.app}_creator`);
        throw new Error(ROLLBACK);
      } catch (error) {
        if ((error as Error).message !== ROLLBACK) throw error;
      } finally {
        await connection.query("ROLLBACK");
      }
    } finally {
      await connection.end();
    }
  });

  it("runs the store normally for the application login: load, apply, idempotency, history, outbox, erasure", async () => {
    const store = appStore();
    const listener = appStore({ prisma: client(asLogin(LOGINS.app)) });
    const changes: StoreChange[] = [];
    listener.subscribe(A, (change) => changes.push(change));
    const eavesdropper = new pg.Client({ connectionString: asLogin(LOGINS.support) });
    const heard: string[] = [];
    await eavesdropper.connect();
    eavesdropper.on("notification", ({ payload }) => { if (payload) heard.push(payload); });
    await eavesdropper.query("LISTEN tenant_changes");
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
    // The wake-up is opaque; the listener reads the version in A's own scope.
    await expect.poll(() => changes.at(-1)?.version).toBe(paid.version);
    expect(changes.every((c) => c.tenantId === A && c.version >= held.version)).toBe(true);
    // What any listening login sees: a tag, never the tenant or the version.
    expect(heard.length).toBeGreaterThanOrEqual(2);
    for (const payload of heard) {
      expect(Object.keys(JSON.parse(payload)).sort()).toEqual(["sender", "tag"]);
      expect(payload).not.toContain(A);
    }
    await eavesdropper.end();
    expect((await store.history(A, { limit: 10 })).entries.map((e) => e.seq)).toEqual([1, 2]);

    // The poller (its own login) crosses tenants in the outbox scope and delivers A's effects; B's waiting row is not yet due.
    const report = await drainPendingEffects({ prisma: outbox, sinks, tenants: [A, B] });
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
    // Only the full key: a prefix of it, or the bare marker, finds nothing.
    expect(await lookup({ sandboxKey: key.slice(0, 12) })).toEqual([]);
    expect(await lookup({ sandboxKey: "sbx" })).toEqual([]);
    expect(await attempt(app, { sandboxKey: key }, `UPDATE tenant_state SET version = version WHERE tenant_id = '${loaded!.tenantId}'`)).toBe(0);

    // Sign-up writes its salon in its own scope; an address resolves to its tenant id and nothing of its row.
    const signup = await createOwnerAccount({ email: `owner-${run}@example.test`, password: randomBytes(16).toString("hex"), salonName: `Rls ${run}`, language: "en" });
    if (!signup.ok) throw new Error(`signup refused: ${signup.reason}`);
    createdTenants.push(signup.tenantId);
    const slug = (await store.load(signup.tenantId))!.state.salon.slug;
    expect(await findSalonTenant(slug)).toBe(signup.tenantId);
    expect(await loadPublicTenant(slug)).toMatchObject({ tenantId: signup.tenantId });
    expect(await app.$queryRaw`SELECT store_salon_by_slug(${slug}) AS t`).toEqual([{ t: signup.tenantId }]);
    // The address alone shows nothing of the row: without the tenant's scope the salon stays invisible.
    expect(await app.$queryRaw`SELECT count(*)::int AS n FROM tenant_state WHERE tenant_id = ${signup.tenantId}`).toEqual([{ n: 0 }]);
    await expect(outbox.$queryRaw`SELECT store_salon_by_slug(${slug}) AS t`).rejects.toThrow(/permission denied/);
    expect(await findSalonTenant(`${slug}-none`)).toBeNull();
    store.close();
  });

  it("shows nothing to a raw query without a tenant", async () => {
    for (const table of STORE) {
      expect(await count(admin, table, ours), table).toBeGreaterThan(0);
      expect(await count(app, table), table).toBe(0);
      // The poller and the sweeper have no table privilege at all.
      await expect(count(sweeper, table), table).rejects.toThrow(/permission denied/);
      await expect(count(outbox, table), table).rejects.toThrow(/permission denied/);
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

  it("gives the poller login only the outbox functions, and those only for the claim they hand out", async () => {
    const call = (db: PrismaClient, scope: StoreScope, sql: string) => scoped(db, scope, (tx) => tx.$queryRawUnsafe<Array<Record<string, unknown>>>(sql));
    // No direct read or write of a store table, in any scope.
    for (const scope of [OUTBOX_SCOPE, { tenant: B }] as StoreScope[]) {
      for (const table of STORE) await expect(call(outbox, scope, `SELECT count(tenant_id) FROM ${table}`), table).rejects.toThrow(/permission denied/);
      expect(await attempt(outbox, scope, `UPDATE tenant_effect SET attempts = attempts WHERE tenant_id = '${B}'`)).toBe("denied");
    }
    // A due message of salon B about one of its bookings: the web login claims nothing in the outbox scope, the sweeper
    // may not call the claim.
    const { state: salonB } = depositState(B);
    const target = salonB.bookings.find((b) => salonB.customers.some((c) => c.id === b.customerId))!;
    await admin.$executeRaw`
      INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, next_attempt_at)
      VALUES (${B}, 3, 0, ${`${PREFIX}-due`}, 'f', 'message',
              ${JSON.stringify({ port: "email", body: "Fictional", to: `customer:${target.customerId}`, reference: messageReference(target, "confirmation", "email") })}::jsonb,
              now() - interval '1 hour')`;
    const claim = `SELECT id, attempts, claim_token FROM store_outbox_claim(now(), 60000, 60000, ARRAY['${B}'], NULL, false)`;
    expect(await call(app, OUTBOX_SCOPE, claim)).toEqual([]);
    await expect(call(sweeper, OUTBOX_SCOPE, claim)).rejects.toThrow(/permission denied/);
    // The poller claims it and gets a random token; only with that token does it see the salon, as the message view.
    const [claimed] = await call(outbox, OUTBOX_SCOPE, claim);
    expect(claimed).toMatchObject({ id: `${PREFIX}-due`, attempts: 1 });
    const token = claimed.claim_token as string;
    expect(token).toMatch(/^[0-9a-f-]{36}$/);
    const view = async (claimToken: string) => (await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_message_view('${PREFIX}-due', '${claimToken}', false) AS view`))[0].view;
    expect(await view(randomUUID())).toBeNull();
    const doc = (await view(token)) as Record<string, unknown> & {
      salon: Record<string, unknown>; bookings: Array<{ id: string }>; customers: Array<Record<string, unknown>>; staff: Array<Record<string, unknown>>;
      exceptions: unknown[]; journals?: unknown; inbox: unknown[]; log: unknown[];
    };
    // Exactly the booking the stored reference names, its customer's first name and contact, the staff's first name.
    expect(doc.bookings.map((b) => b.id)).toEqual([target.id]);
    expect(doc.customers.map((c) => c.id)).toEqual([target.customerId]);
    for (const customer of doc.customers) expect(Object.keys(customer).every((k) => ["id", "firstName", "email", "phone"].includes(k))).toBe(true);
    for (const member of doc.staff) expect(Object.keys(member).every((k) => ["id", "firstName", "name"].includes(k))).toBe(true);
    expect(Object.keys(doc.salon).every((k) => ["name", "address", "phone", "email", "slug"].includes(k))).toBe(true);
    for (const list of [doc.exceptions, doc.inbox, doc.log]) expect(list).toEqual([]);
    expect(doc.journals).toBeUndefined();
    // Without the current token, nothing is read or changed.
    const other = randomUUID();
    for (const sql of [
      `SELECT store_outbox_note('${PREFIX}-due', '${other}', 'uncertain', true, false) AS r`,
      `SELECT store_outbox_skip('${PREFIX}-due', '${other}') AS r`,
      `SELECT store_outbox_release('${PREFIX}-due', '${other}', true) AS r`,
      `SELECT store_outbox_dispatch('${PREFIX}-due', '${other}', 'resend', NULL, 1) AS r`,
    ]) expect(await call(outbox, OUTBOX_SCOPE, sql), sql).toEqual([{ r: 0 }]);
    expect(await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_delivered('${PREFIX}-due', '${other}', true) AS r`)).toEqual([{ r: null }]);
    expect(await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_fail('${PREFIX}-due', '${other}', now(), now(), false, true, false, NULL, false, false) AS r`)).toEqual([{ r: null }]);
    expect(await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_freeze('${PREFIX}-due', '${other}', 1, 's', 't', 'h', 'f', NULL, 'https://evil.example.test/x', 1) AS r`)).toEqual([{ r: null }]);
    // A reason must look like a code: free text is refused even under the right token.
    expect(await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_note('${PREFIX}-due', '${token}', 'Free text with a name', true, false) AS r`)).toEqual([{ r: 0 }]);
    // A delivered row that never was claimed cannot be touched with a made-up token.
    expect(await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_delivered('${PREFIX}-settled', '${other}', true) AS r`)).toEqual([{ r: null }]);
    // Its own claim it can settle once; afterwards the token is spent: no read, no second write.
    expect(await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_skip('${PREFIX}-due', '${token}') AS r`)).toEqual([{ r: 1 }]);
    expect(await view(token)).toBeNull();
    expect(await call(outbox, OUTBOX_SCOPE, `SELECT store_outbox_delivered('${PREFIX}-due', '${token}', true) AS r`)).toEqual([{ r: null }]);
    expect(await admin.$queryRaw`SELECT status, claim_token FROM tenant_effect WHERE id = ${`${PREFIX}-due`}`).toEqual([{ status: "delivered", claim_token: null }]);
    expect(await admin.$queryRaw`SELECT status, payload ->> 'body' AS body FROM tenant_effect WHERE id = ${`${PREFIX}-waiting`}`)
      .toEqual([{ status: "pending", body: "Fictional body" }]);
  });

  it("delivers booking e-mails of two salons through the real message sink: the poller as its login, a web worker in its tenant", async () => {
    const mails: EmailMessage[] = [];
    const provider = { info: { provider: "resend" }, send: async (message: EmailMessage) => (mails.push(message), ok({ id: `m-${mails.length}`, to: [] }, "sent")) } as unknown as EmailPort;
    const registry = { resolve: async () => ({ adapter: provider, live: true, reason: "live" as const }) };
    const live = { liveMessage: () => true };
    // Two salons commit without delivering, as if the web worker had crashed after the commit; the poller sends.
    for (const id of [MAIL_A, MAIL_B]) {
      const store = appStore(live);
      await payDeposit(store, id);
      store.close();
    }
    const report = await drainPendingEffects({ prisma: outbox, sinks: { ...SIMULATED_SINKS, message: messageSink(outbox, registry) }, tenants: [MAIL_A, MAIL_B] });
    expect(report.failed).toBe(0);
    // A third salon's web worker delivers its own e-mail right after the commit, in its tenant's scope, as the app login.
    const web = appStore({ ...live, deliverAfterCommit: true, sinks: { ...SIMULATED_SINKS, message: messageSink(app, registry) } });
    await payDeposit(web, MAIL_C);
    web.close();
    const emails = await admin.$queryRaw<Array<{ tenant_id: string; status: string; sent: boolean | null }>>`
      SELECT tenant_id, status, (payload #>> '{delivery,sent}')::boolean AS sent FROM tenant_effect
      WHERE tenant_id = ANY(${[MAIL_A, MAIL_B, MAIL_C]}::text[]) AND payload ->> 'port' = 'email' ORDER BY tenant_id`;
    expect(new Set(emails.map((e) => e.tenant_id))).toEqual(new Set([MAIL_A, MAIL_B, MAIL_C]));
    expect(emails.every((e) => e.status === "delivered" && e.sent === true)).toBe(true);
    expect(mails.length).toBe(emails.length);
    // Each mail was rendered from its own salon's document and keyed by its own effect.
    const ids = await admin.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tenant_effect WHERE tenant_id = ANY(${[MAIL_A, MAIL_B, MAIL_C]}::text[]) AND payload ->> 'port' = 'email'`;
    expect(mails.map((m) => m.idempotencyKey).sort()).toEqual(ids.map((row) => row.id).sort());
  });

  it("lets the sweeper login sweep only through the fixed functions, with their own retention cutoffs", async () => {
    // No direct privilege on a store table, in the sweep scope or with a live salon's tenant id set.
    for (const scope of [SWEEP_SCOPE, { tenant: B }] as StoreScope[]) {
      for (const table of STORE) expect(await attempt(sweeper, scope, `DELETE FROM ${table} WHERE tenant_id = '${B}'`), `${table} ${JSON.stringify(scope)}`).toBe("denied");
    }
    // The functions run only in the sweep scope, and only for the sweeper.
    const sweepCall = (db: PrismaClient, scope: StoreScope, sql: string) => scoped(db, scope, (tx) => tx.$queryRawUnsafe<Array<{ n: number }>>(sql));
    await expect(sweepCall(sweeper, { tenant: B }, `SELECT store_sweep_idempotency(now(), 10) AS n`)).rejects.toThrow(/sweep scope/);
    await expect(sweepCall(app, SWEEP_SCOPE, `SELECT store_sweep_idempotency(now(), 10) AS n`)).rejects.toThrow(/permission denied/);
    await expect(sweepCall(outbox, SWEEP_SCOPE, `SELECT store_sweep_sandboxes(now(), 10) AS n`)).rejects.toThrow(/permission denied/);
    // A fresh session without the scope, and a missing or unbounded batch, are refused.
    await expect(sweeper.$queryRawUnsafe(`SELECT store_sweep_idempotency(now(), 10) AS n`)).rejects.toThrow(/sweep scope/);
    for (const limit of ["NULL", "0", "100000"]) {
      await expect(sweepCall(sweeper, SWEEP_SCOPE, `SELECT store_sweep_idempotency(now(), ${limit}) AS n`), limit).rejects.toThrow(/between 1 and 10000/);
    }
    // The rate-limit table: no direct grant, and an active lock-out is never removed, whatever clock is passed.
    expect(await attempt(sweeper, SWEEP_SCOPE, `DELETE FROM "RateLimitBucket" WHERE "key" = 'lock:${PREFIX}'`)).toBe("denied");
    await admin.$executeRaw`INSERT INTO "RateLimitBucket" ("key", "generation", "count", "expiresAt") VALUES (${`lock:${PREFIX}`}, 'g', 1, now() + interval '1 hour'),
      (${`acct:${PREFIX}`}, 'g', 1, now() - interval '1 minute')`;
    expect(await sweepCall(sweeper, SWEEP_SCOPE, `SELECT store_sweep_owner_guard(now() + interval '1 day', 1000) AS n`)).toEqual([{ n: 1 }]);
    expect(await admin.$queryRaw`SELECT "key" FROM "RateLimitBucket" WHERE "key" LIKE ${`%:${PREFIX}`}`).toEqual([{ key: `lock:${PREFIX}` }]);
    await admin.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" LIKE ${`%:${PREFIX}`}`;

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
    // A live sandbox is no sweep's.
    expect(await count(admin, "tenant_state", `kind = 'sandbox' AND expires_at > now() AND tenant_id IN (${createdTenants.map((t) => `'${t}'`).join(", ")})`)).toBe(1);

    // A clock in the future does not let the sweeper purge early: the functions never judge by a later time than the database's.
    await admin.$executeRaw`
      INSERT INTO tenant_idempotency (tenant_id, key, fingerprint_hmac, seq, result, expires_at)
      VALUES (${B}, 'soon', '00', 1, '{}'::jsonb, now() + interval '1 hour')`;
    await admin.$executeRaw`
      INSERT INTO tenant_action (tenant_id, seq, action, actor, source, at, resulting_version)
      VALUES (${DEMO}, 9, '{"type": "card/dismiss", "id": "recent"}'::jsonb, 'owner', 'button', now() - interval '1 day', 9)`;
    const later = async () => Date.now() + 400 * 86_400_000;
    expect(await sweepExpiredIdempotency({ prisma: sweeper, now: later })).toBe(0);
    expect(await sweepDemoActions({ prisma: sweeper, now: later })).toBe(0);
    expect(await admin.$queryRaw`SELECT key FROM tenant_idempotency WHERE tenant_id = ${B} ORDER BY key`).toEqual([{ key: "live" }, { key: "soon" }]);
    expect(await count(admin, "tenant_action", `tenant_id = '${DEMO}'`)).toBe(1);
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
