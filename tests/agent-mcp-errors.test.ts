import { describe, expect, it, vi } from "vitest";

// ADR 7 / #181: a failure inside the MCP transport answers with the static catalogue error.
const transport = vi.hoisted(() => ({ fail: async (): Promise<Response> => { throw new Error("private stack detail"); } }));
vi.mock("@modelcontextprotocol/server", async original => ({
  ...await original<typeof import("@modelcontextprotocol/server")>(),
  createMcpHandler: () => ({ fetch: () => transport.fail() }),
}));
vi.mock("../src/lib/db", () => ({ db: {} }));
vi.mock("../src/lib/rate-limit", () => ({ checkRateLimit: vi.fn(async () => {}) }));
vi.mock("../src/lib/agent-api/audit", () => ({ auditContext: (run: () => unknown) => run(), recordAudit: vi.fn(async () => {}) }));
vi.mock("../src/lib/agent-api/keys", () => ({ authenticateAgent: async () => ({ keyId: "k", clientId: "c", keyPrefix: "p",
  businessId: "demo", agentName: "Fictional", ownerName: "Fictional", kind: "demo-script", scopes: ["services:read"] }) }));

import { handleMcp } from "../src/lib/agent-api/mcp";

const request = () => new Request("http://localhost/api/v1/mcp", { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer fictional" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_services", arguments: { business: "demo" } } }) });

describe("MCP transport failures", () => {
  it.each([
    ["a thrown error", async (): Promise<Response> => { throw new Error("private stack detail"); }],
    ["a 5xx response", async () => new Response("private stack detail", { status: 502 })],
  ])("answer %s with the static internal_error", async (_name, fail) => {
    transport.fail = fail;
    const response = await handleMcp(request());
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("internal_error");
    expect(text).not.toContain("private stack detail");
  });
});
