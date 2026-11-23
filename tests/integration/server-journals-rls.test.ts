import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";
import { isStub, journalsIn } from "@/concept/journals/sealed";
import { SIMULATED_SINKS } from "@/concept/store/effect-outbox";
import { journalKey } from "@/concept/store/journal-crypto";
import { JournalVault } from "@/concept/store/journal-vault";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import { scoped, type StoreScope } from "@/concept/store/tenant-scope";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { withOwnSlug } from "./own-slug";

// Server-side journals as the least-privilege logins of prisma/grants/roles.sql, with row-level security on
// (rls-enable.sql): the application login appends, reads and trashes journal_entry rows of its tenant only and
// can neither rewrite nor delete one; erasure deletes through erase_subject; support reads none. Skipped when the
// connecting role cannot create roles or alter the tables. Logins get run-time random passwords. Fictional data.

const adminUrl = process.env.DATABASE_URL!;
const run = randomUUID().slice(0, 8);
const PREFIX = `rlsj-${run}`;
const A = `${PREFIX}-a`;
const B = `${PREFIX}-b`;
const today = "2026-11-23";
const hmacSecret = randomBytes(32).toString("hex");
// A key version of its own: journal_key keeps one verifier per version for the whole database.
const KEY_VERSION = 100_000 + Math.floor(Math.random() * 800_000);
const key = journalKey(`v${KEY_VERSION}:${randomBytes(32).toString("base64")}`)!;
const SECRET = `Fictional private observation ${run}`;
const password = randomBytes(24).toString("hex");
const LOGINS = { app: `cresavo_rlsj_app_${run}`, sweeper: `cresavo_rlsj_sweeper_${run}`, support: `cresavo_rlsj_support_${run}`, outbox: `cresavo_rlsj_outbox_${run}` };
const grant = (name: string) => readFileSync(new URL(`../../prisma/grants/${name}`, import.meta.url), "utf8");
const asLogin = (login: string) => {
  const url = new URL(adminUrl);
  url.username = login;
  url.password = password;
  return url.href;
};

const clients: PrismaClient[] = [];
const client = (url: string) => {
  const made = createDatabaseClient(url, 3) as PrismaClient;
  clients.push(made);
  return made;
};
const admin = client(adminUrl);

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

const [able] = await admin.$queryRaw<Array<{ ok: boolean }>>`
  SELECT r.rolsuper OR (r.rolcreaterole AND pg_has_role(c.relowner, 'USAGE')) AS ok
  FROM pg_roles r, pg_class c WHERE r.rolname = current_user AND c.oid = 'tenant_state'::regclass`;

/** Rows changed by one statement in a scope, or how it was refused. */
async function attempt(db: PrismaClient, scope: StoreScope | null, sql: string): Promise<number | string> {
  try {
    return scope ? await scoped(db, scope, (tx) => tx.$executeRawUnsafe(sql)) : await db.$executeRawUnsafe(sql);
  } catch (error) {
    const text = String((error as { message?: unknown }).message ?? error);
    if (/row-level security/i.test(text)) return "rls";
    if (/permission denied/i.test(text)) return "denied";
    throw error;
  }
}
const visible = async (db: PrismaClient, scope: StoreScope | null, where = "true") => {
  const sql = `SELECT count(*)::int AS n FROM journal_entry WHERE ${where}`;
  const [row] = scope ? await scoped(db, scope, (tx) => tx.$queryRawUnsafe<Array<{ n: number }>>(sql)) : await db.$queryRawUnsafe<Array<{ n: number }>>(sql);
  return row.n;
};

let eraseSubjectInstalled = false;
let rlsOn = false;

