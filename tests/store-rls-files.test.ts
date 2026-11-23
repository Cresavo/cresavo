import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETENTION } from "@/concept/privacy/retention";
import { PERSONAL_FIELDS } from "@/concept/store/erasure";

// The row-level security files hold together: the migration prepares policies and the outbox and sweep functions
// without enforcing anything, the operator scripts switch exactly the four store tables, verify-rls.sql expects
// exactly the migration's policies, the sweep functions carry the retention periods, and every source file that
// queries a store table goes through the scope helper. The behaviour is in tests/integration/store-rls.test.ts.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (sql: string) => sql.replace(/--.*$/gm, "");
const rawMigration = read("prisma/migrations/20261122160000_store_rls_policies/migration.sql");
const migration = code(rawMigration);
/** The migration before its functions: the policies and the role check. */
const head = code(rawMigration.slice(0, rawMigration.indexOf("-- STORE FUNCTIONS BEGIN")));
const STORE = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"];

const statements = [...migration.matchAll(/CREATE POLICY "(\w+)" ON "(\w+)" FOR (\w+)(?: TO ([\w, ]+?))?\s+(?:USING|WITH)[^;]*;/g)]
  .map(([text, policy, table, command, roles]) => ({ text, policy, table, command, roles: roles?.split(",").map((r) => r.trim()) ?? [] }));
const policies = statements.map(({ table, policy }) => `${table}.${policy}`).sort();
const GROUPS = ["cresavo_app", "cresavo_eraser", "cresavo_sweeper", "cresavo_support", "cresavo_outbox"];
/** (table, policy, digest) triples of an operator script's expected list. */
const expectedList = (sql: string) => [...sql.matchAll(/\('(tenant_\w+)', '(\w+)', '([0-9a-f]{32})'\)/g)].map(([, table, policy, digest]) => `${table}.${policy}:${digest}`).sort();

