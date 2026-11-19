import { configuredPairingOrigin } from "../../../scripts/pairing-config.mjs";
import { siteRequestHost } from "../site/request-host";

export const BOOKING_PROPOSAL_SCOPE = "bookings:propose:v2";
const LEGACY_BOOKING_PROPOSAL_SCOPE = "bookings:propose";
export const BOOKING_MOVE_SCOPES = [BOOKING_PROPOSAL_SCOPE, LEGACY_BOOKING_PROPOSAL_SCOPE] as const;
export const SCOPES = ["bookings:read", BOOKING_PROPOSAL_SCOPE, "customers:read", "inbox:read", "inbox:propose", "catalog:read", "catalog:propose", "staff:read", "finance:read"] as const;
export const SUPPORTED_SCOPES = [...SCOPES, LEGACY_BOOKING_PROPOSAL_SCOPE] as const;
type Scope = typeof SUPPORTED_SCOPES[number];
export type ToolScope = Scope | readonly Scope[];
export const permitted = (required: ToolScope, scopes: string[]) =>
  typeof required === "string" ? scopes.includes(required) : required.some(s => scopes.includes(s));

export const COOKIE = "__Host-cresavo-pair";
export const PUBLIC_WRITES = new Set([
  "/api/pairing/session", "/api/pairing/decision", "/api/pairing/move",
  "/oauth/register", "/oauth/authorize", "/oauth/token", "/oauth/revoke", "/mcp/owner",
]);

export function pairingOrigin(headers: Headers) {
  if (process.env.ASSISTANT_PAIRING !== "1") return null;
  const origin = configuredPairingOrigin(process.env.PAIRING_ORIGIN);
  return origin && siteRequestHost(name => headers.get(name)) === new URL(origin).host ? origin : null;
}

export const pairingIssuer = (origin: string) => origin + "/oauth";
