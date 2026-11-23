import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETENTION } from "@/concept/privacy/retention";
import { PERSONAL_FIELDS } from "@/concept/store/erasure";

// The row-level security files hold together: the migration creates only the outbox and sweep functions, closed to
// PUBLIC and naming no role; rls-enable.sql creates exactly the policies its digests expect and switches exactly the
// four store tables, rls-disable.sql undoes both; the grants files open the functions to their roles; the sweep
// functions carry the retention periods; and every source file that queries a store table goes through the scope
// helper. The behaviour is in tests/integration/store-rls.test.ts.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (sql: string) => sql.replace(/--.*$/gm, "");
const rawMigration = read("prisma/migrations/20261122160000_store_rls_policies/migration.sql");
const migration = code(rawMigration);
const rawEnable = read("prisma/grants/rls-enable.sql");
const enableCode = code(rawEnable);
const STORE = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"];
/** The tables under row-level security: the store's and the server-side journal table. */
const PROTECTED = [...STORE, "journal_entry"];

const statements = [...enableCode.matchAll(/CREATE POLICY "(\w+)" ON "(\w+)" FOR (\w+)(?: TO ([\w, ]+?))?\s+(?:USING|WITH)[^;]*;/g)]
  .map(([text, policy, table, command, roles]) => ({ text, policy, table, command, roles: roles?.split(",").map((r) => r.trim()) ?? [] }));
const policies = statements.map(({ table, policy }) => `${table}.${policy}`).sort();
const GROUPS = ["cresavo_app", "cresavo_eraser", "cresavo_sweeper", "cresavo_support", "cresavo_outbox"];
/** (table, policy, digest) triples of an operator script's expected list. */
const expectedList = (sql: string) => [...sql.matchAll(/\('((?:tenant|journal)_\w+)', '(\w+)', '([0-9a-f]{32})'\)/g)].map(([, table, policy, digest]) => `${table}.${policy}:${digest}`).sort();

