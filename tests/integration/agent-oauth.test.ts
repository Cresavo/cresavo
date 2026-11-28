import { createHash, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { db } from "../../src/lib/db";
import { REGISTRATION_LIMIT, tokenDigest } from "../../src/lib/agent-api/grants/server";
import { createAgentApiKey } from "../../src/lib/agent-api/keys";
import { addressProof } from "../../scripts/client-address.mjs";
import { POST as register } from "../../src/app/agent-oauth/register/route";
import { GET as authorizePage, POST as consentPost } from "../../src/app/agent-oauth/authorize/route";
import { POST as tokenPost } from "../../src/app/agent-oauth/token/route";
import { POST as revokePost } from "../../src/app/agent-oauth/revoke/route";
import { GET as serverMetadata } from "../../src/app/.well-known/oauth-authorization-server/agent-oauth/route";
import { GET as resourceMetadata } from "../../src/app/.well-known/oauth-protected-resource/api/v1/salons/[business]/mcp/route";
import { POST as salonMcp } from "../../src/app/api/v1/salons/[business]/mcp/route";
import { POST as sharedMcp } from "../../src/app/api/v1/mcp/route";
import { GET as services } from "../../src/app/api/v1/services/route";
import { cleanupRun } from "../../scripts/agentprov/fixtures.mjs";

// ADR 7 / #183: OAuth 2.1 for customers' agents, one grant per agent client per salon.
const origin = "http://127.0.0.1:3251";
const secret = "synthetic-agent-oauth-address";
const redirectUri = "http://127.0.0.1:4555/callback";
const resource = (business = "demo") => `${origin}/api/v1/salons/${business}/mcp`;
const run = `agentprov-${randomUUID()}`;
const oauthClients: string[] = [];
const mcpClients: Client[] = [];
let address = 10;

beforeEach(() => {
  vi.stubEnv("AGENT_OAUTH", "1"); vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin);
  vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("BOOKING_ADDRESS_SECRET", secret);
});
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(async () => {
  for (const client of mcpClients) await client.close();
  const grants = await db.agentGrant.findMany({ where: { oauthClientId: { in: oauthClients } } });
  await db.agentGrantToken.deleteMany({ where: { grantId: { in: grants.map(g => g.id) } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: grants.map(g => g.keyId) } } });
  await db.agentProposal.deleteMany({ where: { clientId: { in: grants.map(g => g.clientId) } } });
  await db.agentGrant.deleteMany({ where: { id: { in: grants.map(g => g.id) } } });
  await db.agentApiKey.deleteMany({ where: { id: { in: grants.map(g => g.keyId) } } });
  await db.agentClient.deleteMany({ where: { id: { in: grants.map(g => g.clientId) } } });
  await db.agentOAuthCode.deleteMany({ where: { clientId: { in: oauthClients } } });
  await db.agentOAuthClient.deleteMany({ where: { id: { in: oauthClients } } });
  await cleanupRun(run);
  await db.$disconnect();
});

// A fresh signed client address per request, as the supported server wrapper sends it.
function request(url: string, init: RequestInit = {}, ip = `198.51.100.${(address++ % 200) + 10}`) {
  const headers = new Headers(init.headers);
  headers.set("x-booking-client-ip", ip); headers.set("x-booking-client-proof", addressProof(ip, secret));
  return new Request(url, { ...init, headers });
}
const form = (values: Record<string, string>) => ({ method: "POST", body: new URLSearchParams(values).toString(),
  headers: { "content-type": "application/x-www-form-urlencoded" } });
const verifier = "v".repeat(43), challenge = createHash("sha256").update(verifier).digest("base64url");
const salon = (business: string) => ({ params: Promise.resolve({ business }) });

