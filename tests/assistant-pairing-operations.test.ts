import { afterEach, expect, it, vi } from "vitest";
import { runtimePolicy } from "../scripts/client-address.mjs";
import { pairingDatabaseUrl } from "../scripts/pairing-config.mjs";
import { GET as sweep } from "../src/app/api/pairing/sweep/route";
import { GET as engineResource } from "../src/app/.well-known/oauth-protected-resource/route";
import { GET as engineIssuer } from "../src/app/.well-known/oauth-authorization-server/route";
import { GET as pairResource } from "../src/app/.well-known/oauth-protected-resource/mcp/owner/route";
import { GET as pairIssuer } from "../src/app/.well-known/oauth-authorization-server/oauth/route";
import { POST as register } from "../src/app/oauth/register/route";
import { GET as poll } from "../src/app/api/pairing/session/route";
import { GET as mcp } from "../src/app/mcp/owner/route";
import { nextPollDelay } from "../src/concept/studio/pairing/session";
import { pairingDb } from "../src/concept/pairing/db";
import { COOKIE } from "../src/concept/pairing/policy";
import { base, serverEnvironment } from "./pairing/server";
import cronConfig from "../vercel.json";

vi.mock("../src/concept/pairing/db", async original => ({ ...await original<typeof import("../src/concept/pairing/db")>(), pairingDb: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
function enable() {
  vi.stubEnv("ASSISTANT_PAIRING", "1");
  vi.stubEnv("PAIRING_ORIGIN", base);
  vi.stubEnv("SESSION_SECRET", "synthetic-test-secret".repeat(2));
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", base);
}
function mockTransaction<T>(tx: T) {
  const run = vi.fn((fn: (arg: T) => unknown) => fn(tx));
  vi.mocked(pairingDb).mockReturnValue({ $transaction: run } as unknown as ReturnType<typeof pairingDb>);
  return run;
}
const req = (path: string, headers = {}, init = {}) => new Request(base + path, { ...init, headers: { host: new URL(base).host, ...headers } });

it("pins both HTTP suites to the runner's guarded database", async () => {
  const database = "postgresql://test@localhost/booking_pair_test";
  expect(() => serverEnvironment({})).toThrow("TEST_DATABASE_REFUSED");
  const env = serverEnvironment({ DATABASE_URL: database });
  expect(env).toMatchObject({ DATABASE_URL: database, PAIRING_DATABASE_URL: database, PAIRING_ORIGIN: base });
  for (const url of ["postgresql://localhost/production", "postgresql://remote.test/booking_test"]) {
    expect(() => serverEnvironment({ DATABASE_URL: url })).toThrow("TEST_DATABASE_REFUSED");
    expect(() => serverEnvironment({ DATABASE_URL: database, PAIRING_DATABASE_URL: url })).toThrow("TEST_DATABASE_REFUSED");
  }
  vi.stubEnv("DATABASE_URL", database);
  vi.stubEnv("PAIRING_DATABASE_URL", database);
  const { default: config } = await import("../playwright.pairing.config");
  expect(config.webServer).toMatchObject({ reuseExistingServer: false, wait: { stdout: /^BOOKING_SERVER_READY$/m }, env: { PAIRING_DATABASE_URL: database } });
});

it("validates the selected database and canonical origin at startup", () => {
  const env = { ASSISTANT_PAIRING: "1", SESSION_SECRET: "s".repeat(32), PAIRING_ORIGIN: base };
  const db = "postgresql://127.0.0.1/pair_test";
  expect(() => runtimePolicy(env)).toThrow("PAIRING_DATABASE_REQUIRED");
  expect(runtimePolicy({ ...env, PAIRING_DATABASE_URL: db })).toBe("local");
  expect(runtimePolicy({ ...env, DATABASE_URL: db })).toBe("local");
  const dedicated = { ...env, DATABASE_URL: "postgresql://127.0.0.1/engine_test", PAIRING_DATABASE_URL: db };
  expect(pairingDatabaseUrl(dedicated)).toBe(db);
  expect(() => runtimePolicy({ ...dedicated, PAIRING_DATABASE_URL: "invalid" })).toThrow("PAIRING_DATABASE_REQUIRED");
  for (const origin of ["http://outside.example", base + "/path", "https://a:b@host.test", undefined])
    expect(() => runtimePolicy({ ...dedicated, PAIRING_ORIGIN: origin })).toThrow("PAIRING_ORIGIN_INVALID");
});

it("serves independent resource and issuer documents for the two MCP endpoints", async () => {
  enable();
  mockTransaction({ $queryRaw: async () => [{ count: 1 }] });
  expect(await engineResource().json()).toMatchObject({ resource: base + "/api/v1/mcp", authorization_servers: [base] });
  expect(await engineIssuer().json()).toMatchObject({ issuer: base, authorization_endpoint: base + "/authorize" });
  expect(await (await pairResource(req("/"))).json()).toMatchObject({ resource: base + "/mcp/owner", authorization_servers: [base + "/oauth"] });
  expect(await (await pairIssuer(req("/"))).json()).toMatchObject({ issuer: base + "/oauth", authorization_response_iss_parameter_supported: true });
  expect((await pairIssuer(req("/", { host: "other.test" }))).status).toBe(404);
});

it("charges valid polls and bearer requests only to their workspace", async () => {
  enable();
  const expiresAt = new Date(Date.now() + 3600000);
  const row = { id: "workspace", revision: 1, expiresAt, hardExpiry: expiresAt };
  const grant = { id: "grant", workspaceId: row.id, scopes: "inbox:read" };
  const budgets: string[] = [];
  mockTransaction({
    $queryRaw: async (sql: TemplateStringsArray, key: string) => {
      if (sql[0].includes("PairBudget")) { budgets.push(key); return [{ count: 1 }]; }
      return [row];
    },
    pairGrantToken: { findFirst: async () => ({ grant }) },
    pairWorkspace: { findUniqueOrThrow: async () => ({ id: row.id, version: 2, snapshot: { customers: [], services: [], inbox: [], bookings: [] } }) },
    pairGrant: { findMany: async () => [] }, pairProposal: { findMany: async () => [] },
  });
  expect((await poll(req("/api/pairing/session", { cookie: COOKIE + "=" + "x".repeat(43) }))).status).toBe(200);
  expect((await mcp(req("/mcp/owner", { authorization: "Bearer " + "a".repeat(43) }))).status).toBe(405);
  expect(budgets).toEqual([expect.stringMatching(/^poll:workspace:/), expect.stringMatching(/^mcp:workspace:/)]);
});

it("reuses identical public registrations and strips misleading characters before persistence", async () => {
  enable();
  type Registered = { id: string; name: string; redirects: string[] };
  const clients: Registered[] = [];
  const budgets: string[] = [];
  mockTransaction({
    $queryRaw: async (_sql: TemplateStringsArray, key: string) => { budgets.push(key); return [{ count: 1 }]; },
    $executeRaw: vi.fn(), pairClient: {
      findFirst: async ({ where }: { where: { name: string; redirects: { equals: string[] } } }) =>
        clients.find(c => c.name === where.name && JSON.stringify(c.redirects) === JSON.stringify(where.redirects.equals)),
      create: async ({ data }: { data: Registered }) => { clients.push(data); },
    },
  });
  const post = async (redirect_uris: string[]) => (await register(req("/oauth/register", { "content-type": "application/json" },
    { method: "POST", body: JSON.stringify({ client_name: "Cl\u202eau\nde", redirect_uris }) }))).json();
  const callbacks = ["https://alpha.example/cb", "https://beta.example/cb"];
  const first = await post(callbacks);
  expect(first.client_name).toBe("Claude");
  expect((await post(callbacks.reverse())).client_id).toBe(first.client_id);
  expect(clients.map(c => c.name)).toEqual(["Claude"]);
  expect(budgets).toEqual([expect.stringMatching(/^dcr:/), expect.stringMatching(/^registrations:/)]);
  expect((await post(["https://different.example/cb"])).client_id).not.toBe(first.client_id);
});

it("authenticates daily cron before opening the database, including when disabled", async () => {
  const run = mockTransaction(Object.fromEntries(["pairWorkspace", "pairCode", "pairClient", "pairBudget"].map(k => [k, { deleteMany: vi.fn() }])));
  expect(cronConfig.crons).toEqual([{ path: "/api/pairing/sweep", schedule: "15 3 * * *" }]);
  vi.stubEnv("ASSISTANT_PAIRING", "0");
  expect((await sweep(req("/api/pairing/sweep"))).status).toBe(404);
  enable();
  vi.stubEnv("CRON_SECRET", "");
  expect((await sweep(req("/api/pairing/sweep"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "synthetic");
  expect((await sweep(req("/api/pairing/sweep", { authorization: "Bearer incorrect" }))).status).toBe(401);
  expect(run).not.toHaveBeenCalled();
  expect((await sweep(req("/api/pairing/sweep", { authorization: "Bearer synthetic" }))).status).toBe(204);
  expect(run).toHaveBeenCalledOnce();
});

it("backs polling off exponentially and respects Retry-After", () => {
  expect(nextPollDelay(503, 0, null)).toBe(5000);
  expect(nextPollDelay(429, 5000, null)).toBe(10000);
  expect(nextPollDelay(429, 5000, "60")).toBe(60000);
  expect(nextPollDelay(503, 120000, null)).toBe(120000);
  expect(nextPollDelay(304, 120000, null)).toBe(0);
});

it("logs a database error code without exposing the underlying message", async () => {
  enable();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(pairingDb).mockImplementation(() => { throw Object.assign(new Error("private connection string"), { code: "P1001" }); });
  const response = await poll(req("/api/pairing/session"));
  expect(response.status).toBe(503);
  expect(log.mock.calls).toEqual([["P1001"]]);
  expect(await response.json()).toEqual({ error: "temporarily_unavailable" });
});

it("budgets successful refreshes by grant even when the client shares a vendor IP", async () => {
  enable();
  const { POST: refresh } = await import("../src/app/oauth/token/route");
  const grant = { id: "grant-A", workspaceId: "workspace-A", clientId: "vendor", scopes: "inbox:read", audience: base + "/mcp/owner" };
  const deadline = new Date(Date.now() + 3600000);
  const keys: string[] = [];
  mockTransaction({
    $queryRaw: async (sql: TemplateStringsArray, key: string) => {
      if (sql[0].includes("PairBudget")) { keys.push(key); return [{ count: 1 }]; }
      return [{ id: grant.workspaceId, expiresAt: deadline, hardExpiry: deadline }];
    },
    pairGrantToken: { findUnique: async () => ({ grant, rotated: false }), create: vi.fn(), update: vi.fn() },
  });
  const response = await refresh(req("/oauth/token", { "content-type": "application/x-www-form-urlencoded" }, {
    method: "POST", body: new URLSearchParams({ client_id: grant.clientId, grant_type: "refresh_token", refresh_token: "synthetic" }),
  }));
  expect(response.status).toBe(200);
  expect(keys).toEqual([expect.stringMatching(/^token:grant-A:/), expect.stringMatching(/^refresh:grant-A:/)]);
});
