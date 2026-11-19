import { configuredPairingOrigin } from "../../../scripts/pairing-config.mjs";
import { siteRequestHost } from "../site/request-host";

export const SCOPES = ["bookings:read", "bookings:propose", "customers:read", "inbox:read", "inbox:propose", "catalog:read", "catalog:propose", "staff:read", "finance:read"] as const;
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