async function registerClient() {
  const response = await register(request(`${origin}/agent-oauth/register`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Synthetic booking agent", redirect_uris: [redirectUri] }) }));
  expect(response.status).toBe(201);
  const { client_id } = await response.json();
  oauthClients.push(client_id);
  return client_id as string;
}
async function consentHandle(clientId: string, extra: Record<string, string> = {}) {
  const query = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, code_challenge: challenge,
    code_challenge_method: "S256", state: "synthetic-state", resource: resource(), ...extra });
  const page = await authorizePage(request(`${origin}/agent-oauth/authorize?${query}`));
  return { page, handle: /name="consent" value="([\w-]{43})"/.exec(await page.clone().text())?.[1] };
}
async function decide(handle: string, decision: "allow" | "decline", from = origin) {
  const response = await consentPost(request(`${origin}/agent-oauth/authorize`, { ...form({ consent: handle, decision }),
    headers: { "content-type": "application/x-www-form-urlencoded", origin: from } }));
  return response;
}
const exchange = (values: Record<string, string>) => tokenPost(request(`${origin}/agent-oauth/token`, form(values)));
async function blockedRequests(lock: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<unknown>, start: () => Promise<Response>[]) {
  let release!: () => void, ready!: (pid: number) => void;
  const held = new Promise<number>(resolve => { ready = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const transaction = db.$transaction(async tx => {
    await lock(tx);
    const [holder] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    ready(holder.pid);
    await gate;
  }, { timeout: 20000 });
  const holderPid = await held;
  try {
    const requests = start();
    let waiting = 0;
    for (let i = 0; i < 200 && waiting < requests.length; i++) {
      const rows = await db.$queryRaw<{ count: bigint }[]>`WITH RECURSIVE blocked(pid) AS (SELECT ${holderPid}::int UNION SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid = ANY(pg_blocking_pids(a.pid)) WHERE a.datname = current_database() AND a.wait_event_type = 'Lock') SELECT (count(*) - 1)::bigint AS count FROM blocked`;
      waiting = Number(rows[0].count);
      if (waiting < requests.length) await new Promise(resolve => setTimeout(resolve, 25));
    }
    expect(waiting).toBeGreaterThanOrEqual(requests.length);
    release();
    return await Promise.all(requests);
  } finally { release(); await transaction; }
}
async function connected(scope?: string) {
  const clientId = await registerClient();
  const { handle } = await consentHandle(clientId, scope ? { scope } : {});
  const callback = new URL((await decide(handle!, "allow")).headers.get("location")!);
  const code = callback.searchParams.get("code")!;
  const response = await exchange({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri, resource: resource() });
  expect(response.status).toBe(200);
  return { clientId, code, tokens: await response.json() as { access_token: string; refresh_token: string; scope: string; expires_in: number } };
}
async function mcp(token: string, business = "demo") {
  const client = new Client({ name: "synthetic-oauth-agent", version: "1" });
  mcpClients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL(resource(business)), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
    fetch: async (input, init) => salonMcp(request(String(input), init), salon(business)),
  }));
  return client;
}
const text = (result: unknown) => JSON.parse((result as { content: { text: string }[] }).content[0].text);
const rpc = (token: string, business?: string) => {
  const req = request(business ? resource(business) : `${origin}/api/v1/mcp`, { method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_services", arguments: { business: "demo" } } }) });
  return business ? salonMcp(req, salon(business)) : sharedMcp(req);
};

describe("customer agent OAuth", () => {
  it("publishes metadata for the authorization server and each salon's resource", async () => {
    const server = await (await serverMetadata(request(`${origin}/.well-known/oauth-authorization-server/agent-oauth`))).json();
    expect(server).toMatchObject({ issuer: `${origin}/agent-oauth`, code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"], client_id_metadata_document_supported: true });
    const prm = await (await resourceMetadata(request(`${origin}/.well-known/oauth-protected-resource/api/v1/salons/demo/mcp`), salon("demo"))).json();
    expect(prm).toEqual({ resource: resource(), authorization_servers: [`${origin}/agent-oauth`],
      scopes_supported: ["services:read", "availability:read", "bookings:read", "bookings:write"], bearer_methods_supported: ["header"] });
  });

  it("connects through consent, PKCE and a salon-bound token, and still needs a mandate to book", async () => {
    const { tokens } = await connected();
    expect(tokens).toMatchObject({ expires_in: 900, scope: "services:read availability:read bookings:read bookings:write" });
    const client = await mcp(tokens.access_token);
    expect(text(await client.callTool({ name: "list_services", arguments: { business: "demo" } })).services.length).toBeGreaterThan(0);
    expect(text(await client.callTool({ name: "list_services", arguments: { business: "lab-partner" } })).error.code).toBe("forbidden_business");
    expect(text(await client.callTool({ name: "create_booking", arguments: { business: "demo", serviceId: "massage", serviceVersion: 1,
      staffId: "staff-demo", start: new Date(Date.now() + 5 * 86400000).toISOString(), confirmed: true, idempotencyKey: randomUUID(),
      customer: { name: "Synthetic OAuth customer", email: "oauth-customer@example.test" } } })).error.code).toBe("mandate_required");
  });

  it("accepts the token only at its own salon's MCP resource", async () => {
    const { tokens } = await connected();
    expect((await rpc(tokens.access_token)).status).toBe(401);
    expect((await services(request(`${origin}/api/v1/services?business=demo`, { headers: { authorization: `Bearer ${tokens.access_token}` } }))).status).toBe(401);
    const other = await rpc(tokens.access_token, "lab-partner");
    expect(other.status).toBe(401);
    expect(other.headers.get("www-authenticate")).toBe(`Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/v1/salons/lab-partner/mcp"`);
    const key = await createAgentApiKey({ businessId: "demo", agentName: `${run}-key`, ownerName: "Synthetic operator", ownerContact: "operator@example.test" }, db);
    expect((await rpc(key.key, "demo")).status).toBe(401);
  });

  it("refuses a consent from another origin, a wrong verifier, redirect or resource, and an unknown salon", async () => {
    const clientId = await registerClient();
    const { handle } = await consentHandle(clientId);
    expect((await decide(handle!, "allow", "https://attacker.example")).status).toBe(403);
    const code = new URL((await decide(handle!, "allow")).headers.get("location")!).searchParams.get("code")!;
    const base = { grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri };
    const wrongs: Record<string, string>[] = [{ code_verifier: "w".repeat(43) }, { redirect_uri: "http://127.0.0.1:4555/other" }, { resource: resource("lab-partner") }, { client_id: randomUUID() }];
    for (const wrong of wrongs)
      expect(await (await exchange({ ...base, ...wrong })).json()).toEqual({ error: "invalid_grant" });
    expect((await consentHandle(clientId, { resource: resource("nowhere") })).page.status).toBe(400);
    expect((await consentHandle(clientId, { redirect_uri: "https://attacker.example/callback" })).page.status).toBe(400);
  });

  it("returns access_denied on decline and issues nothing", async () => {
    const clientId = await registerClient();
    const { handle } = await consentHandle(clientId);
    const callback = new URL((await decide(handle!, "decline")).headers.get("location")!);
    expect(Object.fromEntries(callback.searchParams)).toEqual({ state: "synthetic-state", error: "access_denied", iss: `${origin}/agent-oauth` });
    expect(await db.agentGrant.count({ where: { oauthClientId: clientId } })).toBe(0);
  });

  it("expires unused registrations quickly and extends one after approval", async () => {
    const clientId = await registerClient();
    const initial = await db.agentOAuthClient.findUniqueOrThrow({ where: { id: clientId } });
    expect(+initial.expiresAt - Date.now()).toBeGreaterThan(59 * 60_000);
    expect(+initial.expiresAt - Date.now()).toBeLessThanOrEqual(60 * 60_000);
    const { handle } = await consentHandle(clientId);
    await decide(handle!, "allow");
    const approved = await db.agentOAuthClient.findUniqueOrThrow({ where: { id: clientId } });
    expect(+approved.expiresAt - Date.now()).toBeGreaterThan(29 * 86400_000);
    await db.agentOAuthClient.update({ where: { id: clientId }, data: { expiresAt: new Date(0) } });
    expect((await consentHandle(clientId)).page.status).toBe(400);
  });

  it("revokes the grant when an authorization code is used twice", async () => {
    const { clientId, code, tokens } = await connected();
    const replay = await exchange({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri });
    expect(await replay.json()).toEqual({ error: "invalid_grant" });
    expect((await rpc(tokens.access_token, "demo")).status).toBe(401);
  });

  it("rotates refresh tokens and ends the grant when an old one comes back", async () => {
    const { clientId, tokens } = await connected();
    const next = await (await exchange({ grant_type: "refresh_token", client_id: clientId, refresh_token: tokens.refresh_token })).json();
    expect(next.access_token).toBeTruthy();
    expect((await rpc(tokens.access_token, "demo")).status).toBe(401);
    expect((await rpc(next.access_token, "demo")).status).toBe(200);
    expect(await (await exchange({ grant_type: "refresh_token", client_id: clientId, refresh_token: tokens.refresh_token })).json()).toEqual({ error: "invalid_grant" });
    expect((await rpc(next.access_token, "demo")).status).toBe(401);
    expect(await (await exchange({ grant_type: "refresh_token", client_id: clientId, refresh_token: next.refresh_token })).json()).toEqual({ error: "invalid_grant" });
  });

  it("revokes the winning grant when authorization code exchanges race", async () => {
    const clientId = await registerClient();
    const { handle } = await consentHandle(clientId);
    const code = new URL((await decide(handle!, "allow")).headers.get("location")!).searchParams.get("code")!;
    const values = { grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri };
    const responses = await blockedRequests(tx => tx.$executeRaw`SELECT pg_advisory_xact_lock(708232, hashtext(${tokenDigest(code)}))`,
      () => [exchange(values), exchange(values)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    const success = await responses.find(r => r.status === 200)!.json();
    expect(await responses.find(r => r.status === 400)!.json()).toEqual({ error: "invalid_grant" });
    expect((await rpc(success.access_token, "demo")).status).toBe(401);
    expect(await (await exchange({ grant_type: "refresh_token", client_id: clientId, refresh_token: success.refresh_token })).json()).toEqual({ error: "invalid_grant" });
    expect((await db.agentGrant.findFirstOrThrow({ where: { oauthClientId: clientId } })).revokedAt).not.toBeNull();
  });

  it("revokes every token when refresh exchanges race", async () => {
    const { clientId, tokens } = await connected();
    const values = { grant_type: "refresh_token", client_id: clientId, refresh_token: tokens.refresh_token };
    const grant = await db.agentGrant.findFirstOrThrow({ where: { oauthClientId: clientId } });
    const responses = await blockedRequests(tx => tx.$queryRaw`SELECT "id" FROM "AgentGrant" WHERE "id" = ${grant.id} FOR UPDATE`,
      () => [exchange(values), exchange(values)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    const success = await responses.find(r => r.status === 200)!.json();
    expect(await responses.find(r => r.status === 400)!.json()).toEqual({ error: "invalid_grant" });
    expect((await rpc(success.access_token, "demo")).status).toBe(401);
    expect(await (await exchange({ ...values, refresh_token: success.refresh_token })).json()).toEqual({ error: "invalid_grant" });
    expect((await db.agentGrant.findUniqueOrThrow({ where: { id: grant.id } })).revokedAt).not.toBeNull();
  });

  it("serializes replays of different rotated tokens and a revoke racing refresh", async () => {
    for (const race of ["replay", "revoke"] as const) {
      const { clientId, tokens } = await connected();
      const refresh = (value: string) => exchange({ grant_type: "refresh_token", client_id: clientId, refresh_token: value });
      const next = await (await refresh(tokens.refresh_token)).json();
      const latest = await (await refresh(next.refresh_token)).json();
      const grant = await db.agentGrant.findFirstOrThrow({ where: { oauthClientId: clientId } });
      const responses = await blockedRequests(tx => tx.$queryRaw`SELECT "id" FROM "AgentGrant" WHERE "id" = ${grant.id} FOR UPDATE`, () => race === "replay"
        ? [refresh(tokens.refresh_token), refresh(next.refresh_token)]
        : [refresh(latest.refresh_token), revokePost(request(`${origin}/agent-oauth/revoke`, form({ token: tokens.refresh_token, client_id: clientId })))]);
      expect(responses.every(response => response.status !== 500)).toBe(true);
      expect((await db.agentGrant.findUniqueOrThrow({ where: { id: grant.id } })).revokedAt).not.toBeNull();
      expect(await db.agentGrantToken.count({ where: { grantId: grant.id } })).toBe(0);
    }
  });

  it("limits registrations per address over a day while leaving other addresses available", async () => {
    const registerAt = (ip: string) => register(request(`${origin}/agent-oauth/register`, { method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_name: "Synthetic daily budget client", redirect_uris: [redirectUri] }) }, ip));
    for (let i = 0; i < 10; i++) {
      const response = await registerAt("203.0.113.1");
      expect(response.status).toBe(201);
      oauthClients.push((await response.json()).client_id);
    }
    const denied = await registerAt("203.0.113.1");
    expect(denied.status).toBe(429);
    expect(await denied.json()).toEqual({ error: "rate_limited" });
    const other = await registerAt("203.0.113.2");
    expect(other.status).toBe(201);
    oauthClients.push((await other.json()).client_id);
  });

  it("does not release the race barrier for an unrelated lock wait", async () => {
    let release!: () => void, ready!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const held = new Promise<void>(resolve => { ready = resolve; });
    const unrelated = db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(708233, 1)`;
      ready();
      await gate;
    }, { timeout: 20000 });
    await held;
    const waiter = Promise.resolve(db.$executeRaw`SELECT pg_advisory_xact_lock(708233, 1)`);
    try {
      for (let i = 0; i < 200; i++) {
        const [row] = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%708233, 1%'`;
        if (Number(row.count) > 0) break;
        if (i === 199) throw new Error("Unrelated waiter did not reach its lock");
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const pending = blockedRequests(tx => tx.$executeRaw`SELECT pg_advisory_xact_lock(708233, 2)`, () => [
        (async () => {
          await new Promise(resolve => setTimeout(resolve, 250));
          await db.$executeRaw`SELECT pg_advisory_xact_lock(708233, 2)`;
          return new Response(null, { status: 204 });
        })(),
      ]);
      await new Promise(resolve => setTimeout(resolve, 100));
      const [probe] = await db.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(708233, 2) AS acquired`;
      expect(probe.acquired).toBe(false);
      const responses = await pending;
      expect(responses[0].status).toBe(204);
    } finally { release(); await unrelated; await waiter; }
  });

  it("enforces the deployment-wide active registration budget under concurrency", async () => {
    const prefix = `budget-${randomUUID()}`;
    const active = await db.agentOAuthClient.count({ where: { expiresAt: { gt: new Date() } } });
    expect(active).toBeLessThan(REGISTRATION_LIMIT);
    await db.agentOAuthClient.createMany({ data: Array.from({ length: REGISTRATION_LIMIT - active - 1 }, (_, i) => ({
      id: `${prefix}-${i}`, name: "Synthetic budget client", redirects: [redirectUri], expiresAt: new Date(Date.now() + 600000),
    })) });
    try {
      const registerOne = () => register(request(`${origin}/agent-oauth/register`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_name: "Synthetic budget client", redirect_uris: [redirectUri] }) }));
      const responses = await blockedRequests(tx => tx.$executeRaw`SELECT pg_advisory_xact_lock(708231, 1)`, () => [registerOne(), registerOne()]);
      expect(responses.map(r => r.status).sort()).toEqual([201, 503]);
      const created = await responses.find(r => r.status === 201)!.json();
      oauthClients.push(created.client_id);
      expect(await responses.find(r => r.status === 503)!.json()).toEqual({ error: "temporarily_unavailable" });
      expect(await db.agentOAuthClient.count({ where: { expiresAt: { gt: new Date() } } })).toBe(REGISTRATION_LIMIT);
      await db.agentOAuthClient.update({ where: { id: created.client_id }, data: { expiresAt: new Date(0) } });
      const reclaimed = await registerOne();
      expect(reclaimed.status).toBe(201);
      oauthClients.push((await reclaimed.json()).client_id);
    } finally {
      await db.agentOAuthClient.updateMany({ where: { id: { startsWith: prefix } }, data: { expiresAt: new Date(0) } });
    }
  });

  it("revokes on request", async () => {
    const { clientId, tokens } = await connected();
    expect((await revokePost(request(`${origin}/agent-oauth/revoke`, form({ token: tokens.refresh_token, client_id: clientId })))).status).toBe(200);
    expect((await rpc(tokens.access_token, "demo")).status).toBe(401);
    const grant = await db.agentGrant.findFirstOrThrow({ where: { oauthClientId: clientId } });
    expect((await db.agentApiKey.findUniqueOrThrow({ where: { id: grant.keyId } })).revokedAt).not.toBeNull();
  });

  it("answers a call outside the granted scopes with forbidden_scope before the tool runs", async () => {
    const { tokens } = await connected("services:read availability:read");
    const client = await mcp(tokens.access_token);
    await expect(client.callTool({ name: "create_proposal", arguments: { business: "demo", serviceId: "massage", serviceVersion: 1,
      staffId: "staff-demo", start: new Date(Date.now() + 5 * 86400000).toISOString() } })).rejects.toThrow();
    expect(await db.agentProposal.count({ where: { client: { grants: { some: { oauthClientId: oauthClients.at(-1) } } } } })).toBe(0);
  });

  it("refuses an expired authorization code", async () => {
    const clientId = await registerClient();
    const { handle } = await consentHandle(clientId);
    const code = new URL((await decide(handle!, "allow")).headers.get("location")!).searchParams.get("code")!;
    await db.agentOAuthCode.updateMany({ where: { clientId, consent: false }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await (await exchange({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri })).json())
      .toEqual({ error: "invalid_grant" });
  });

  it("keeps two grants at the same salon apart", async () => {
    vi.stubEnv("BOOKING_CONSENT_LAB", "1");
    const a = await mcp((await connected()).tokens.access_token), b = await mcp((await connected()).tokens.access_token);
    const created = text(await a.callTool({ name: "create_proposal", arguments: { business: "demo", serviceId: "massage", serviceVersion: 1,
      staffId: "staff-demo", start: new Date(Date.now() + 9 * 86400000).toISOString() } }));
    expect(created.proposal.id).toBeTruthy();
    expect(text(await b.callTool({ name: "get_proposal", arguments: { proposalId: created.proposal.id } })).error.code).toBe("booking_not_found");
    expect(text(await a.callTool({ name: "get_proposal", arguments: { proposalId: created.proposal.id } })).proposal.id).toBe(created.proposal.id);
  });

  it("audits grants and refusals and logs no credentials", async () => {
    const logged: string[] = [];
    const capture = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
    const spies = [vi.spyOn(console, "info").mockImplementation(capture), vi.spyOn(console, "error").mockImplementation(capture), vi.spyOn(console, "log").mockImplementation(capture)];
    try {
      const { clientId, code, tokens } = await connected();
      await exchange({ grant_type: "authorization_code", client_id: clientId, code, code_verifier: verifier, redirect_uri: redirectUri });
      await rpc(tokens.access_token, "demo");
      const grant = await db.agentGrant.findFirstOrThrow({ where: { oauthClientId: clientId } });
      const rows = await db.agentAuditEvent.findMany({ where: { OR: [{ clientId }, { clientId: grant.clientId }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      expect(rows.map(r => r.event).filter(e => e.startsWith("oauth."))).toEqual(["oauth.client_registered", "oauth.authorize_granted", "oauth.token_issued"]);
      expect(await db.agentAuditEvent.count({ where: { event: "oauth.token_denied", outcome: "invalid_grant", createdAt: { gte: rows[0].createdAt } } })).toBeGreaterThan(0);
      for (const secret of [tokens.access_token, tokens.refresh_token, code, verifier])
        for (const text of [JSON.stringify(rows), ...logged]) expect(text).not.toContain(secret);
    } finally { spies.forEach(spy => spy.mockRestore()); }
  });

  it("is off unless AGENT_OAUTH=1", async () => {
    const { tokens } = await connected();
    vi.stubEnv("AGENT_OAUTH", "");
    expect((await register(request(`${origin}/agent-oauth/register`, { method: "POST" }))).status).toBe(404);
    expect((await rpc(tokens.access_token, "demo")).status).toBe(404);
  });
});
