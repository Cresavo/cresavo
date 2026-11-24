import { timingSafeEqual } from "node:crypto";
import { auditContext, recordAudit } from "./audit";
import { isPublicReadonly, readonlyForbidden } from "../public-readonly";
import { fixtureStaff } from "../public-fixtures";
import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { z, ZodError } from "zod";
import { db } from "../db";
import { DEMO_BUSINESS_ID } from "../config";
import { DomainError } from "../errors";
import { checkAgentAddress } from "./address-limits";
import { checkRateLimit } from "../rate-limit";
import { getBookingProvider, type BookingProvider } from "./provider";
import { sandboxRequested } from "./sandbox/config";
import { parseDay, ZONE } from "../time";
import { dateSchema } from "../validation";
import { AgentApiError, agentApiErrors, type AgentApiErrorCode } from "./errors";
import { discoveryOrigin } from "./discovery";
import { DEMO_LOCATION_ID, placeForStaff } from "./place";
import {
  assertBusinessAccess,
  authenticateAgent,
  type AgentPrincipal,
  type AgentScope,
} from "./keys";

export const API_VERSION = "v1";
export const MAX_RANGE_DAYS = 14;

// Closed synthetic business allowlist; provider registration cannot widen it.
// Every request is checked against the credential business (OWASP API1 / BOLA).
const BUSINESSES: Record<string, { id: string; name: string; timeZone: string; locationId: string }> = {
  "lab-partner": { id: "lab-partner", name: "Synthetic partner lab", timeZone: ZONE, locationId: DEMO_LOCATION_ID },
  [DEMO_BUSINESS_ID]: {
    id: DEMO_BUSINESS_ID,
    name: "Salong Eko (synthetic demo)",
    timeZone: ZONE,
    locationId: DEMO_LOCATION_ID,
  },
};

const id = z.string().trim().min(1).max(128);

const headers = { "Cache-Control": "no-store", "X-Booking-Lab-Api": API_VERSION };

function authChallenge(code: AgentApiErrorCode) {
  let metadata = "";
  try { metadata = `, resource_metadata="${discoveryOrigin()}/.well-known/oauth-protected-resource"`; }
  catch { /* Invalid operator configuration: never fall back to request headers. */ }
  return `Bearer realm="booking-lab-agent-api"${metadata}${code === "forbidden_scope" ? ', error="insufficient_scope"' : ""}`;
}

export function agentErrorResponse(code: AgentApiErrorCode, retryAfter?: number) {
  const { status, message } = agentApiErrors[code];
  return NextResponse.json(
    { apiVersion: API_VERSION, error: { code, message } },
    {
      status,
      headers: {
        ...headers,
        ...(status === 401 || code === "forbidden_scope" ? { "WWW-Authenticate": authChallenge(code) } : {}),
        ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
      },
    },
  );
}

export function mapAgentError(error: unknown): { code: AgentApiErrorCode; retryAfter?: number } {
  if (error instanceof AgentApiError) return { code: error.code, retryAfter: error.retryAfter };
  if (error instanceof DomainError) {
    if (isPublicReadonly() && error.status === 403) return { code: "forbidden_scope" };
    if (error.status === 429) return { code: "rate_limited", retryAfter: error.retryAfter };
    if (error.message === "This treatment is no longer available.") return { code: "service_not_found" };
    if (error.message === "This team member does not provide the selected treatment.") return { code: "staff_not_found" };
    if (error.message === "That time is no longer available. Choose another time.") return { code: "slot_unavailable" };
    if (error.message === "The details have changed. Refresh and review them again.") return { code: "stale_service" };
    if (error.message === "This booking attempt was already used with different details.") return { code: "idempotency_conflict" };
    if (error.message === "Booking not found. Return to the calendar.") return { code: "booking_not_found" };
    if (error.status === 400) return { code: "invalid_request" };
  }
  if (error instanceof ZodError || error instanceof SyntaxError) return { code: "invalid_request" };
  // Never log the error, request, key or SQL.
  console.error("AGENT_API_INTERNAL_ERROR");
  return { code: "internal_error" };
}

function logUsage(route: string, principal: AgentPrincipal | null, status: number) {
  // Minimal audit line: no key material, no query values, no customer data.
  console.info(
    JSON.stringify({
      event: "agent_api_request",
      route,
      status,
      keyPrefix: principal ? `blk_${principal.keyPrefix}` : null,
      agentName: principal?.agentName ?? null,
    }),
  );
}