describe("store row-level security files", () => {
  it("the migration creates policies on the store tables only and enforces nothing", () => {
    expect(migration).not.toMatch(/ROW LEVEL SECURITY/i);
    expect(head).not.toMatch(/\b(ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\s+(TABLE|ROLE|INTO|FROM|ON)\b/i);
    expect(migration).not.toMatch(/\b(ALTER TABLE|DROP|CREATE TABLE|ALTER ROLE)\b/i);
    expect(statements).toHaveLength(migration.match(/CREATE POLICY/g)!.length);
    expect(new Set(policies.map((p) => p.split(".")[0]))).toEqual(new Set(STORE));
    // It creates no role: the groups come from bootstrap-roles.sql, and the migration stops without them.
    expect(migration).not.toMatch(/CREATE ROLE/i);
    expect(rawMigration).toContain("bootstrap-roles.sql");
    expect(rawMigration).toContain("prisma migrate resolve --rolled-back 20261122160000_store_rls_policies");
    for (const role of GROUPS) expect(migration).toContain(`'${role}'`);
    // Every table has the owner's, the tenant's and support's policy; every tenant policy checks new rows too.
    for (const table of STORE) for (const policy of ["store_owner", "store_tenant", "store_support_read"]) expect(policies).toContain(`${table}.${policy}`);
    expect(migration.match(/CREATE POLICY "store_tenant"[^;]+WITH CHECK \("tenant_id" = nullif\(current_setting\('cresavo\.tenant_id', true\), ''\)\);/g)).toHaveLength(4);
    // Only the owner's policy applies to every role; the poller and the sweeper have none (they use the functions).
    for (const { policy, table, roles } of statements) {
      if (policy === "store_owner") { expect(roles, `${table}.${policy}`).toEqual([]); continue; }
      expect(roles.length, `${table}.${policy} names no role`).toBeGreaterThan(0);
      if (policy === "store_tenant") expect(roles).toEqual(["cresavo_app", "cresavo_eraser"]);
      else if (policy === "store_support_read") expect(roles).toEqual(["cresavo_support"]);
      else expect(roles, `${table}.${policy}`).toEqual(["cresavo_app"]);
    }
    expect(policies.filter((p) => !/store_(owner|tenant|support_read)$/.test(p))).toEqual(["tenant_state.store_salon_slug_lookup", "tenant_state.store_sandbox_lookup"]);
    // The sandbox lookup takes only a full key.
    expect(migration).toContain("~ '^sbx_[0-9a-f]{32}$'");
  });

  it("defines every store function as SECURITY DEFINER with a fixed search_path, executable only by its roles", () => {
    const functions = [...migration.matchAll(/CREATE FUNCTION (store_\w+)\(([^)]*)\)[\s\S]*?\$fn\$;/g)];
    expect(functions.length).toBeGreaterThan(20);
    for (const [text, name] of functions) {
      expect(text, name).toContain("SET search_path = public, pg_temp");
      const definer = text.includes("SECURITY DEFINER");
      expect(definer, `${name} SECURITY DEFINER`).toBe(/^store_(outbox|sweep)_/.test(name) && !["store_sweep_check", "store_outbox_caller"].includes(name));
      expect(migration, `${name} is revoked from PUBLIC`).toMatch(new RegExp(`REVOKE ALL ON FUNCTION[^;]*\\b${name}\\(`));
    }
    const grantsTo = (role: string) => [...migration.matchAll(/GRANT EXECUTE ON FUNCTION ([^;]+?) TO ([a-z_, ]+);/g)]
      .filter(([, , roles]) => roles.split(",").map((r) => r.trim()).includes(role))
      .flatMap(([, list]) => [...list.matchAll(/(store_\w+)\(/g)].map((m) => m[1])).sort();
    expect(grantsTo("cresavo_outbox")).toEqual(functions.map(([, name]) => name).filter((n) => n.startsWith("store_outbox_") && n !== "store_outbox_caller").sort());
    expect(grantsTo("cresavo_app")).toEqual(grantsTo("cresavo_outbox"));
    expect(grantsTo("cresavo_sweeper")).toEqual(functions.map(([, name]) => name).filter((n) => n.startsWith("store_sweep_") && n !== "store_sweep_check").sort());
    // The sweep functions redact with the same map as the application and erase_subject.
    const literal = rawMigration.match(/-- PERSONAL_FIELDS BEGIN[^\n]*\n\s*v_fields constant jsonb := '([\s\S]*?)';\n\s*-- PERSONAL_FIELDS END/);
    expect(JSON.parse(literal![1])).toEqual(JSON.parse(JSON.stringify(PERSONAL_FIELDS)));
  });

  it("studio-store.sql repeats the migration's function privileges, so a restore without privileges gets them back", () => {
    const privileges = (sql: string) => sql.slice(sql.indexOf("REVOKE ALL ON FUNCTION store_caller_owns()")).match(/(REVOKE ALL ON FUNCTION|GRANT EXECUTE ON FUNCTION)[^;]+;/g);
    const fromMigration = privileges(rawMigration);
    expect(fromMigration).toHaveLength(5);
    expect(privileges(read("prisma/grants/studio-store.sql"))).toEqual(fromMigration);
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
    expect(switched(enable, "ENABLE")).toEqual([...STORE].sort());
    expect(switched(enable, "FORCE")).toEqual([...STORE].sort());
    expect(switched(disable, "DISABLE")).toEqual([...STORE].sort());
    expect(switched(disable, "NO FORCE")).toEqual([...STORE].sort());
    expect(enable.indexOf("LOCK TABLE")).toBeGreaterThan(-1);
    expect(enable.indexOf("LOCK TABLE")).toBeLessThan(enable.indexOf("pg_policies"));
    expect(enable).toContain('LOCK TABLE "tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect" IN ACCESS EXCLUSIVE MODE;');
    for (const sql of [enable, disable]) {
      expect(sql.trim().startsWith("BEGIN;")).toBe(true);
      expect(sql.trim().endsWith("COMMIT;")).toBe(true);
      expect(sql).not.toMatch(/(CREATE|DROP|ALTER) POLICY|\bGRANT\b|PASSWORD/i);
    }
  });

  it("rls-enable.sql and verify-rls.sql expect exactly the migration's policies, with the same digests", () => {
    const enable = expectedList(code(read("prisma/grants/rls-enable.sql")));
    const verify = expectedList(code(read("prisma/grants/verify-rls.sql")));
    expect(enable.map((e) => e.split(":")[0])).toEqual(policies);
    expect(verify).toEqual(enable);
  });

  it("the sweep functions bound each sweep by the retention periods of retention.ts", () => {
    const intervals = new Set([...migration.matchAll(/interval '([^']+)'/g)].map((m) => m[1]));
    expect([...intervals].sort()).toEqual([`${RETENTION.activityPersonalDataMonths} months`, `${RETENTION.journalAccessLogMonths} months`,
      "168 hours", `${RETENTION.outboxBodyDays * 24} hours`].sort());
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
