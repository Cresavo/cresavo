import { timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { scopedAvailability } from "../../domain";
import { ZONE } from "../../time";
import { AgentApiError } from "../errors";
import type { AgentScope } from "../keys";
import { DEMO_LOCATION_ID } from "../place";
import { agentErrorResponse, API_VERSION, availabilityFor, Created, mapAgentError, serviceView } from "../v1";
import { sandboxConfig, sandboxHost } from "./config";
import { bookSandboxProposal, createSandboxProposal, getSandboxBooking, getSandboxProposal, requireSandboxBusiness, SANDBOX_BUSINESS } from "./ledger";
import { authenticateSandboxAgent, chargeSandboxAgent, sandboxJson, sandboxTransaction, type SandboxAgent } from "./store";

const sandboxBusiness = Object.freeze({
  id: SANDBOX_BUSINESS, name: "Salong Eko (synthetic demo)", timeZone: ZONE, locationId: DEMO_LOCATION_ID,
});

function scopedProvider(tx: Prisma.TransactionClient, agent: SandboxAgent) {
  const { businessId } = agent;
  return {
    async listServices() {
      const services = await tx.service.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" }, take: 10 });
      const resources = await tx.staff.findMany({ where: { businessId, active: true }, orderBy: { name: "asc" }, take: 10 });
      return { services, resources };
    },
    async getAvailability(serviceId: string, day: string, staffId?: string) {
      if (!staffId) throw new AgentApiError("staff_not_found");
      return { starts: await scopedAvailability(serviceId, day, tx, staffId, businessId), timeZone: ZONE };
    },
  };
}

async function handle(tx: Prisma.TransactionClient, agent: SandboxAgent, request: Request, route: string, body?: unknown) {
  const { pathname, searchParams } = new URL(request.url);
  const id = pathname.split("/").at(-1) ?? "";
  switch (route) {
    case "GET /api/v1/access":
      return { apiVersion: API_VERSION, providerMode: "split", scopes: agent.scopes };
    case "GET /api/v1/services": {
      requireSandboxBusiness(searchParams.get("business"));
      const { services, resources } = await scopedProvider(tx, agent).listServices();
      return { apiVersion: API_VERSION, business: sandboxBusiness, services: services.map(service => serviceView(service, resources)) };
    }
    case "GET /api/v1/availability":
      requireSandboxBusiness(searchParams.get("business"));
      return availabilityFor(sandboxBusiness, searchParams, scopedProvider(tx, agent));
    case "POST /api/v1/proposals":
      return new Created(await createSandboxProposal(tx, agent, body));
    case "GET /api/v1/proposals/{id}":
      return getSandboxProposal(tx, agent, id);
    case "POST /api/v1/bookings":
      return bookSandboxProposal(tx, agent, body, request.headers.get("idempotency-key"));
    case "GET /api/v1/bookings/{id}":
      return getSandboxBooking(tx, agent, id);
    default:
      throw new AgentApiError("booking_not_found");
  }
}

/** The sandbox never delegates to an ordinary provider handler. */
export async function sandboxAgentRoute(request: Request, route: string, scope: AgentScope | readonly AgentScope[]) {
  try {
    const config = sandboxConfig();
    if (!sandboxHost(request, config.origin) || new URL(request.url).origin !== config.origin)
      return agentErrorResponse("booking_not_found");
    const presented = request.headers.get("x-booking-gateway-token");
    if (!presented || !/^[a-f0-9]{64}$/.test(presented) ||
        !timingSafeEqual(Buffer.from(presented), Buffer.from(process.env.GATEWAY_SERVICE_TOKEN!)))
      return agentErrorResponse("unauthorized");
    const body = request.method === "POST" ? await sandboxJson(request) : undefined;
    return await sandboxTransaction(async (tx, installation) => {
      const agent = await authenticateSandboxAgent(tx, installation, request.headers, scope);
      await chargeSandboxAgent(tx, agent);
      await tx.$executeRaw`SAVEPOINT sandbox_operation`;
      let response: Response;
      let outcome: string;
      try {
        const value = await handle(tx, agent, request, route, body);
        const status = value instanceof Created ? 201 : 200;
        response = Response.json(value instanceof Created ? value.body : value, {
          status, headers: { "Cache-Control": "no-store", "X-Booking-Lab-Api": API_VERSION },
        });
        outcome = String(status);
      } catch (error) {
        await tx.$executeRaw`ROLLBACK TO SAVEPOINT sandbox_operation`;
        const { code, retryAfter } = mapAgentError(error);
        response = agentErrorResponse(code, retryAfter);
        outcome = code;
      }
      await tx.sandboxAudit.create({ data: { sessionId: agent.id, event: route, outcome } });
      return response;
    });
  } catch (error) {
    return error instanceof AgentApiError
      ? agentErrorResponse(error.code, error.retryAfter)
      : agentErrorResponse("provider_configuration_invalid");
  }
}
