import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RETENTION } from "@/concept/privacy/retention";

// The row-level security files hold together: the migration prepares policies without enforcing them, the operator
// scripts switch exactly the four store tables, verify-rls.sql expects exactly the migration's policies, and every
// source file that queries a store table goes through the scope helper. The behaviour is in
// tests/integration/store-rls.test.ts.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (sql: string) => sql.replace(/--.*$/gm, "");
const migration = code(read("prisma/migrations/20261122160000_store_rls_policies/migration.sql"));
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
    expect(migration).not.toMatch(/\b(ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\s+(TABLE|ROLE|INTO|FROM|ON)\b/i);
    expect(statements).toHaveLength(migration.match(/CREATE POLICY/g)!.length);
    expect(new Set(policies.map((p) => p.split(".")[0]))).toEqual(new Set(STORE));
    // The only roles it may create are the group roles, without login and with every privileged attribute off.
    expect(migration.match(/EXECUTE format\('CREATE ROLE[^']*'/g)).toEqual(["EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'"]);
    for (const role of GROUPS) expect(migration).toContain(`'${role}'`);
    // Every table has the owner's, the tenant's and support's policy; every tenant policy checks new rows too.
    for (const table of STORE) for (const policy of ["store_owner", "store_tenant", "store_support_read"]) expect(policies).toContain(`${table}.${policy}`);
    expect(migration.match(/CREATE POLICY "store_tenant"[^;]+WITH CHECK \("tenant_id" = nullif\(current_setting\('cresavo\.tenant_id', true\), ''\)\);/g)).toHaveLength(4);
    // Only the owner's policy applies to every role; every other names its group roles, and each scope its own.
    for (const { policy, table, roles, text } of statements) {
      if (policy === "store_owner") { expect(roles, `${table}.${policy}`).toEqual([]); continue; }
      expect(roles.length, `${table}.${policy} names no role`).toBeGreaterThan(0);
      for (const role of roles) expect(GROUPS, `${table}.${policy}`).toContain(role);
      if (policy === "store_tenant") expect(roles).toEqual(["cresavo_app", "cresavo_eraser"]);
      if (/'outbox'/.test(text) || policy.startsWith("store_outbox")) expect(roles, `${table}.${policy}`).toEqual(["cresavo_outbox"]);
      if (/'sweep'/.test(text) || policy.startsWith("store_sweep")) expect(roles, `${table}.${policy}`).toEqual(["cresavo_sweeper"]);
      if (policy.startsWith("store_support")) expect(roles).toEqual(["cresavo_support"]);
      if (/lookup$/.test(policy)) expect(roles).toEqual(["cresavo_app"]);
    }
    // The sandbox lookup takes only a full key.
    expect(migration).toContain("~ '^sbx_[0-9a-f]{32}$'");
  });

  it("rls-enable.sql enables and forces exactly the store tables in one transaction, and rls-disable.sql undoes it", () => {
    const enable = code(read("prisma/grants/rls-enable.sql"));
    const disable = code(read("prisma/grants/rls-disable.sql"));
    const switched = (sql: string, what: string) => [...sql.matchAll(new RegExp(`ALTER TABLE "(\\w+)" ${what} ROW LEVEL SECURITY;`, "g"))].map((m) => m[1]).sort();
    expect(switched(enable, "ENABLE")).toEqual([...STORE].sort());
    expect(switched(enable, "FORCE")).toEqual([...STORE].sort());
    expect(switched(disable, "DISABLE")).toEqual([...STORE].sort());
    expect(switched(disable, "NO FORCE")).toEqual([...STORE].sort());
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

  it("the sweep policies bound each sweep by the retention periods the sweepers use", () => {
    const sweepers = read("src/concept/store/store-sweepers.ts");
    expect(sweepers).toContain("const DEMO_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;");
    expect(migration).toContain("interval '7 days'");
    expect(migration).toContain(`interval '${RETENTION.outboxBodyDays} days'`);
    expect(migration).toContain(`interval '${RETENTION.activityPersonalDataMonths} months'`);
    expect(migration).toContain(`interval '${RETENTION.journalAccessLogMonths} months'`);
    const intervals = new Set([...migration.matchAll(/interval '([^']+)'/g)].map((m) => m[1]));
    expect([...intervals].sort()).toEqual([`${RETENTION.activityPersonalDataMonths} months`, `${RETENTION.journalAccessLogMonths} months`,
      "7 days", `${RETENTION.outboxBodyDays} days`].sort());
  });

  it("every source file that queries a store table sets its scope through tenant-scope.ts", () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => entry.isDirectory() ? files(join(dir, entry.name)) : entry.name.endsWith(".ts") ? [join(dir, entry.name)] : []);
    const root = new URL("../", import.meta.url).pathname;
    const querying = files(join(root, "src")).filter((file) => {
      const text = readFileSync(file, "utf8").replace(/^\s*(\/\/|\*).*$/gm, "");
      return /(FROM|JOIN|UPDATE|INSERT INTO|DELETE FROM)\s+(tenant_state|tenant_action|tenant_idempotency|tenant_effect)\b|\.tenantState\./.test(text);
    }).map((file) => file.slice(root.length)).sort();
    expect(querying.length).toBeGreaterThanOrEqual(8);
    for (const file of querying) {
      if (file.endsWith("tenant-scope.ts")) continue;
      expect(readFileSync(join(root, file), "utf8"), file).toMatch(/from "(\.\/|\.\.\/concept\/store\/|@\/concept\/store\/)tenant-scope"/);
    }
  });
});
