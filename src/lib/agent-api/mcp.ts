import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "../db";
import { checkRateLimit } from "../rate-limit";
import { AgentApiError, agentApiErrors } from "./errors";
import { authenticateAgent, type AgentPrincipal, type AgentScope } from "./keys";
import { agentErrorResponse, availabilityV1, Created, mapAgentError, servicesV1 } from "./v1";
import { cancelBookingV1, createAgentBooking, getBookingV1 } from "./bookings";

// Same business rules and key checks as the REST API. Authentication is the
// sandbox API key (Bearer / X-API-Key), not MCP OAuth; see README.
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
  const business = z.string().describe(`Business id. This key may only use "${principal.businessId}".`);
  server.registerTool(
    "list_services",
    { description: "List bookable services, prices, durations and staff for the synthetic demo salon.", inputSchema: z.object({ business }) },
    async (a) => tool(principal, "services:read", () => servicesV1(principal, params(a))),
  );
  server.registerTool(
    "get_availability",
    {
      description: "Available start times (ISO 8601, Europe/Stockholm). Use date, or from/to (max 14 days).",
      inputSchema: z.object({
        business, service: z.string(),
        date: z.string().optional(), from: z.string().optional(), to: z.string().optional(), staff: z.string().optional(),
      }),
    },
    async (a) => tool(principal, "availability:read", () => availabilityV1(principal, params(a))),
  );
  server.registerTool(
    "create_booking",
    {
      description:
        "Book one slot from get_availability. Only call after the person approved this exact service, staff and time; set confirmed=true. Synthetic @example.test emails only. Reuse the same idempotencyKey when retrying.",
      inputSchema: z.object({
        idempotencyKey: z.string(), business, serviceId: z.string(), serviceVersion: z.number().int(),
        staffId: z.string(), start: z.string(),
        customer: z.object({ name: z.string(), email: z.string() }), confirmed: z.boolean(),
      }),
    },
    async ({ idempotencyKey, ...body }) =>
      tool(principal, "bookings:write", () => createAgentBooking(principal, idempotencyKey, body)),
  );
  server.registerTool(
    "get_booking",
    { description: "Read status of a booking this key created.", inputSchema: z.object({ bookingId: z.string() }) },
    async (a) => tool(principal, "bookings:read", () => getBookingV1(principal, a.bookingId)),
  );
  server.registerTool(
    "cancel_booking",
    { description: "Cancel a booking this key created. Only on the person's explicit request.", inputSchema: z.object({ bookingId: z.string() }) },
    async (a) => tool(principal, "bookings:write", () => cancelBookingV1(principal, a.bookingId)),
  );
  return server;
}

export async function handleMcp(request: Request) {
  let principal: AgentPrincipal;
  try {
    principal = await authenticateAgent(request.headers, db, "services:read");
    await checkRateLimit("agent-api", `key:${principal.keyId}`);
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
