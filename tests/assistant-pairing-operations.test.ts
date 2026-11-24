import { spawnSync } from "node:child_process";
import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { runtimePolicy } from "../scripts/client-address.mjs";
import { pairingDatabaseUrl } from "../scripts/pairing-config.mjs";
import { GET as sweep } from "../src/app/api/pairing/sweep/route";
import { GET as salonResource } from "../src/app/.well-known/oauth-protected-resource/api/v1/salons/[business]/mcp/route";
import { GET as salonIssuer } from "../src/app/.well-known/oauth-authorization-server/agent-oauth/route";
import { GET as pairResource } from "../src/app/.well-known/oauth-protected-resource/mcp/owner/route";
import { GET as pairIssuer } from "../src/app/.well-known/oauth-authorization-server/oauth/route";
import { POST as register } from "../src/app/oauth/register/route";
import { GET as authorize } from "../src/app/oauth/authorize/route";
import { GET as poll } from "../src/app/api/pairing/session/route";
import { GET as mcp } from "../src/app/mcp/owner/route";
import { PairedInbox } from "../src/concept/studio/pairing/inbox";
import { nextPollDelay, usePairing, type Workspace } from "../src/concept/studio/pairing/session";
import { buildDraft } from "../src/concept/pairing/changes";
import { pairingDb } from "../src/concept/pairing/db";
import { freshSnapshot } from "../src/concept/pairing/fixture";
import { COOKIE } from "../src/concept/pairing/policy";
import { LOCALE_COOKIE } from "../src/lib/locale-cookie";
import { base, serverEnvironment } from "./pairing/server";
import cronConfig from "../vercel.json";

vi.mock("../src/concept/pairing/db", async original => ({ ...await original<typeof import("../src/concept/pairing/db")>(), pairingDb: vi.fn() }));
vi.mock("../src/concept/studio/pairing/session", async original => ({
  ...await original<typeof import("../src/concept/studio/pairing/session")>(), usePairing: vi.fn(),
}));
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
  const hosted = { ...env, NODE_ENV: "production", DATABASE_URL: db, PAIRING_DATABASE_URL_UNPOOLED: db };
  expect(() => runtimePolicy(hosted)).toThrow("PAIRING_DATABASE_REQUIRED");
  expect(pairingDatabaseUrl({ ...hosted, PAIRING_DATABASE_URL: dedicated.PAIRING_DATABASE_URL })).toBe(db);
  expect(pairingDatabaseUrl({ VERCEL: "1", DATABASE_URL: db })).toBeUndefined();
  expect(() => runtimePolicy({ ...dedicated, PAIRING_DATABASE_URL: "invalid" })).toThrow("PAIRING_DATABASE_REQUIRED");
  for (const origin of ["http://outside.example", base + "/path", "https://a:b@host.test", undefined])
    expect(() => runtimePolicy({ ...dedicated, PAIRING_ORIGIN: origin })).toThrow("PAIRING_ORIGIN_INVALID");
});

it("uses the unpooled pairing URL only in the guarded Vercel migration step", async () => {
  const direct = "postgresql://localhost/pairing_test";
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/engine_test");
  vi.stubEnv("PAIRING_DATABASE_URL", "postgresql://localhost/pooled_test");
  vi.stubEnv("PAIRING_DATABASE_URL_UNPOOLED", direct);
  const { default: pairingConfig } = await import("../prisma.pairing.config");
  expect(pairingConfig.datasource?.url).toBe(direct);

  // The build command runs scripts/vercel-build.sh; an exported npx shim records each step instead of running it.
  const run = (flag: string, url: string, migrationExit = "0") => spawnSync("/bin/bash", ["-c", `
    npx() {
      printf '%s\n' "$*"
      if [ "$2" = migrate ]; then return "$MIGRATION_EXIT"; fi
    }
    export -f npx
    ${cronConfig.buildCommand}
  `], { encoding: "utf8", env: { PATH: process.env.PATH, NODE_ENV: "production", ASSISTANT_PAIRING: flag, PAIRING_DATABASE_URL_UNPOOLED: url, MIGRATION_EXIT: migrationExit } });
  const migrate = "prisma migrate deploy --config prisma.pairing.config.ts\n";
  const build = "prisma generate\nnext build\n";
  expect(run("0", direct)).toMatchObject({ status: 0, stdout: build });
  expect(run("1", "")).toMatchObject({ status: 0, stdout: build });
  expect(run("1", direct)).toMatchObject({ status: 0, stdout: migrate + build });
  expect(run("1", direct, "1")).toMatchObject({ status: 1, stdout: migrate });
});