describe("store row-level security files", () => {
  it("the migration creates only the store functions: no policy, grant, role or table change", () => {
    expect(migration).not.toMatch(/ROW LEVEL SECURITY|CREATE POLICY|GRANT |CREATE ROLE|ALTER ROLE/i);
    expect(migration).not.toMatch(/\b(DROP|CREATE TABLE)\b/i);
    // Its only table change: the two outbox columns the functions keep the claim and a late confirmation in.
    expect(migration.match(/ALTER TABLE[^;]+;/g)).toEqual([
      'ALTER TABLE "tenant_effect" ADD COLUMN "claim_token" UUID;', 'ALTER TABLE "tenant_effect" ADD COLUMN "late_confirmation" JSONB;']);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION/);
    // A role is only ever looked up by name when a function runs, never needed to create one.
    const roleMentions = [...migration.matchAll(/'(cresavo_\w+)'/g)].map((m) => m.index!);
    for (const at of roleMentions) expect(migration.slice(at - 17, at)).toMatch(/store_caller_in\($/);
    expect(roleMentions.length).toBeGreaterThan(0);
  });

  it("rls-enable.sql checks the roles, locks the tables, creates the policies, checks them and then enforces", () => {
    const order = ["$roles$", "LOCK TABLE", "CREATE POLICY", "$check$", "ENABLE ROW LEVEL SECURITY"].map((mark) => enableCode.indexOf(mark));
    for (const at of order) expect(at).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(enableCode).toContain('LOCK TABLE "tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect", "journal_entry" IN ACCESS EXCLUSIVE MODE;');
    for (const role of GROUPS) expect(enableCode).toContain(`'${role}'`);
    expect(statements).toHaveLength(enableCode.match(/CREATE POLICY/g)!.length);
    expect(new Set(policies.map((p) => p.split(".")[0]))).toEqual(new Set(PROTECTED));
    // Every policy it creates is dropped first (a second run replaces them) and again by rls-disable.sql.
    const dropped = (sql: string) => [...sql.matchAll(/DROP POLICY IF EXISTS "(\w+)" ON "(\w+)";/g)].map(([, policy, table]) => `${table}.${policy}`).sort();
    expect(dropped(enableCode)).toEqual(policies);
    expect(dropped(code(read("prisma/grants/rls-disable.sql")))).toEqual(policies);
    // Every table has the owner's, the tenant's and support's policy; every tenant policy checks new rows too.
    for (const table of STORE) for (const policy of ["store_owner", "store_tenant", "store_support_read"]) expect(policies).toContain(`${table}.${policy}`);
    // Journal entries may be health data: the owner's and the tenant's policy only, no support read.
    expect(policies.filter((p) => p.startsWith("journal_entry."))).toEqual(["journal_entry.store_owner", "journal_entry.store_tenant"]);
    expect(enableCode.match(/CREATE POLICY "store_tenant"[^;]+WITH CHECK \("tenant_id" = nullif\(current_setting\('cresavo\.tenant_id', true\), ''\)\);/g)).toHaveLength(5);
    // Only the owner's policy applies to every role; the poller and the sweeper have none (they use the functions).
    for (const { policy, table, roles } of statements) {
      if (policy === "store_owner") { expect(roles, `${table}.${policy}`).toEqual([]); continue; }
      expect(roles.length, `${table}.${policy} names no role`).toBeGreaterThan(0);
      if (policy === "store_tenant") expect(roles).toEqual(["cresavo_app", "cresavo_eraser"]);
      else if (policy === "store_support_read") expect(roles).toEqual(["cresavo_support"]);
      else expect(roles, `${table}.${policy}`).toEqual(["cresavo_app"]);
    }
    // A booking address resolves through store_salon_by_slug (a tenant id only), never through a policy on the row.
    expect(policies.filter((p) => !/store_(owner|tenant|support_read)$/.test(p))).toEqual(["tenant_state.store_sandbox_lookup"]);
    // The sandbox lookup takes only a full key.
    expect(enableCode).toContain("~ '^sbx_[0-9a-f]{32}$'");
  });

  it("defines every store function as SECURITY DEFINER with a fixed search_path, executable only by its roles", () => {
    const functions = [...migration.matchAll(/CREATE FUNCTION (store_\w+)\(([^)]*)\)[\s\S]*?\$fn\$;/g)];
    expect(functions.length).toBeGreaterThan(20);
    for (const [text, name] of functions) {
      expect(text, name).toContain("SET search_path = public, pg_temp");
      const definer = text.includes("SECURITY DEFINER");
      expect(definer, `${name} SECURITY DEFINER`).toBe(/^store_(outbox|sweep|salon)_/.test(name) && !["store_sweep_check", "store_outbox_caller"].includes(name));
      // Every authorization in a body is IS TRUE (or IS NOT TRUE): an unset setting never passes.
      for (const call of text.matchAll(/(?<!FUNCTION )store_outbox_caller\([^)]*\)(?! IS TRUE)/g)) {
        expect(text.slice(call.index!, call.index! + call[0].length + 8), name).toContain("IS TRUE");
      }
      expect(migration, `${name} is revoked from PUBLIC`).toMatch(new RegExp(`REVOKE ALL ON FUNCTION[^;]*\\b${name}\\(`));
    }
    const grantFiles = code(read("prisma/grants/roles.sql")) + code(read("prisma/grants/studio-store.sql"));
    const grantsTo = (role: string) => [...grantFiles.matchAll(/GRANT EXECUTE ON FUNCTION ([^;]+?) TO ([a-z_, ]+);/g)]
      .filter(([, , roles]) => roles.split(",").map((r) => r.trim()).includes(role))
      .flatMap(([, list]) => [...list.matchAll(/(store_\w+)\(/g)].map((m) => m[1])).sort();
    expect(grantsTo("cresavo_outbox")).toEqual(functions.map(([, name]) => name).filter((n) => n.startsWith("store_outbox_") && n !== "store_outbox_caller").sort());
    // And the journal migration's audit redaction, for the app moving its own tenant's journals.
    expect(grantsTo("cresavo_app")).toEqual([...grantsTo("cresavo_outbox"), "store_journal_redact_audit", "store_salon_by_slug"].sort());
    expect(grantsTo("cresavo_sweeper")).toEqual(functions.map(([, name]) => name).filter((n) => n.startsWith("store_sweep_") && n !== "store_sweep_check").sort());
    expect(grantsTo("cresavo_support")).toEqual([]);
    // The sweep functions redact with the same map as the application and erase_subject.
    const literal = rawMigration.match(/-- PERSONAL_FIELDS BEGIN[^\n]*\n\s*v_fields constant jsonb := '([\s\S]*?)';\n\s*-- PERSONAL_FIELDS END/);
    expect(JSON.parse(literal![1])).toEqual(JSON.parse(JSON.stringify(PERSONAL_FIELDS)));
  });

  it("studio-store.sql repeats the migration's revokes, so a restore without privileges closes the functions again", () => {
    const revokes = (sql: string) => sql.match(/REVOKE ALL ON FUNCTION store_[^;]+;/g);
    expect(revokes(rawMigration)).toHaveLength(3);
    const journals = read("prisma/migrations/20261123090000_server_journals/migration.sql");
    expect(revokes(journals)).toEqual(["REVOKE ALL ON FUNCTION store_journal_redact_audit(text, jsonb) FROM PUBLIC;"]);
    expect(revokes(read("prisma/grants/studio-store.sql"))).toEqual([...revokes(rawMigration)!, ...revokes(journals)!]);
  });

  it("bootstrap-roles.sql and roles.sql create the same group roles in the same way", () => {
    const block = (sql: string) => sql.match(/DO \$roles\$[\s\S]*?\$roles\$;/)![0];
    expect(block(read("prisma/grants/bootstrap-roles.sql"))).toEqual(block(read("prisma/grants/roles.sql")));
    for (const role of GROUPS) expect(block(read("prisma/grants/bootstrap-roles.sql"))).toContain(`'${role}'`);
  });

  it("rls-enable.sql enables and forces exactly the store tables in one transaction, and rls-disable.sql undoes it", () => {
    const enable = code(read("prisma/grants/rls-enable.sql"));
    const disable = code(read("prisma/grants/rls-disable.sql"));
    const switched = (sql: string, what: string) => [...sql.matchAll(new RegExp(`ALTER TABLE "(\\w+)" ${what} ROW LEVEL SECURITY;`, "g"))].map((m) => m[1]).sort();
    expect(switched(enable, "ENABLE")).toEqual([...PROTECTED].sort());
    expect(switched(enable, "FORCE")).toEqual([...PROTECTED].sort());
    expect(switched(disable, "DISABLE")).toEqual([...PROTECTED].sort());
    expect(switched(disable, "NO FORCE")).toEqual([...PROTECTED].sort());
    expect(enable.indexOf("LOCK TABLE")).toBeLessThan(enable.indexOf("pg_policies"));
    for (const sql of [enable, disable]) {
      expect(sql.trim().startsWith("BEGIN;")).toBe(true);
      expect(sql.trim().endsWith("COMMIT;")).toBe(true);
      expect(sql).not.toMatch(/ALTER POLICY|\bGRANT\b|PASSWORD/i);
      expect(sql.match(/\bCOMMIT;/g)).toHaveLength(1);
    }
    expect(disable).not.toMatch(/CREATE POLICY/);
  });

  it("rls-enable.sql and verify-rls.sql expect exactly the policies rls-enable.sql creates, with the same digests", () => {
    const enable = expectedList(enableCode);
    const verify = expectedList(code(read("prisma/grants/verify-rls.sql")));
    expect(enable.map((e) => e.split(":")[0])).toEqual(policies);
    expect(verify).toEqual(enable);
  });

  it("the sweep functions bound each sweep by the retention periods of retention.ts", () => {
    const intervals = new Set([...migration.matchAll(/interval '([^']+)'/g)].map((m) => m[1]));
    expect([...intervals].sort()).toEqual([`${RETENTION.activityPersonalDataMonths} months`, `${RETENTION.journalAccessLogMonths} months`,
      "168 hours", `${RETENTION.outboxBodyDays * 24} hours`, `${RETENTION.rateLimitDays * 24} hours`, "2 hours"].sort());
    // The longest wait the outbox may set ("2 hours") is above its longest backoff, an hour.
    expect(rawMigration).toContain("least(greatest(coalesce(p_next, store_clock(p_now)), store_clock(p_now)), store_clock(p_now) + interval '2 hours')");
    // The demo log is kept seven days (an engineering default, not a personal-data period in retention.ts).
    expect(rawMigration).toContain("demo log 168 hours");
    // Calendar months are counted in UTC, as monthsBefore does.
    expect(migration.match(/AT TIME ZONE 'UTC'\) - interval '\d+ months'\) AT TIME ZONE 'UTC'/g)?.length).toBe(3);
  });

  it("every source file that queries a store table sets its scope through tenant-scope.ts", () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []);
    const root = new URL("../", import.meta.url).pathname;
    const querying = files(join(root, "src")).filter((file) => {
      const text = readFileSync(file, "utf8").replace(/^\s*(\/\/|\*).*$/gm, "");
      return /(FROM|JOIN|UPDATE|INSERT INTO|DELETE FROM)\s+(tenant_state|tenant_action|tenant_idempotency|tenant_effect)\b|\.tenantState\.|store_(outbox|sweep)_\w+\(/.test(text);
    }).map((file) => file.slice(root.length)).sort();
    expect(querying.length).toBeGreaterThanOrEqual(8);
    for (const file of querying) {
      if (file.endsWith("tenant-scope.ts")) continue;
      expect(readFileSync(join(root, file), "utf8"), file).toMatch(/from "(\.\/|\.\.\/concept\/store\/|@\/concept\/store\/)tenant-scope"/);
    }
  });
});
