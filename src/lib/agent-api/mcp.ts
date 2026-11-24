import { auditContext, recordAudit } from "./audit";
import { isPublicReadonly, readonlyForbidden, assertWritable } from "../public-readonly";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { db } from "../db";
import { checkRateLimit } from "../rate-limit";
import { AgentApiError, agentApiErrors } from "./errors";
import { authenticateAgent, type AgentPrincipal, type AgentScope } from "./keys";
import { agentErrorResponse, availabilityV1, Created, mapAgentError, servicesV1, serviceV1 } from "./v1";
import { createAgentBooking, getBookingV1, refuseDirectCancel } from "./bookings";
import { createProposal, getProposal } from "./proposals";
import { mcpInputs } from "./mcp-inputs";
import { checkAgentAddress, type AgentCreate } from "./address-limits";
import { discoveryOrigin } from "./discovery";
import { consentElicitation } from "./consent-elicitation";

// Same business rules and key checks as the REST API. Authentication is the
// agent API key, or a customer agent's OAuth grant on its salon's MCP resource.
async function tool(principal: AgentPrincipal, scope: AgentScope | readonly AgentScope[], run: () => Promise<unknown>, name: string) {
  try {
    const required = Array.isArray(scope) ? scope : [scope];
    if (required.includes("bookings:write")) assertWritable();
    if (!required.some(s => principal!.scopes.includes(s))) throw new AgentApiError("forbidden_scope");
    const result = await run();
    await recordAudit({ event: "agent.request", outcome: "success", tool: name, clientId: principal.clientId, keyId: principal.keyId, scopes: principal.scopes });
    const body = result instanceof Created ? result.body : result;
    return {
      content: [{ type: "text" as const, text: JSON.stringify(body) }],
      structuredContent: body as Record<string, unknown>,
    };
  } catch (error) {
    const { code } = mapAgentError(error);
    await recordAudit({ event: "agent.request", outcome: code, tool: name, clientId: principal.clientId, keyId: principal.keyId, scopes: principal.scopes });
    const payload = { error: { code, message: agentApiErrors[code].message } };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
  }
}

const params = (o: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => e[1] !== undefined));

export function agentMcpServer(principal: AgentPrincipal) {
  const server = new McpServer({ name: "booking-lab-agent-api", version: "1.0.0" });
  server.registerTool("create_proposal", { description: "Propose an exact synthetic booking for customer consent. Does not grant authority.", inputSchema: mcpInputs.create_proposal },
    async a => tool(principal, "bookings:write", () => createProposal(principal, a), "create_proposal"));
  server.registerTool("get_proposal", { description: "Read this client's proposal status and approved mandateId. A client with URL elicitation is asked to open the consent page for a pending proposal.", inputSchema: mcpInputs.get_proposal },
    async (a, ctx) => {
      const reply = await tool(principal, ["bookings:read", "bookings:write"], () => getProposal(principal, a.proposalId), "get_proposal");
      return ("structuredContent" in reply ? consentElicitation(ctx, reply.structuredContent) : null) ?? reply;
    });
  for (const name of ["list_services", "usp_services_list"])
  server.registerTool(
    name,
    { description: "List synthetic services using Booking Lab native v1 arguments/results (USP name alias only).", inputSchema: mcpInputs.list_services },
    async (a) => tool(principal, "services:read", () => servicesV1(principal, params(a)), name),
  );
  server.registerTool("usp_services_get", {
    description: "One service from the same authorised catalog. Native arguments: business, service. Not canonical USP wire format.",
    inputSchema: mcpInputs.get_service,
  }, async a => tool(principal, "services:read", () => serviceV1(principal, params(a)), "usp_services_get"));
  for (const name of ["get_availability", "usp_availability_query"])
  server.registerTool(
    name,
    {
      description: "Available start times (ISO 8601, Europe/Stockholm). Use date, or from/to (max 14 days).",
      inputSchema: mcpInputs.get_availability,
    },
    async (a) => tool(principal, "availability:read", () => availabilityV1(principal, params(a)), name),
  );
  for (const name of ["create_booking", "usp_bookings_create"])
  server.registerTool(
    name,
    {
      description:
        "Book one slot under a server-issued mandateId. confirmed=true alone grants no authority. Synthetic @example.test emails only. Reuse the same idempotencyKey and mandateId when retrying.",
      inputSchema: mcpInputs.create_booking,
    },
    async ({ idempotencyKey, ...body }) =>
      tool(principal, "bookings:write", () => createAgentBooking(principal, idempotencyKey, body), name),
  );
  for (const name of ["get_booking", "usp_bookings_get"])
  server.registerTool(
    name,
    { description: "Read status of a booking owned by this stable client.", inputSchema: mcpInputs.get_booking },
    async (a) => tool(principal, "bookings:read", () => getBookingV1(principal, a.bookingId), name),
  );
  server.registerTool(
    "cancel_booking",
    { description: "Not available yet: cancellation needs the customer's approval. Ask the person to cancel through the salon.", inputSchema: mcpInputs.cancel_booking },
    async (a) => tool(principal, "bookings:write", () => refuseDirectCancel(principal, a.bookingId), "cancel_booking"),
  );
  return server;
}