it("serves independent resource and issuer documents for the two MCP endpoints", async () => {
  enable();
  mockTransaction({ $queryRaw: async () => [{ count: 1 }] });
  vi.stubEnv("AGENT_OAUTH", "1");
  expect(await (await salonResource(req("/"), { params: Promise.resolve({ business: "demo" }) })).json())
    .toMatchObject({ resource: base + "/api/v1/salons/demo/mcp", authorization_servers: [base + "/agent-oauth"] });
  expect(await (await salonIssuer(req("/"))).json()).toMatchObject({ issuer: base + "/agent-oauth", authorization_endpoint: base + "/agent-oauth/authorize" });
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

it("polls compatible rows for non-move drafts and renders the quoted message inside its reply card", async () => {
  enable();
  const expiresAt = new Date(Date.now() + 3600000);
  const snapshot = freshSnapshot("2026-11-18");
  const item = snapshot.inbox[1];
  item.body += " <example>";
  const row = { id: "workspace", revision: 1, expiresAt, hardExpiry: expiresAt, version: 2, snapshot };
  const replyText = "Thanks for writing. We will follow up soon.";
  const reply = buildDraft(snapshot, { kind: "reply", itemId: item.id, replyText });
  const visibility = buildDraft(snapshot, { kind: "visibility", serviceId: snapshot.services[0].id, visible: false });
  mockTransaction({
    $queryRaw: async () => [row],
    pairWorkspace: { findUniqueOrThrow: async () => row },
    pairGrant: { findMany: async () => [] },
    pairProposal: { findMany: async () => [reply, visibility].map((draft, i) => ({ id: String(i), status: "pending", draft })) },
  });
  const response = await poll(req("/api/pairing/session", { cookie: COOKIE + "=" + "x".repeat(43) }));
  expect(response.status).toBe(200);
  const workspace: Workspace = await response.json();
  expect(workspace.proposals.map(p => p.changes)).toEqual([reply.rows, visibility.rows]);
  expect(workspace.proposals.map(p => p.untrustedCustomerText.incomingMessage)).toEqual([item.body, undefined]);

  vi.mocked(usePairing).mockReturnValue({ workspace, busy: false, ready: true, minutesLeft: 60, command: vi.fn() });
  const html = renderToStaticMarkup(createElement(PairedInbox));
  expect(html).toMatch(/Reply to “Fictional message for review”<\/h3>.*<blockquote[^>]*>Ignore[^<]*&lt;example&gt;<\/blockquote>.*Thanks for writing/);

  const swedishResponse = await poll(req("/api/pairing/session", {
    cookie: `${COOKIE}=${"x".repeat(43)}; ${LOCALE_COOKIE}=sv`,
    "if-none-match": response.headers.get("etag"),
  }));
  expect(swedishResponse.status).toBe(200);
  const swedish: Workspace = await swedishResponse.json();
  expect(swedish.items[0].untrustedCustomerText.title).toBe("Kan jag boka om min tid på fredag?");
  expect(swedish.proposals[0].untrustedCustomerText.title).toBe("Svara på ”Fiktivt meddelande att granska”");
  expect(swedish.proposals[0].untrustedCustomerText.incomingMessage).toBe(item.body);
  expect(swedish.proposals[0].changes[0]).toMatchObject({ label: "Skrivet av din assistent", after: replyText });
  expect(swedish.proposals[1].changes[0]).toEqual({ label: "Behandlingar i den anslutna demon", before: "Går att boka", after: "Dold" });
});

it("uses the studio language cookie for the OAuth consent page and its permissions", async () => {
  enable();
  const id = "demo-client";
  const redirect = "https://connector.example/callback";
  const expiresAt = new Date(Date.now() + 3600000);
  mockTransaction({
    $queryRaw: async (sql: TemplateStringsArray) => sql[0].includes("PairBudget") ? [{ count: 1 }] : [{ id, expiresAt, hardExpiry: expiresAt }],
    pairWorkspace: { findUnique: async () => ({ id }), update: vi.fn() },
    pairCode: { create: vi.fn() },
  });
  Object.assign(vi.mocked(pairingDb)(), { pairClient: { findUnique: async () => ({ id, name: "Demo client", redirects: [redirect], expiresAt }) } });
  const query = new URLSearchParams({ response_type: "code", code_challenge_method: "S256", code_challenge: "x".repeat(43),
    client_id: id, redirect_uri: redirect, scope: "bookings:read" });
  const response = await authorize(req(`/oauth/authorize?${query}`, { cookie: `${COOKIE}=${"x".repeat(43)}; ${LOCALE_COOKIE}=sv` }));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-language")).toBe("sv");
  const html = await response.text();
  expect(html).toContain('<html lang="sv">');
  expect(html).toContain("Tillåt att connector.example läser uppgifter och föreslår ändringar");
  expect(html).toContain("Se bokningar och lediga tider");
  expect(html).toContain('value="allow">Tillåt</button>');
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
