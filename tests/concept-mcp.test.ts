import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { POST as mcpPost } from "@/app/api/concept/mcp/route";
import { GET as listProposals } from "@/app/api/concept/proposals/route";
import { POST as decide } from "@/app/api/concept/proposals/[id]/route";
import { POST as a2aPost } from "@/app/api/concept/a2a/route";
import { GET as agentCard } from "@/app/api/concept/a2a/agent-card.json/route";
import { GET as uspProfile } from "@/app/api/concept/usp/route";
import { GET as protocolStatus } from "@/app/api/concept/protocols/route";
import { claudeCodeCommand, claudeDesktopConfig, shellToken } from "@/concept/studio/more/protocol-setup";
import { addDays, formatTime } from "@/concept/data/dates";
import { freeStarts } from "@/concept/data/slots";
import { resetDemoBusiness, toolContext } from "@/concept/server/demo-business";
import { handleConceptMcp } from "@/concept/server/mcp";
import { createRateLimiter } from "@/concept/server/rate-limit";
import { checkBearer, DEV_TOKEN, tokenSource } from "@/concept/server/token";
import type { AgentProposal } from "@/concept/tools/agent-proposal";
import { conceptTools } from "@/concept/tools/registry";

// Monday 16 November 2026, 09:00 in Stockholm. Only Date is faked; the SDK's timers run normally.
const NOW = new Date("2026-11-16T08:00:00Z");
const today = "2026-11-16";
const URL_BASE = "http://localhost:3000";
const logs: string[] = [];

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.spyOn(console, "log").mockImplementation((line: string) => void logs.push(line));
});
afterAll(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
beforeEach(() => resetDemoBusiness());
afterEach(() => vi.unstubAllEnvs());

const call = (handler: (request: Request, context: never) => Promise<Response>, request: Request) => handler(request, { params: Promise.resolve({}) } as never);

async function connect(userAgent = "claude-code/2.1.0 (test)") {
  const client = new Client({ name: "concept-test", version: "1" });
  const transport = new StreamableHTTPClientTransport(new URL(`${URL_BASE}/api/concept/mcp`), {
    fetch: (url, init) => call(mcpPost, new Request(url, init)),
    requestInit: { headers: { authorization: `Bearer ${DEV_TOKEN}`, "user-agent": userAgent } },
  });
  await client.connect(transport);
  return client;
}

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;
const body = (result: ToolResult) => JSON.parse((result.content as { type: string; text: string }[])[0].text);

function moveTarget() {
  const { state } = toolContext();
  const booking = state.bookings.find((b) => b.status === "booked" && b.date === today && b.start >= 10 * 60)!;
  for (let i = 1; i < 30; i++) {
    const date = addDays(today, i);
    const starts = freeStarts(state, booking.staffId, date, booking, { ignoreId: booking.id });
    if (starts.length) return { booking, date, time: formatTime(starts[0]) };
  }
  throw new Error("no free day");
}

const ownerRequest = (path: string, init: RequestInit = {}) => new Request(`${URL_BASE}${path}`, { ...init, headers: { "sec-fetch-site": "same-origin", "content-type": "application/json", ...init.headers } });

async function pending(): Promise<AgentProposal[]> {
  return (await (await call(listProposals, ownerRequest("/api/concept/proposals"))).json()).proposals;
}

describe("token", () => {
  it("uses the development token outside production and closes in production when unset", () => {
    expect(tokenSource({ NODE_ENV: "development" })).toBe("dev-default");
    expect(tokenSource({ NODE_ENV: "production" })).toBe("missing");
    expect(tokenSource({ NODE_ENV: "production", CONCEPT_MCP_TOKEN: "short" })).toBe("missing");
    expect(tokenSource({ NODE_ENV: "production", CONCEPT_MCP_TOKEN: "a-long-enough-demo-token" })).toBe("env");
  });

  it("accepts only the exact bearer token", () => {
    const env = { NODE_ENV: "production", CONCEPT_MCP_TOKEN: "a-long-enough-demo-token" };
    const headers = (value?: string) => new Headers(value ? { authorization: value } : {});
    expect(checkBearer(headers("Bearer a-long-enough-demo-token"), env)).toMatchObject({ ok: true });
    expect(checkBearer(headers("Bearer a-long-enough-demo-tokeN"), env)).toEqual({ ok: false, status: 401 });
    expect(checkBearer(headers(`Bearer ${DEV_TOKEN}`), env)).toEqual({ ok: false, status: 401 });
    expect(checkBearer(headers(), env)).toEqual({ ok: false, status: 401 });
    expect(checkBearer(headers("Bearer anything"), { NODE_ENV: "production" })).toEqual({ ok: false, status: 503 });
  });

  it("rejects MCP calls without a token, and in production when none is configured", async () => {
    const init = { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) };
    const missing = await call(mcpPost, new Request(`${URL_BASE}/api/concept/mcp`, init));
    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CONCEPT_MCP_TOKEN", "");
    const closed = await call(mcpPost, new Request(`${URL_BASE}/api/concept/mcp`, { ...init, headers: { ...init.headers, authorization: `Bearer ${DEV_TOKEN}` } }));
    expect(closed.status).toBe(503);
  });
});

