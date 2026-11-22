import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// prisma/grants/roles.sql is documentation for operators, so nothing else runs it. This test parses its GRANT
// statements and holds them to the code: every table and column the sweepers touch must be granted to the sweep
// role, the support role must not see payloads, the application gets only the operations its code performs, and
// every Prisma table is accounted for. The effective privileges of real logins are checked by verify-roles.sql.

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sql = read("prisma/grants/roles.sql");
const sweepers = read("src/concept/store/store-sweepers.ts");
const schema = read("prisma/schema.prisma");
const code = sql.replace(/^--.*$/gm, "");

const names = (list: string) => [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

/** role -> table -> privilege -> columns ("*" when granted on the whole table). */
function parseGrants(text: string) {
  const out = new Map<string, Map<string, Map<string, Set<string>>>>();
  for (const m of text.matchAll(/GRANT\s+(?!EXECUTE|CONNECT|USAGE|CREATE)([\s\S]+?)\s+ON\s+("[^"]+"(?:\s*,\s*"[^"]+")*)\s+TO\s+([a-z_, ]+);/g)) {
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
const STORE = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"];

describe("prisma/grants/roles.sql", () => {
  it("holds no password, creates only NOLOGIN roles and never alters a role", () => {
    expect(code).not.toMatch(/PASSWORD/i);
    expect(code).not.toMatch(/ALTER ROLE/i);
    expect(code).not.toMatch(/CREATE ROLE[^;]*\bLOGIN\b/i);
    expect(code).toContain("CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
    expect(code).toContain("RAISE EXCEPTION");
    for (const role of ["cresavo_app", "cresavo_eraser", "cresavo_sweeper", "cresavo_support"]) expect(code).toContain(`'${role}'`);
  });

  it("is one transaction", () => {
    expect(code.trim().startsWith("BEGIN;")).toBe(true);
    expect(code.trim().endsWith("COMMIT;")).toBe(true);
    expect(code.match(/\bBEGIN;/g)).toHaveLength(1);
    expect(code.match(/\bCOMMIT;/g)).toHaveLength(1);
  });

  it("grants the sweep role every table and column the sweepers read, lock, change and delete", () => {
    const body = sweepers.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const mentioned = [...body.matchAll(/(?:FROM|JOIN|UPDATE|DELETE FROM)\s+"?(\w+)"?/g)].map((m) => m[1]);
    const tables = new Set(mentioned.filter((t) => /^(tenant_\w+|RateLimitBucket)$/.test(t)));
    expect([...tables].sort()).toEqual(["RateLimitBucket", ...STORE.slice(1), "tenant_state"].sort());
    for (const table of tables) expect(grants.get("cresavo_sweeper")?.has(table), `${table} is not granted to cresavo_sweeper`).toBe(true);
    for (const table of new Set([...body.matchAll(/DELETE FROM\s+"?(\w+)"?/g)].map((m) => m[1]))) expect(can("cresavo_sweeper", table, "DELETE"), `DELETE on ${table}`).toBe(true);

    // Columns named in the sweepers' predicates, joins, locks and updates.
    const selected: Record<string, string[]> = {
      tenant_state: ["tenant_id", "kind", "expires_at"],
      tenant_action: ["tenant_id", "seq", "at", "action", "idempotency_key", "redacted_at"],
      tenant_idempotency: ["tenant_id", "key", "expires_at"],
      tenant_effect: ["tenant_id", "seq", "n", "kind", "status", "payload", "delivered_at", "next_attempt_at"],
      RateLimitBucket: ["key", "expiresAt"],
    };
    for (const [table, columns] of Object.entries(selected)) {
      for (const column of columns) {
        expect(body, `${column} is no longer used by the sweepers`).toContain(column);
        expect(can("cresavo_sweeper", table, "SELECT", column), `SELECT ${table}.${column}`).toBe(true);
      }
    }
    for (const column of ["action", "idempotency_key", "redacted_at"]) expect(can("cresavo_sweeper", "tenant_action", "UPDATE", column), `UPDATE tenant_action.${column}`).toBe(true);
    expect(can("cresavo_sweeper", "tenant_effect", "UPDATE", "payload")).toBe(true);
    // FOR UPDATE [OF a] [SKIP LOCKED] needs UPDATE on a column of each locked table.
    for (const table of tables) expect(anyColumn("cresavo_sweeper", table, "UPDATE"), `UPDATE ${table}`).toBe(true);
    expect(body.match(/FOR UPDATE/g)?.length, "a new row lock or update needs a grant: update roles.sql").toBe(8);
  });

  it("never lets the sweep role read documents or replay results, call erase_subject or touch other tables", () => {
    for (const [table, column] of [["tenant_state", "doc"], ["tenant_idempotency", "result"], ["tenant_idempotency", "fingerprint_hmac"], ["tenant_effect", "fingerprint"]]) {
      expect(can("cresavo_sweeper", table, "SELECT", column), `${table}.${column}`).toBe(false);
    }
    expect([...(grants.get("cresavo_sweeper")?.keys() ?? [])].sort()).toEqual(["RateLimitBucket", ...STORE].sort());
    expect(code).not.toMatch(/GRANT EXECUTE/i);
  });

  it("gives the application only the operations its code performs", () => {
    const app = grants.get("cresavo_app")!;
    for (const table of STORE) expect(app.has(table), `${table} belongs to studio-store.sql`).toBe(false);
    // Append-only history: nothing in src/ updates or deletes these.
    for (const table of ["BookingEvent", "CustomerDataAction", "WorkspaceRequest", "CapacityDecision", "AgentApiEvent", "AgentAuditEvent", "AgentBooking"]) {
      expect([...(app.get(table)?.keys() ?? [])].sort(), table).toEqual(["INSERT", "SELECT"]);
    }
    // No code uses these from the web application.
    expect(app.has("PairToken")).toBe(false);
    expect(app.has("CardBookingAttempt")).toBe(false);
    expect(app.has("_prisma_migrations")).toBe(false);
    // Deleted by the code: sessions, rate-limit rows, pairing state, a failed partner attempt.
    for (const table of ["RateLimitBucket", "AdminSession", "owner_session", "PartnerBookingAttempt", "PairWorkspace", "PairClient", "PairCode", "PairBudget", "PairGrantToken"]) {
      expect(can("cresavo_app", table, "DELETE"), `DELETE ${table}`).toBe(true);
    }
    for (const table of ["Booking", "Customer", "Service", "Staff", "Campaign", "owner_account", "AgentApiKey", "AgentProposal"]) {
      expect(can("cresavo_app", table, "DELETE"), `no DELETE on ${table}`).toBe(false);
    }
    // Booking is read, inserted with RETURNING *, changed and row-locked.
    for (const privilege of ["SELECT", "INSERT", "UPDATE"]) expect(can("cresavo_app", "Booking", privilege), privilege).toBe(true);
    // Tables that are only row-locked get one column, not a free UPDATE.
    for (const table of ["AdminUser", "AgentClient", "AgentMandate"]) expect(can("cresavo_app", table, "UPDATE"), `${table} whole-table UPDATE`).toBe(false);
    for (const table of ["AdminUser", "AgentClient", "AgentMandate"]) expect(anyColumn("cresavo_app", table, "UPDATE"), `${table} lock column`).toBe(true);
    // Nested AgentClient creation and OAuth's AgentApiKey upsert.
    expect(can("cresavo_app", "AgentClient", "INSERT")).toBe(true);
    for (const privilege of ["INSERT", "UPDATE", "SELECT"]) expect(can("cresavo_app", "AgentApiKey", privilege)).toBe(true);
  });

  it("gives the support role read access only, without payloads, secrets or migration logs", () => {
    const support = grants.get("cresavo_support")!;
    for (const [table, privileges] of support) expect([...privileges.keys()], table).toEqual(["SELECT"]);
    for (const [table, column] of [["tenant_state", "doc"], ["tenant_action", "action"], ["tenant_action", "idempotency_key"], ["tenant_effect", "payload"],
      ["tenant_idempotency", "result"], ["owner_account", "password_hash"], ["owner_account", "email"], ["owner_session", "id"],
      ["_prisma_migrations", "logs"], ["_prisma_migrations", "checksum"]]) {
      expect(can("cresavo_support", table, "SELECT", column), `${table}.${column}`).toBe(false);
    }
    expect([...(support.get("_prisma_migrations")?.get("SELECT") ?? [])].sort())
      .toEqual(["applied_steps_count", "finished_at", "id", "migration_name", "rolled_back_at", "started_at"]);
    expect(support.has("Customer")).toBe(false);
  });

  it("accounts for every table of the Prisma schema", () => {
    const tables = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, name, body]) => body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name);
    expect(tables.length).toBeGreaterThan(30);
    const sandbox = ["SandboxSession", "SandboxPhone", "SandboxPairBudget", "SandboxAudit"]; // separate sandbox database
    const unused = ["PairToken", "CardBookingAttempt"]; // no web code path; deliberately not granted
    for (const table of tables) {
      if (sandbox.includes(table) || unused.includes(table) || STORE.includes(table)) continue;
      expect(can("cresavo_app", table, "SELECT"), `${table} has no cresavo_app grant: add one or list it as unused`).toBe(true);
      expect(code, `${table} is not revoked first`).toContain(`"${table}"`);
    }
    for (const table of [...unused, ...sandbox]) expect(grants.get("cresavo_app")?.has(table) ?? false, table).toBe(false);
  });
});
