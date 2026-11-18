import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const lifecycle = vi.hoisted(() => ({ created: 0 }));
vi.mock("@modelcontextprotocol/server", async original => {
  const sdk = await original<typeof import("@modelcontextprotocol/server")>();
  return { ...sdk, createMcpHandler: (...args: Parameters<typeof sdk.createMcpHandler>) => { lifecycle.created++; return sdk.createMcpHandler(...args); } };
});
vi.mock("../src/lib/db", () => ({ db: {} }));
vi.mock("../src/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => {}) }));
vi.mock("../src/lib/agent-api/audit", () => ({ auditContext: (run: () => unknown) => run(), recordAudit: vi.fn(async () => {}) }));
vi.mock("../src/lib/agent-api/keys", async () => {
  const { AgentApiError } = await import("../src/lib/agent-api/errors");
  return { authenticateAgent: async (headers: Headers) => {
    const id = headers.get("authorization")?.replace("Bearer ", "");
    if (id !== "fictional-a" && id !== "fictional-b") throw new AgentApiError("unauthorized");
    return { keyId: id, clientId: id, keyPrefix: id, businessId: "demo", agentName: "Fictional transport test", ownerName: "Fictional", kind: "demo-script", scopes: ["services:read"] };
  } };
});
vi.mock("../src/lib/agent-api/v1", async () => {
  const errors = await import("../src/lib/agent-api/errors");
  return {
    Created: class {},
    servicesV1: async (principal: { clientId: string }) => {
      await new Promise(resolve => setTimeout(resolve, principal.clientId === "fictional-a" ? 8 : 1));
      return { clientId: principal.clientId };
    },
    serviceV1: vi.fn(), availabilityV1: vi.fn(),
    mapAgentError: (error: unknown) => ({ code: error instanceof errors.AgentApiError ? error.code : "internal_error" }),
    agentErrorResponse: (code: keyof typeof errors.agentApiErrors) => Response.json({ error: code }, { status: errors.agentApiErrors[code].status }),
  };
});
vi.mock("../src/lib/agent-api/bookings", () => ({ cancelBookingV1: vi.fn(), createAgentBooking: vi.fn(), getBookingV1: vi.fn() }));
vi.mock("../src/lib/agent-api/proposals", async original => ({ ...await original<typeof import("../src/lib/agent-api/proposals")>(), createProposal: vi.fn(), getProposal: vi.fn() }));

import { handleMcp } from "../src/lib/agent-api/mcp";

const clients: Client[] = [];
beforeAll(() => { vi.stubEnv("PUBLIC_READONLY", ""); });
afterEach(() => { vi.stubEnv("PUBLIC_READONLY", ""); });
afterAll(async () => { await Promise.all(clients.map(client => client.close())); vi.unstubAllEnvs(); });
async function connect(id: string) {
  const client = new Client({ name: "fictional-mcp-test", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/v1/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${id}` } },
    fetch: (input, init) => handleMcp(new Request(input, init)),
  }));
  return client;
}

describe("reused engine MCP transport (#15)", () => {
  it("keeps interleaved principals isolated across requests while constructing one handler", async () => {
    const [a, b] = await Promise.all([connect("fictional-a"), connect("fictional-b")]);
    for (let round = 0; round < 3; round++) {
      const results = await Promise.all([a, b].map(client => client.callTool({ name: "list_services", arguments: { business: "demo" } })));
      expect(results.map(result => JSON.parse((result.content[0] as { text: string }).text).clientId)).toEqual(["fictional-a", "fictional-b"]);
    }
    expect(lifecycle.created).toBe(1);
  });
  it("still denies missing credentials, wrong scopes and read-only mutations before transport", async () => {
    const request = (key?: string) => new Request("http://localhost/api/v1/mcp", { method: "POST", headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_booking", arguments: {} } }) });
    expect((await handleMcp(request())).status).toBe(401);
    expect((await handleMcp(request("fictional-a"))).status).toBe(403);
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await handleMcp(request("fictional-b"))).status).toBe(403);
    expect(lifecycle.created).toBe(1);
  });
});
