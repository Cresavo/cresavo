import { discoveryOrigin } from "../discovery";
import { BUSINESSES } from "../v1";

// OAuth 2.1 for customers' agents (ADR 7). Off unless AGENT_OAUTH=1; off is the default until the
// pilot gate. One grant is one agent client at one salon, bound to that salon's MCP resource.
export const GRANT_SCOPES = ["services:read", "availability:read", "bookings:read", "bookings:write"] as const;
export const ACCESS_SECONDS = 15 * 60;
export const REFRESH_DAYS = 30;
export const CODE_MINUTES = 5;

export function agentOAuthEnabled() {
  return process.env.AGENT_OAUTH === "1";
}
export const issuer = (origin = discoveryOrigin()) => `${origin}/agent-oauth`;
export const salonResource = (business: string, origin = discoveryOrigin()) => `${origin}/api/v1/salons/${business}/mcp`;

/** The salon a resource URL names, or null. Only salons this engine serves have a resource. */
export function resourceBusiness(resource: string, origin = discoveryOrigin()) {
  const match = /^\/api\/v1\/salons\/([a-z0-9-]{1,64})\/mcp$/.exec(resource.startsWith(origin) ? resource.slice(origin.length) : "");
  return match && BUSINESSES[match[1]] ? match[1] : null;
}
export const salonName = (business: string) => BUSINESSES[business]?.name ?? business;