export type AgentHandler = (
  principal: AgentPrincipal,
  params: URLSearchParams,
  request: Request,
) => Promise<unknown>;

/** Lets a handler choose a non-200 status (e.g. 201 Created). */
export class Created {
  constructor(readonly body: unknown) {}
}

async function agentRouteInternal(
  request: Request,
  route: string,
  scope: AgentScope | readonly AgentScope[],
  handler: AgentHandler,
) {
  if (sandboxRequested()) {
    const { sandboxAgentRoute } = await import("./sandbox/api");
    return sandboxAgentRoute(request, route, scope);
  }
  // A restart into standalone mode must also refuse an operation whose access
  // check succeeded on the previous split process. Check before any handler.
  if (route !== "GET /api/v1/access" && request.headers.has("x-booking-gateway-token") &&
      process.env.BOOKING_SERVICE_ROLE !== "salon")
    return agentErrorResponse("provider_configuration_invalid");
  if (process.env.BOOKING_SERVICE_ROLE === "salon") {
    const token = process.env.GATEWAY_SERVICE_TOKEN;
    const presented = request.headers.get("x-booking-gateway-token");
    if (!token || !/^[a-f0-9]{64}$/.test(token) || !presented ||
        !/^[a-f0-9]{64}$/.test(presented) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(presented))) {
      return agentErrorResponse("unauthorized");
    }
    // Fixture reads normally skip client auth. A split provider must require both identities.
    if (isPublicReadonly()) return readonlyForbidden();
  }
  if (isPublicReadonly()) {
    if (request.method !== "GET") return readonlyForbidden();
    const read = route === "GET /api/v1/services" ? servicesV1
      : route === "GET /api/v1/availability" ? availabilityV1 : undefined;
    if (!read) return agentErrorResponse("booking_not_found");
    try {
      const params = new URL(request.url).searchParams;
      if (!params.has("business")) params.set("business", DEMO_BUSINESS_ID);
      const preview: AgentPrincipal = {
        keyId: "fixture", clientId: "fixture", keyPrefix: "fixture",
        businessId: DEMO_BUSINESS_ID, agentName: "Synthetic preview",
        ownerName: "Fictional salon", kind: "demo-script",
        scopes: ["services:read", "availability:read"],
      };
      return NextResponse.json(await read(preview, params), { headers });
    } catch (error) {
      const { code, retryAfter } = mapAgentError(error);
      return agentErrorResponse(code, retryAfter);
    }
  }
  let principal: AgentPrincipal | null = null;
  try {
    await checkAgentAddress(request.headers, route === "POST /api/v1/proposals" ? "proposal" : route === "POST /api/v1/bookings" ? "booking" : undefined);
    principal = await authenticateAgent(request.headers, db, scope);
    await checkRateLimit("agent-api", `client:${principal.clientId}`);
    const result = await handler(principal, new URL(request.url).searchParams, request);
    const status = result instanceof Created ? 201 : 200;
    await recordAudit({ businessId: principal?.businessId as "demo" | "lab-partner" | undefined, event: "agent.request", outcome: String(status), route, clientId: principal.clientId, keyId: principal.keyId, scopes: principal.scopes });
    logUsage(route, principal, status);
    return NextResponse.json(result instanceof Created ? result.body : result, { status, headers });
  } catch (error) {
    const { code, retryAfter } = mapAgentError(error);
    await recordAudit({ businessId: principal?.businessId as "demo" | "lab-partner" | undefined, event: "agent.request", outcome: code, route, ...(principal ? { clientId: principal.clientId, keyId: principal.keyId, scopes: principal.scopes } : {}) });
    logUsage(route, principal, agentApiErrors[code].status);
    return agentErrorResponse(code, retryAfter);
  }
}

export function business(principal: AgentPrincipal, value: unknown) {
  const requested = id.safeParse(value);
  if (!requested.success) throw new AgentApiError("invalid_request");
  assertBusinessAccess(principal, requested.data);
  const found = BUSINESSES[requested.data];
  if (!found) throw new AgentApiError("business_not_found");
  return found;
}

