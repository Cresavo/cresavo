import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// prisma/grants/roles.sql is documentation for operators, so nothing else runs it. This test parses its GRANT
// statements and holds them to the code: every table and column the sweepers touch must be granted to the sweep
// role, the support role must not see payloads, and every Prisma table must be accounted for.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("prisma/grants/roles.sql");
const sweepers = read("src/concept/store/store-sweepers.ts");
const schema = read("prisma/schema.prisma");
const code = sql.replace(/^--.*$/gm, "");

const names = (list: string) => [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/** role -> table -> privilege -> columns ("*" when granted on the whole table). */
function parseGrants(text: string) {
  const out = new Map<string, Map<string, Map<string, Set<string>>>>();
  for (const m of text.matchAll(/GRANT\s+(?!EXECUTE|CONNECT|USAGE|CREATE)([\s\S]+?)\s+ON\s+((?:"[^"]+"\s*,?\s*)+)\s+TO\s+([a-z_, ]+);/g)) {
    const privileges = [...m[1].matchAll(/(SELECT|INSERT|UPDATE|DELETE)(?:\s*\(([^)]*)\))?/g)];
    for (const role of m[3].split(",").map((r) => r.trim())) {
      for (const table of names(m[2])) {
        const tables = out.get(role) ?? out.set(role, new Map()).get(role)!;
        const privs = tables.get(table) ?? tables.set(table, new Map()).get(table)!;
        for (const [, privilege, columns] of privileges) {
          const set = privs.get(privilege) ?? privs.set(privilege, new Set()).get(privilege)!;
          for (const column of columns ? names(columns) : ["*"]) set.add(column);
        }
      }
    }
  }
  return out;
}

const grants = parseGrants(code);
const can = (role: string, table: string, privilege: string, column?: string) => {
  const set = grants.get(role)?.get(table)?.get(privilege);
  return !!set && (set.has("*") || (column !== undefined && set.has(column)));
};
const anyColumn = (role: string, table: string, privilege: string) => !!grants.get(role)?.get(table)?.get(privilege)?.size;

describe("prisma/grants/roles.sql", () => {
  it("holds no password and creates only NOLOGIN roles", () => {
    expect(code).not.toMatch(/PASSWORD/i);
    expect(code).not.toMatch(/CREATE ROLE[^;]*\bLOGIN\b/i);
    expect(code).toContain("CREATE ROLE %I NOLOGIN");
    for (const role of ["cresavo_app", "cresavo_eraser", "cresavo_sweeper", "cresavo_support"]) expect(code).toContain(`'${role}'`);
  });

  it("grants the sweep role every table and column the sweepers read, lock and delete", () => {
    const body = sweepers.replace(/^\s*\/\/.*$/gm, "");
    const deleted = [...body.matchAll(/DELETE FROM\s+"?(\w+)"?/g)].map((m) => m[1]);
    const used = [...body.matchAll(/(?:FROM|JOIN)\s+"?(\w+)"?/g)].map((m) => m[1]);
    const tables = new Set([...deleted, ...used].filter((t) => /^(tenant_\w+|RateLimitBucket)$/.test(t)));
    expect([...tables].sort()).toEqual(["RateLimitBucket", "tenant_action", "tenant_effect", "tenant_idempotency", "tenant_state"]);
    for (const table of tables) expect(grants.get("cresavo_sweeper")?.has(table), `${table} is not granted to cresavo_sweeper`).toBe(true);
    for (const table of new Set(deleted)) expect(can("cresavo_sweeper", table, "DELETE"), `DELETE on ${table}`).toBe(true);

    // Columns named in the sweepers' predicates, joins and locks.
    const selected: Record<string, string[]> = {
      tenant_state: ["tenant_id", "kind", "expires_at"],
      tenant_action: ["tenant_id", "seq", "at"],
      tenant_idempotency: ["tenant_id", "key", "expires_at"],
      tenant_effect: ["tenant_id"],
      RateLimitBucket: ["key", "expiresAt"],
    };
    for (const [table, columns] of Object.entries(selected)) {
      for (const column of columns) {
        expect(body, `${column} is no longer used by the sweepers`).toContain(column);
        expect(can("cresavo_sweeper", table, "SELECT", column), `SELECT ${table}.${column}`).toBe(true);
      }
    }
    // FOR UPDATE [OF a] [SKIP LOCKED] needs UPDATE on a column of each locked table.
    for (const table of ["tenant_state", "tenant_action", "tenant_idempotency"]) expect(anyColumn("cresavo_sweeper", table, "UPDATE"), `UPDATE ${table}`).toBe(true);
    expect(body.match(/FOR UPDATE/g)?.length, "a new row lock needs a grant: update roles.sql").toBe(3);
  });

  it("never lets the sweep role read documents or payloads or touch other tables", () => {
    for (const [table, column] of [["tenant_state", "doc"], ["tenant_action", "action"], ["tenant_effect", "payload"], ["tenant_idempotency", "result"]]) {
      expect(can("cresavo_sweeper", table, "SELECT", column), `${table}.${column}`).toBe(false);
    }
    expect([...(grants.get("cresavo_sweeper")?.keys() ?? [])].sort()).toEqual(["RateLimitBucket", "tenant_action", "tenant_effect", "tenant_idempotency", "tenant_state"]);
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION erase_subject\(text, text\) TO cresavo_sweeper/);
  });

  it("leaves the store tables to studio-store.sql so the audit log stays append-only for the application", () => {
    const app = grants.get("cresavo_app");
    for (const table of ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"]) expect(app?.has(table), table).toBe(false);
    expect(can("cresavo_app", "RateLimitBucket", "DELETE")).toBe(true);
    expect(can("cresavo_app", "Booking", "DELETE")).toBe(false);
  });

  it("gives the support role read access only, without payloads or secrets", () => {
    const support = grants.get("cresavo_support")!;
    for (const [table, privileges] of support) expect([...privileges.keys()], table).toEqual(["SELECT"]);
    for (const [table, column] of [["tenant_state", "doc"], ["tenant_action", "action"], ["tenant_action", "idempotency_key"], ["tenant_effect", "payload"],
      ["tenant_idempotency", "result"], ["owner_account", "password_hash"], ["owner_account", "email"], ["owner_session", "id"]]) {
      expect(can("cresavo_support", table, "SELECT", column), `${table}.${column}`).toBe(false);
    }
    expect(support.has("Customer")).toBe(false);
  });

  it("accounts for every table of the Prisma schema", () => {
    const tables = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name);
    expect(tables.length).toBeGreaterThan(30);
    const sandbox = new Set(["SandboxSession", "SandboxPhone", "SandboxPairBudget", "SandboxAudit"]); // separate sandbox database
    const store = new Set(["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"]); // studio-store.sql
    for (const table of tables) {
      if (sandbox.has(table) || store.has(table)) continue;
      const all = ["SELECT", "INSERT", "UPDATE"].every((p) => can("cresavo_app", table, p));
      expect(all, `${table} is not granted to cresavo_app`).toBe(true);
    }
  });
});
