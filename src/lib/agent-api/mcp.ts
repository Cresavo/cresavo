import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { db } from "../db";
import { checkRateLimit } from "../rate-limit";
import { AgentApiError, agentApiErrors } from "./errors";
import { authenticateAgent, type AgentPrincipal, type AgentScope } from "./keys";
import { agentErrorResponse, availabilityV1, Created, mapAgentError, servicesV1, serviceV1 } from "./v1";
import { cancelBookingV1, createAgentBooking, getBookingV1 } from "./bookings";
import { mcpInputs } from "./mcp-inputs";

// Same business rules and key checks as the REST API. Authentication is the
// sandbox API key or process-local lab OAuth access token.
async function tool(principal: AgentPrincipal, scope: AgentScope, run: () => Promise<unknown>) {
  try {
    if (!principal.scopes.includes(scope)) throw new AgentApiError("forbidden_scope");
    const result = await run();
    const body = result instanceof Created ? result.body : result;
    return {
      content: [{ type: "text" as const, text: JSON.stringify(body) }],
      structuredContent: body as Record<string, unknown>,
    };
  } catch (error) {
    const { code } = mapAgentError(error);
    const payload = { error: { code, message: agentApiErrors[code].message } };
    return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
  }
}

const params = (o: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => e[1] !== undefined));

export function agentMcpServer(principal: AgentPrincipal) {
  const server = new McpServer({ name: "booking-lab-agent-api", version: "1.0.0" });
  for (const name of ["list_services", "usp_services_list"])
  server.registerTool(
    name,
    { description: "List synthetic services using Booking Lab native v1 arguments/results (USP name alias only).", inputSchema: mcpInputs.list_services },
    async (a) => tool(principal, "services:read", () => servicesV1(principal, params(a))),
  );
  server.registerTool("usp_services_get", {
    description: "One service from the same authorised catalog. Native arguments: business, service. Not canonical USP wire format.",
    inputSchema: mcpInputs.get_service,
  }, async a => tool(principal, "services:read", () => serviceV1(principal, params(a))));
  for (const name of ["get_availability", "usp_availability_query"])
  server.registerTool(
    name,
    {
      description: "Available start times (ISO 8601, Europe/Stockholm). Use date, or from/to (max 14 days).",
      inputSchema: mcpInputs.get_availability,
    },
    async (a) => tool(principal, "availability:read", () => availabilityV1(principal, params(a))),
  );
  for (const name of ["create_booking", "usp_bookings_create"])
  server.registerTool(
    name,
    {
      description:
        "Book one slot under an operator-issued synthetic mandateId. confirmed=true alone grants no authority. Synthetic @example.test emails only. Reuse the same idempotencyKey and mandateId when retrying.",
      inputSchema: mcpInputs.create_booking,
    },
    async ({ idempotencyKey, ...body }) =>
      tool(principal, "bookings:write", () => createAgentBooking(principal, idempotencyKey, body)),
  );
  for (const name of ["get_booking", "usp_bookings_get"])
  server.registerTool(
    name,
    { description: "Read status of a booking owned by this stable client.", inputSchema: mcpInputs.get_booking },
    async (a) => tool(principal, "bookings:read", () => getBookingV1(principal, a.bookingId)),
  );
  server.registerTool(
    "cancel_booking",
    { description: "Cancel a booking owned by this client. Only on the person's explicit request.", inputSchema: mcpInputs.cancel_booking },
    async (a) => tool(principal, "bookings:write", () => cancelBookingV1(principal, a.bookingId)),
  );
  return server;
}

export async function handleMcp(request: Request) {
  let principal: AgentPrincipal;
  try {
    principal = await authenticateAgent(request.headers, db, "services:read");
    if (request.method === "POST") {
      // Inspect a bounded clone; the SDK still validates and consumes the original.
      const reader = request.clone().body?.getReader();
      if (reader) {
        const chunks: Uint8Array[] = []; let size = 0;
        for (;;) {
          const next = await reader.read(); if (next.done) break;
          size += next.value.length;
          if (size > 64 * 1024) { void reader.cancel(); throw new AgentApiError("invalid_request"); }
          chunks.push(next.value);
        }
        let rpc;
        try { rpc = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new AgentApiError("invalid_request"); }
        const scopes: Record<string, AgentScope> = {
          list_services: "services:read", usp_services_list: "services:read", usp_services_get: "services:read",
          get_availability: "availability:read", usp_availability_query: "availability:read",
          create_booking: "bookings:write", usp_bookings_create: "bookings:write",
          get_booking: "bookings:read", usp_bookings_get: "bookings:read", cancel_booking: "bookings:write",
        };
        const required = rpc?.method === "tools/call" && typeof rpc.params?.name === "string" ? scopes[rpc.params.name] : undefined;
        if (required && !principal.scopes.includes(required)) throw new AgentApiError("forbidden_scope");
      }
    }
    await checkRateLimit("agent-api", `client:${principal.clientId}`);
  } catch (error) {
    const { code, retryAfter } = mapAgentError(error);
    return agentErrorResponse(code, retryAfter);
  }
  console.info(JSON.stringify({ event: "agent_api_request", route: "MCP /api/v1/mcp", keyPrefix: `blk_${principal.keyPrefix}`, agentName: principal.agentName }));
  const handler = createMcpHandler(() => agentMcpServer(principal), { responseMode: "json", maxRequestBodySize: 64 * 1024 });
  try {
    return await handler.fetch(request);
  } finally {
    await handler.close();
  }
}