export async function activeStaff() {
  if (isPublicReadonly()) return fixtureStaff();
  return db.staff.findMany({
    where: { businessId: DEMO_BUSINESS_ID, active: true },
    select: { id: true, name: true, serviceIds: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 100,
  });
}

export function serviceView(
  s: { id: string; name: string; duration: number; buffer: number; priceOre: number; version: number },
  staff: { id: string; name: string; serviceIds: string[] }[],
) {
  return {
    id: s.id,
    name: s.name,
    durationMinutes: s.duration,
    bufferMinutes: s.buffer,
    price: { amountMinor: s.priceOre, currency: "SEK" },
    version: s.version,
    staff: staff.filter((m) => m.serviceIds.includes(s.id)).map(({ id, name }) => ({ id, name })),
  };
}

export async function servicesV1(principal: AgentPrincipal, params: URLSearchParams) {
  const b = business(principal, params.get("business"));
  const { services, resources: staff } = await getBookingProvider(principal.businessId).listServices();
  return {
    apiVersion: API_VERSION,
    business: b,
    services: services.map((s) => serviceView(s, staff)),
  };
}

// Single-service representation reuses the same authorised catalog projection.
export async function serviceV1(principal: AgentPrincipal, params: URLSearchParams) {
  const serviceId = id.safeParse(params.get("service"));
  if (!serviceId.success) throw new AgentApiError("invalid_request");
  const catalog = await servicesV1(principal, params);
  const service = catalog.services.find(s => s.id === serviceId.data);
  if (!service) throw new AgentApiError("service_not_found");
  return { apiVersion: API_VERSION, business: catalog.business, service };
}

export function dayRange(params: URLSearchParams) {
  const date = params.get("date");
  const from = params.get("from");
  const to = params.get("to");
  if (date && (from || to)) throw new AgentApiError("invalid_request");
  const start = date ?? from;
  const end = date ?? to ?? from;
  if (!start || !end || !dateSchema.safeParse(start).success || !dateSchema.safeParse(end).success)
    throw new AgentApiError("invalid_request");
  const first = parseDay(start), last = parseDay(end);
  if (last < first) throw new AgentApiError("invalid_request");
  const days = Math.round(last.diff(first, "days").days) + 1;
  if (days > MAX_RANGE_DAYS) throw new AgentApiError("range_too_large");
  return Array.from({ length: days }, (_, i) => first.plus({ days: i }).toISODate()!);
}

export async function availabilityV1(principal: AgentPrincipal, params: URLSearchParams) {
  const b = business(principal, params.get("business"));
  return availabilityFor(b, params, getBookingProvider(principal.businessId));
}

export async function availabilityFor(
  b: ReturnType<typeof business>,
  params: URLSearchParams,
  provider: Pick<BookingProvider, "listServices" | "getAvailability">,
) {
  const serviceId = id.safeParse(params.get("service"));
  if (!serviceId.success) throw new AgentApiError("invalid_request");
  const staffParam = params.get("staff");
  const days = dayRange(params);
  const { services, resources } = await provider.listServices();
  const service = services.find((s) => s.id === serviceId.data);
  if (!service) throw new AgentApiError("service_not_found");
  const staff = resources.filter(
    (m) => m.serviceIds.includes(service.id) && (!staffParam || m.id === staffParam),
  );
  if (staffParam && !staff.length) throw new AgentApiError("staff_not_found");
  const slots = [];
  for (const day of days)
    for (const member of staff)
      for (const start of (await provider.getAvailability(service.id, day, member.id)).starts) {
        const at = DateTime.fromISO(start, { zone: ZONE });
        slots.push({
          start: at.toISO({ suppressMilliseconds: true })!,
          end: at.plus({ minutes: service.duration }).toISO({ suppressMilliseconds: true })!,
          durationMinutes: service.duration,
          serviceId: service.id,
          serviceVersion: service.version,
          staff: { id: member.id, name: member.name },
          ...placeForStaff(member.id),
        });
      }
  slots.sort((a, b) => a.start.localeCompare(b.start) || a.staff.id.localeCompare(b.staff.id));
  return {
    apiVersion: API_VERSION,
    business: b,
    service: serviceView(service, staff),
    range: { from: days[0], to: days.at(-1)!, timeZone: ZONE },
    slots,
  };
}

export const agentRoute: typeof agentRouteInternal = (...args) => auditContext(() => agentRouteInternal(...args));