// Reuse the transport, never the authenticated server/principal. The SDK factory
// creates a server per request using only the principal verified below.
const handler = createMcpHandler(({ authInfo }) => {
  const principal = authInfo?.extra?.principal as AgentPrincipal | undefined;
  if (!principal) throw new AgentApiError("unauthorized");
  return agentMcpServer(principal);
}, { responseMode: "json", maxRequestBodySize: 64 * 1024 });

const toolScopes: Record<string, AgentScope | readonly AgentScope[]> = {
  create_proposal: "bookings:write", get_proposal: ["bookings:read", "bookings:write"],
  list_services: "services:read", usp_services_list: "services:read", usp_services_get: "services:read",
  get_availability: "availability:read", usp_availability_query: "availability:read",
  create_booking: "bookings:write", usp_bookings_create: "bookings:write",
  get_booking: "bookings:read", usp_bookings_get: "bookings:read", cancel_booking: "bookings:write",
};
const toolCreates: Record<string, AgentCreate> = { create_proposal: "proposal", create_booking: "booking", usp_bookings_create: "booking" };
const MAX_BODY = 64 * 1024;

// MCP servers must validate Origin (DNS rebinding, browser cross-origin). Clients without one are not browsers.
function assertOrigin(headers: Headers) {
  const origin = headers.get("origin");
  if (origin === null) return;
  let own: string;
  try { own = discoveryOrigin(); } catch { throw new AgentApiError("forbidden_origin"); }
  if (origin !== own) throw new AgentApiError("forbidden_origin");
}

// Exactly one JSON-RPC message, read and parsed once. The limiter, the scope check and the SDK
// all see the same re-serialised message, so a parser difference cannot split them.
async function readMessage(request: Request) {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const next = await reader?.read();
    if (!next || next.done) break;
    size += next.value.length;
    if (size > MAX_BODY) { void reader!.cancel(); throw new AgentApiError("invalid_request"); }
    chunks.push(next.value);
  }
  let rpc: unknown;
  try { rpc = JSON.parse(Buffer.concat(chunks).toString().replace(/^\uFEFF/, "")); } catch { throw new AgentApiError("invalid_request"); }
  if (!rpc || typeof rpc !== "object" || Array.isArray(rpc)) throw new AgentApiError("invalid_request");
  return rpc as { method?: unknown; params?: { name?: unknown } };
}

async function handleMcpInternal(request: Request, salon?: string) {
  let principal: AgentPrincipal | undefined;
  let requestedTool: string | undefined;
  let forward = request;
  try {
    assertOrigin(request.headers);
    let name: string | undefined;
    if (request.method === "POST") {
      const rpc = await readMessage(request);
      if (rpc.method === "tools/call" && typeof rpc.params?.name === "string") name = rpc.params.name;
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      forward = new Request(request.url, { method: "POST", headers, body: JSON.stringify(rpc) });
    }
    await checkAgentAddress(request.headers, name ? toolCreates[name] : undefined);
    principal = await authenticateAgent(request.headers, db, ["services:read", "availability:read", "bookings:read", "bookings:write"]);
    // RFC 8707 audience: a salon's MCP resource takes only that salon's OAuth grants, the shared one none.
    if ((principal.grantId ? principal.businessId : undefined) !== salon) throw new AgentApiError("unauthorized");
    const required = name ? toolScopes[name] : undefined;
    if (required) requestedTool = name;
    if (required && !(Array.isArray(required) ? required : [required]).some(s => principal!.scopes.includes(s))) throw new AgentApiError("forbidden_scope");
    await checkRateLimit("agent-api", `client:${principal.clientId}`);
  } catch (error) {
    const { code, retryAfter } = mapAgentError(error);
    await recordAudit({ event: "agent.request", outcome: code, tool: requestedTool, route: "MCP /api/v1/mcp", ...(principal ? { clientId: principal.clientId, scopes: principal.scopes } : {}) });
    return agentErrorResponse(code, retryAfter);
  }
  console.info(JSON.stringify({ event: "agent_api_request", route: "MCP /api/v1/mcp", keyPrefix: `blk_${principal.keyPrefix}`, agentName: principal.agentName }));
  try {
    const response = await handler.fetch(forward, { authInfo: { token: principal.keyId, clientId: principal.clientId, scopes: principal.scopes, extra: { principal } } });
    // A transport failure answers with the static catalogue error, never the SDK's own body.
    if (response.status >= 500) throw new Error("MCP_TRANSPORT_FAILED");
    await recordAudit({ event: "agent.request", outcome: String(response.status), route: "MCP /api/v1/mcp", clientId: principal.clientId, scopes: principal.scopes });
    return response;
  } catch {
    await recordAudit({ event: "agent.request", outcome: "internal_error", route: "MCP /api/v1/mcp", clientId: principal.clientId });
    return agentErrorResponse("internal_error");
  }
}

export async function handleMcp(request: Request, salon?: string) {
  if (isPublicReadonly()) return readonlyForbidden();
  return auditContext(() => handleMcpInternal(request, salon));
}
