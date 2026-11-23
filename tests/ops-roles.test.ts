import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// prisma/grants/roles.sql is documentation for operators, so nothing else runs it. This test parses its GRANT
// statements and holds them to the code: the sweep and outbox roles touch the store only through the migration's
// functions, the support role must not see payloads, the application gets only the operations its code performs,
// every Prisma table is accounted for, and verify-roles.sql checks real logins against exactly these grants.

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
    for (const role of ["cresavo_app", "cresavo_eraser", "cresavo_sweeper", "cresavo_support", "cresavo_outbox"]) expect(code).toContain(`'${role}'`);
  });

  it("is one transaction", () => {
    expect(code.trim().startsWith("BEGIN;")).toBe(true);
    expect(code.trim().endsWith("COMMIT;")).toBe(true);
    expect(code.match(/\bBEGIN;/g)).toHaveLength(1);
    expect(code.match(/\bCOMMIT;/g)).toHaveLength(1);
  });

  it("gives the sweep role no store table and the rate-limit table only what its two sweeps use", () => {
    const body = sweepers.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // The store sweeps are fixed SECURITY DEFINER functions (migration store_rls_policies): no direct statement on a store table.
    expect(body).not.toMatch(/(FROM|JOIN|UPDATE|DELETE FROM|INSERT INTO)\s+"?tenant_\w+/);
    for (const sweep of ["idempotency", "demo_actions", "sandboxes", "outbox_bodies", "activity_keys", "activity_redact", "journal_views"]) {
      expect(body, sweep).toContain(`store_sweep_${sweep}(`);
    }
    expect([...(grants.get("cresavo_sweeper")?.keys() ?? [])]).toEqual(["RateLimitBucket"]);
    for (const column of ["key", "expiresAt"]) expect(can("cresavo_sweeper", "RateLimitBucket", "SELECT", column), column).toBe(true);
    expect(can("cresavo_sweeper", "RateLimitBucket", "DELETE")).toBe(true);
    expect(body.match(/FOR UPDATE/g)?.length, "a new row lock or update needs a grant: update roles.sql").toBe(1);
  });

  it("gives the outbox poller role no table at all: it works through the store_outbox functions", () => {
    expect(grants.has("cresavo_outbox")).toBe(false);
    expect(code).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM cresavo_outbox;");
    const outboxCode = (read("src/concept/store/effect-outbox.ts") + read("src/lib/message-sink.ts")).replace(/^\s*(\/\/|\*).*$/gm, "");
    expect(outboxCode).not.toMatch(/(FROM|JOIN|UPDATE|DELETE FROM|INSERT INTO)\s+"?tenant_\w+/);
    const migration = read("prisma/migrations/20261122160000_store_rls_policies/migration.sql");
    const studioStore = read("prisma/grants/studio-store.sql");
    for (const fn of new Set([...outboxCode.matchAll(/store_outbox_\w+/g)].map((m) => m[0]))) {
      expect(migration, fn).toMatch(new RegExp(`CREATE FUNCTION ${fn}\\(`));
      expect(code, `${fn} is granted to the poller`).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION[^;]*\\b${fn}\\([^;]*TO cresavo_outbox;`));
      expect(studioStore, `${fn} is granted to the web app`).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION[^;]*\\b${fn}\\([^;]*TO cresavo_app;`));
    }
  });

  it("lists in verify-roles.sql exactly the grants of roles.sql and studio-store.sql as its allowlist", () => {
    const kinds: Record<string, string> = { cresavo_app: "app", cresavo_sweeper: "sweeper", cresavo_support: "support", cresavo_outbox: "outbox" };
    const expected = new Set<string>();
    const all = parseGrants(code + read("prisma/grants/studio-store.sql").replace(/^--.*$/gm, ""));
    for (const [role, tables] of all) {
      if (!kinds[role]) continue;
      for (const [table, privileges] of tables) for (const [privilege, columns] of privileges) for (const column of columns) {
        expected.add(`${kinds[role]}|${table}|${column}|${privilege}`);
      }
    }
    const verify = read("prisma/grants/verify-roles.sql");
    const listed = [...verify.slice(verify.indexOf("allowed(kind, tbl, col, priv)"), verify.indexOf("allowed_functions"))
      .matchAll(/\('(\w+)', '([^']+)', '([^']+)', '(\w+)'\)/g)].map(([, kind, table, column, privilege]) => `${kind}|${table}|${column}|${privilege}`);
    expect(listed.sort()).toEqual([...expected].sort());
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
    for (const table of ["RateLimitBucket", "AdminSession", "owner_session", "owner_recovery_code", "owner_mfa_challenge", "PartnerBookingAttempt", "PairWorkspace", "PairClient", "PairCode", "PairBudget", "PairGrantToken"]) {
      expect(can("cresavo_app", table, "DELETE"), `DELETE ${table}`).toBe(true);
    }
    for (const table of ["Booking", "Customer", "Service", "Staff", "Campaign", "owner_account", "AgentApiKey", "AgentProposal"]) {
      expect(can("cresavo_app", table, "DELETE"), `no DELETE on ${table}`).toBe(false);
    }
    // A recovery code only changes when it is used; a password challenge never changes.
    expect(can("cresavo_app", "owner_recovery_code", "UPDATE", "used_at")).toBe(true);
    expect(can("cresavo_app", "owner_recovery_code", "UPDATE", "code_hash")).toBe(false);
    expect(anyColumn("cresavo_app", "owner_mfa_challenge", "UPDATE")).toBe(false);
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
      ["owner_account", "totp_secret_enc"], ["owner_account", "totp_pending_enc"], ["owner_account", "totp_last_step"], ["owner_recovery_code", "code_hash"], ["owner_mfa_challenge", "id"],
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