describe("rate limit", () => {
  it("allows a fixed number of calls per window and per key", () => {
    const take = createRateLimiter({ max: 2, windowMs: 1000 });
    expect(take("a", 0)).toEqual({ ok: true });
    expect(take("a", 10)).toEqual({ ok: true });
    expect(take("a", 20)).toEqual({ ok: false, retryAfter: 1 });
    expect(take("b", 20)).toEqual({ ok: true });
    expect(take("a", 1001)).toEqual({ ok: true });
  });
});

describe("MCP round trip with the SDK client", () => {
  it("stops reading an oversized UTF-8 MCP stream before logging its tool", async () => {
    const chunks = ['{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_bookings","extra":"',
      "å".repeat(20_000), "å".repeat(15_000), '"}}'];
    const encoder = new TextEncoder();
    const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) => {
      const chunk = chunks.shift();
      if (chunk === undefined) controller.close();
      else controller.enqueue(encoder.encode(chunk));
    });
    const cancel = vi.fn();
    const stream = new ReadableStream({ pull, cancel }, { highWaterMark: 0 });
    const init = { method: "POST", duplex: "half", headers: { authorization: `Bearer ${DEV_TOKEN}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: stream };
    const log = {};
    const response = await handleConceptMcp(new Request(`${URL_BASE}/api/concept/mcp`, init), log);
    expect(response.status).toBe(413);
    expect(log).not.toHaveProperty("tool");
    expect(pull).toHaveBeenCalledTimes(3);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("lists every registry tool, plus proposal status", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([...conceptTools.map((t) => t.name), "get_proposal"].sort());
    expect(tools.find((t) => t.name === "list_bookings")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((t) => t.name === "propose_move")?.inputSchema.required).toContain("idempotencyKey");
    await client.close();
  });

  it("lists today's bookings without contact details", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "list_bookings", arguments: {} });
    expect(result.isError).toBeFalsy();
    const { from, bookings } = body(result);
    expect(from).toBe(today);
    expect(bookings.length).toBeGreaterThan(0);
    expect(Object.keys(bookings[0].customer).sort()).toEqual(["id", "name"]);
    expect(logs.some((line) => line.includes('"tool":"list_bookings"') && line.includes('"route":"/api/concept/mcp"'))).toBe(true);
    await client.close();
  });

  it("creates a move proposal that waits for the owner, and applies it only on approval", async () => {
    const client = await connect();
    const { booking, date, time } = moveTarget();
    const args = { bookingId: booking.id, date, time, idempotencyKey: "move-test-0001" };
    const created = body(await client.callTool({ name: "propose_move", arguments: args }));
    expect(created).toMatchObject({ status: "pending", replayed: false });
    expect(toolContext().state.bookings.find((b) => b.id === booking.id)).toMatchObject({ date: booking.date, start: booking.start });

    const again = body(await client.callTool({ name: "propose_move", arguments: args }));
    expect(again).toMatchObject({ proposalId: created.proposalId, replayed: true });
    const conflict = await client.callTool({ name: "propose_move", arguments: { ...args, bookingId: "b-other" } });
    expect(conflict.isError).toBe(true);
    expect(body(conflict).error.code).toBe("idempotency_conflict");

    const [proposal] = await pending();
    expect(proposal).toMatchObject({ id: created.proposalId, client: "claude", tool: "propose_move", action: { type: "booking/move", id: booking.id, date } });

    const forged = await call(decide, new Request(`${URL_BASE}/api/concept/proposals/${proposal.id}`, { method: "POST", headers: { "sec-fetch-site": "cross-site" }, body: JSON.stringify({ decision: "approved" }) }));
    expect(forged.status).toBe(403);

    const approved = await decide(ownerRequest(`/api/concept/proposals/${proposal.id}`, { method: "POST", body: JSON.stringify({ decision: "approved" }) }), { params: Promise.resolve({ id: proposal.id }) });
    expect(approved.status).toBe(200);
    const { state } = toolContext();
    expect(state.bookings.find((b) => b.id === booking.id)).toMatchObject({ date, start: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) });
    expect(state.log[0]).toMatchObject({ type: "booking/move", actor: "ai", source: "mcp" });
    expect(await pending()).toEqual([]);
    expect(body(await client.callTool({ name: "get_proposal", arguments: { proposalId: proposal.id } })).status).toBe("approved");
    await client.close();
  });

  it("stores nothing for a declined proposal and labels other agents", async () => {
    const client = await connect("node");
    const { booking } = moveTarget();
    const created = body(await client.callTool({ name: "propose_cancel", arguments: { bookingId: booking.id, idempotencyKey: "cancel-test-01" } }));
    const [proposal] = await pending();
    expect(proposal.client).toBe("agent");
    await decide(ownerRequest(`/api/concept/proposals/${created.proposalId}`, { method: "POST", body: JSON.stringify({ decision: "declined" }) }), { params: Promise.resolve({ id: created.proposalId }) });
    expect(toolContext().state.bookings.find((b) => b.id === booking.id)?.status).toBe("booked");
    await client.close();
  });

  it("returns tool errors with alternatives instead of creating a proposal", async () => {
    const client = await connect();
    const result = await client.callTool({ name: "propose_move", arguments: { bookingId: "b-missing", date: today, time: "12:00", idempotencyKey: "missing-0001" } });
    expect(result.isError).toBe(true);
    expect(body(result).error.code).toBe("not_possible");
    expect(await pending()).toEqual([]);
    await client.close();
  });
});

describe("setup snippets", () => {
  const endpoint = `${URL_BASE}/api/concept/mcp`;
  const paths = { mcp: "/api/concept/mcp", a2a: "/api/concept/a2a", agentCard: "/api/concept/a2a/agent-card.json", usp: "/api/concept/usp" };

  it("puts the demo token into the Claude Code command and Claude Desktop config", () => {
    const info = { paths, mcp: { token: "dev-default" as const, devToken: DEV_TOKEN } };
    expect(claudeCodeCommand(endpoint, shellToken(info))).toBe(`claude mcp add --transport http flerdo-demo ${endpoint} --header "Authorization: Bearer ${DEV_TOKEN}"`);
    const config = JSON.parse(claudeDesktopConfig(endpoint, info));
    expect(config.mcpServers["flerdo-demo"]).toMatchObject({ command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", "Authorization:${AUTH_HEADER}"], env: { AUTH_HEADER: `Bearer ${DEV_TOKEN}` } });
  });

  it("never needs a configured token: it points to the variable instead", () => {
    const info = { paths, mcp: { token: "env" as const } };
    expect(claudeCodeCommand(endpoint, shellToken(info))).toContain("Bearer $CONCEPT_MCP_TOKEN");
    expect(claudeDesktopConfig(endpoint, info)).toContain("<your CONCEPT_MCP_TOKEN>");
  });

  it("the protocol status route only ever exposes the public development token", async () => {
    vi.stubEnv("CONCEPT_MCP_TOKEN", "a-long-enough-secret-token");
    const body = await (await call(protocolStatus, new Request(`${URL_BASE}/api/concept/protocols`))).json();
    expect(body.mcp).toEqual({ token: "env" });
    expect(JSON.stringify(body)).not.toContain("a-long-enough-secret-token");
  });
});

describe("discovery and A2A", () => {
  it("publishes an agent card and a USP profile that state their limits", async () => {
    const card = await (await call(agentCard, new Request(`${URL_BASE}/api/concept/a2a/agent-card.json`))).json();
    expect(card.supportedInterfaces[0]).toMatchObject({ url: `${URL_BASE.replace("localhost", "127.0.0.1")}/api/concept/a2a`, protocolBinding: "JSONRPC", protocolVersion: "1.0" });
    expect(card["x-flerdo"].limitations).toMatch(/booking page/);
    const usp = await (await call(uspProfile, new Request(`${URL_BASE}/api/concept/usp`))).json();
    expect(usp.usp.services["dev.usp-protocol.services"][0]).toMatchObject({ transport: "mcp" });
    expect(usp["x-flerdo"].compatibility).toMatch(/not implemented/);
  });

  it("answers SendMessage with services and free times, and a booking page link instead of booking", async () => {
    const send = async (command: unknown) => {
      const response = await call(a2aPost, new Request(`${URL_BASE}/api/concept/a2a`, {
        method: "POST",
        headers: { "content-type": "application/json", "a2a-version": "1.0" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "SendMessage", params: { message: { messageId: "m1", role: "ROLE_USER", parts: [{ text: JSON.stringify(command) }] } } }),
      }));
      const rpc = await response.json();
      expect(rpc).toMatchObject({ jsonrpc: "2.0", id: 7, result: { message: { role: "ROLE_AGENT" } } });
      return JSON.parse(rpc.result.message.parts[0].text);
    };
    const { services } = await send({ action: "services" });
    expect(services.length).toBeGreaterThan(3);
    const free = await send({ action: "availability", serviceId: services[0].id, date: addDays(today, 1) });
    expect(free.staff[0].starts.length).toBeGreaterThan(0);
    expect((await send({ action: "book", serviceId: services[0].id })).bookingUrl).toContain(`/boka/salong-eko?service=${services[0].id}`);
    expect((await send({ action: "delete-everything" })).error.code).toBe("invalid_request");
  });

  it("rejects other JSON-RPC methods", async () => {
    const response = await call(a2aPost, new Request(`${URL_BASE}/api/concept/a2a`, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "CancelTask" }) }));
    expect((await response.json()).error.code).toBe(-32601);
  });
});