describe.skipIf(!able?.ok)("server-side journals under least privilege and row-level security", () => {
  let app: PrismaClient;
  let support: PrismaClient;
  let store: PostgresStudioStore;
  let fixture: DemoState;

  beforeAll(async () => {
    const [{ exists }] = await admin.$queryRaw<Array<{ exists: boolean }>>`SELECT to_regprocedure('erase_subject(text, text)') IS NOT NULL AS exists`;
    eraseSubjectInstalled = !exists;
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
    // Two salons as they were before the flag: the sample business, journals with their text in the document.
    fixture = createDemoState(today);
    for (const id of [A, B]) {
      await admin.$executeRaw`INSERT INTO tenant_state (tenant_id, kind, doc) VALUES (${id}, 'salon', ${JSON.stringify(withOwnSlug(fixture, id))}::jsonb)`;
    }
    await runSql(grant("rls-enable.sql"));
    rlsOn = true;
    app = client(asLogin(LOGINS.app));
    support = client(asLogin(LOGINS.support));
    store = new PostgresStudioStore({
      prisma: app, hmacSecret, sinks: SIMULATED_SINKS, erasure: "function", deliverAfterCommit: false,
      listenerConnectionString: asLogin(LOGINS.app), journals: new JournalVault(key),
    });
  }, 60_000);

  afterAll(async () => {
    store?.close();
    if (rlsOn) await runSql(grant("rls-disable.sql"));
    for (const table of ["journal_entry", "tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"]) {
      await admin.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id LIKE $1`, `${PREFIX}-%`);
    }
    await admin.$executeRaw`DELETE FROM journal_key WHERE key_version = ${KEY_VERSION}`;
    await Promise.all(clients.filter((c) => c !== admin).map((c) => c.$disconnect()));
    await runSql(Object.values(LOGINS).map((login) => `DROP ROLE IF EXISTS ${login}`).join(";"));
    if (eraseSubjectInstalled) {
      await runSql(`DROP FUNCTION IF EXISTS erase_subject(text, text), erase_subject(text, text, jsonb), studio_erase_journal_mentions(text, text, jsonb), studio_redact_replay(jsonb, text, text[], text[]),
        studio_redact_replay_action(jsonb, text, text[], text[], jsonb), studio_scrub(jsonb, text[]), studio_scrub_text(text, text[]),
        studio_redact_path(jsonb, text[]), studio_phone_digits(text)`);
    }
    await admin.$disconnect();
  }, 60_000);

  it("puts journal_entry under row-level security with exactly its policies, and the logins on their allowlists", async () => {
    const [tables, problems] = await runSql(grant("verify-rls.sql"));
    expect(tables.find((r) => r.table === "journal_entry")).toMatchObject({ enabled: true, forced: true, missing: "", unexpected: "", changed: "" });
    expect(problems).toEqual([]);
    const [roleProblems] = await runSql(grant("verify-roles.sql")
      .replaceAll(":'app_login'", `'${LOGINS.app}'`).replaceAll(":'sweeper_login'", `'${LOGINS.sweeper}'`)
      .replaceAll(":'support_login'", `'${LOGINS.support}'`).replaceAll(":'outbox_login'", `'${LOGINS.outbox}'`));
    expect(roleProblems).toEqual([]);
  });

  it("moves, appends and reads as the app login, in its own tenant only", async () => {
    // The first save moves the sample journals into the table; the new entry follows.
    const [customer] = fixture.customers;
    const entry = { customerId: customer.id, date: today, staffId: fixture.staff[0].id, treatment: "Fictional care", observations: SECRET, advice: "Rest" };
    const added = await store.apply(A, { type: "journal/add", entry }, { actor: "owner", source: "button" });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(journalsIn(added.state).every(isStub)).toBe(true);
    expect(JSON.stringify(added.state)).not.toContain(SECRET);
    const read = await store.readJournals(A, customer.id, { actor: "owner" });
    expect(read.ok && read.entries.some((e) => e.observations === SECRET)).toBe(true);
    // B is moved on its first load, under its own scope.
    expect(await store.sealJournals(B)).toEqual({ ok: true, changed: true, sealed: true });
    expect(await store.sealJournals(B)).toEqual({ ok: true, changed: false, sealed: true });

    const inA = await visible(admin, null, `tenant_id = '${A}'`);
    expect(inA).toBeGreaterThan(fixture.journals.length);
    expect(await visible(app, { tenant: A })).toBe(inA);
    expect(await visible(app, { tenant: A }, `tenant_id = '${B}'`)).toBe(0);
    expect(await visible(app, null)).toBe(0);
    expect(await visible(app, { crossTenant: "sweep" })).toBe(0);

    // Append-only: no rewrite, no delete; only the trash mark changes, and only in the tenant's own rows.
    expect(await attempt(app, { tenant: A }, `UPDATE journal_entry SET ciphertext = ciphertext WHERE tenant_id = '${A}'`)).toBe("denied");
    expect(await attempt(app, { tenant: A }, `UPDATE journal_entry SET version = version WHERE tenant_id = '${A}'`)).toBe("denied");
    expect(await attempt(app, { tenant: A }, `DELETE FROM journal_entry WHERE tenant_id = '${A}'`)).toBe("denied");
    expect(await attempt(app, { tenant: A }, "TRUNCATE journal_entry")).toBe("denied");
    expect(await attempt(app, { tenant: A }, `UPDATE journal_entry SET deleted_at = deleted_at WHERE tenant_id = '${B}'`)).toBe(0);
    expect(await attempt(app, { tenant: A }, `UPDATE journal_entry SET deleted_at = deleted_at WHERE tenant_id = '${A}'`)).toBe(inA);
    expect(await attempt(app, { tenant: A }, `INSERT INTO journal_entry (tenant_id, customer_id, id, version, ciphertext, iv, key_version)
      VALUES ('${B}', 'k-1', 'j-x', 1, '\\x00000000000000000000000000000000', '\\x000000000000000000000000', 1)`)).toBe("rls");
    // The app may not link a version to one it replaces, nor call the erasure's replacement outside an erasure's checks.
    expect(await attempt(app, { tenant: A }, `INSERT INTO journal_entry (tenant_id, customer_id, id, version, ciphertext, iv, key_version, replaces)
      VALUES ('${A}', 'k-1', 'j-x', 2, '\\x00000000000000000000000000000000', '\\x000000000000000000000000', 1, 1)`)).toBe("denied");
    // Only the eraser runs the replacement, inside erase_subject; even there it holds to the tenant's scope and the customer.
    await expect(scoped(app, { tenant: A }, (tx) => tx.$queryRawUnsafe(`SELECT studio_erase_journal_mentions('${A}', 'k-1', '[]'::jsonb)`)))
      .rejects.toThrow(/permission denied/);
    const copy = `[{"id": "j-x", "replaces": 1, "version": 2, "ciphertext": "AAAAAAAAAAAAAAAAAAAAAA==", "iv": "AAAAAAAAAAAAAAAA", "keyVersion": 1}]`;
    await expect(scoped(app, { tenant: A }, (tx) => tx.$queryRawUnsafe(`SELECT erase_subject('${A}', 'k-unknown', '${copy}'::jsonb)`)))
      .rejects.toThrow(/unknown customer/);
    await expect(scoped(app, { tenant: B }, (tx) => tx.$queryRawUnsafe(`SELECT erase_subject('${A}', 'k-1', '${copy}'::jsonb)`)))
      .rejects.toThrow(/scope/);
    // The audit rows from before the move hold no journal text, and the first load marks the salon (batched replays).
    expect(await store.sealJournals(A)).toEqual({ ok: true, changed: false, sealed: true });
    const [audit] = await admin.$queryRaw<Array<{ text: number; sealed: boolean }>>`
      SELECT (SELECT count(*)::int FROM tenant_action WHERE tenant_id = ${A} AND action::text LIKE ${`%${SECRET}%`}) AS text,
        (SELECT journals_sealed_at IS NOT NULL FROM tenant_state WHERE tenant_id = ${A}) AS sealed`;
    expect(audit).toEqual({ text: 0, sealed: true });
    // Support sees no journal row at all, not even its columns.
    expect(await attempt(support, null, "SELECT count(*) FROM journal_entry")).toBe("denied");
  });

  it("erases through erase_subject: the customer's rows and the version a scrubbed copy replaced", async () => {
    const [vera, olle] = fixture.customers;
    const name = `${vera.firstName} ${vera.lastName}`.trim();
    const mention = await store.apply(A, {
      type: "journal/add", entry: { customerId: olle.id, date: today, staffId: fixture.staff[0].id, treatment: "Fictional care", observations: `Came with ${name}`, advice: "" },
    }, { actor: "owner", source: "button" });
    expect(mention.ok).toBe(true);
    const theirs = await visible(admin, null, `tenant_id = '${A}' AND customer_id = '${vera.id}'`);
    expect(theirs).toBeGreaterThan(0);
    // Olle's entry is in the trash meanwhile: the scrubbed copy keeps the trash mark.
    const deleted = await store.apply(A, { type: "customer/delete", id: olle.id }, { actor: "owner", source: "button" });
    expect(deleted.ok).toBe(true);
    const erased = await store.eraseSubject(A, vera.id, { actor: "owner", source: "button" });
    expect(erased).toMatchObject({ ok: true, redacted: { journalEntries: theirs } });
    expect(await visible(admin, null, `tenant_id = '${A}' AND replaces IS NOT NULL AND deleted_at IS NOT NULL`)).toBe(1);
    const trashId = (await store.load(A))!.state.trash.find((t) => t.kind === "customer" && t.customer.id === olle.id)!.id;
    expect((await store.apply(A, { type: "trash/restore", id: trashId }, { actor: "owner", source: "button" })).ok).toBe(true);
    expect(await visible(admin, null, `tenant_id = '${A}' AND customer_id = '${vera.id}'`)).toBe(0);
    expect(await visible(admin, null, `tenant_id = '${A}' AND replaces IS NOT NULL`)).toBe(1);
    const olles = await store.readJournals(A, olle.id, { actor: "owner" });
    expect(olles.ok && olles.entries.map((e) => e.observations)).toContain("Came with [removed]");
    expect(JSON.stringify(olles)).not.toContain(name);
    // B, with the same customer ids, keeps everything.
    expect(await visible(admin, null, `tenant_id = '${B}' AND customer_id = '${vera.id}'`)).toBeGreaterThan(0);
  });
});
