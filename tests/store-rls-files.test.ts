import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The row-level security files hold together: the migration prepares policies without enforcing them, the operator
// scripts switch exactly the four store tables, verify-rls.sql expects exactly the migration's policies, and every
// source file that queries a store table goes through the scope helper. The behaviour is in
// tests/integration/store-rls.test.ts.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const code = (sql: string) => sql.replace(/--.*$/gm, "");
const migration = code(read("prisma/migrations/20261122160000_store_rls_policies/migration.sql"));
const STORE = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"];

const policies = [...migration.matchAll(/CREATE POLICY "(\w+)" ON "(\w+)"/g)].map(([, policy, table]) => `${table}.${policy}`).sort();

describe("store row-level security files", () => {
  it("the migration creates policies on the store tables only and enforces nothing", () => {
    expect(migration).not.toMatch(/ROW LEVEL SECURITY/i);
    expect(migration).not.toMatch(/\b(ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\s+(TABLE|ROLE|INTO|FROM|ON)\b/i);
    expect(new Set(policies.map((p) => p.split(".")[0]))).toEqual(new Set(STORE));
    // Every table has the owner's, the tenant's and support's policy; every tenant policy checks new rows too.
    for (const table of STORE) for (const policy of ["store_owner", "store_tenant", "store_support_read"]) expect(policies).toContain(`${table}.${policy}`);
    expect(migration.match(/CREATE POLICY "store_tenant"[^;]+WITH CHECK \("tenant_id" = nullif\(current_setting\('cresavo\.tenant_id', true\), ''\)\);/g)).toHaveLength(4);
    // Each cross-tenant scope is tied to its group role.
    for (const block of migration.split(";").filter((s) => /'outbox'/.test(s))) expect(block).toContain("'cresavo_app'");
    for (const block of migration.split(";").filter((s) => /'sweep'/.test(s))) expect(block).toContain("'cresavo_sweeper'");
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

  it("verify-rls.sql expects exactly the migration's policies", () => {
    const verify = code(read("prisma/grants/verify-rls.sql"));
    const expected = [...verify.matchAll(/\('(tenant_\w+)', '(\w+)'\)/g)].map(([, table, policy]) => `${table}.${policy}`).sort();
    expect(expected).toEqual(policies);
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
