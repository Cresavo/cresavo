import { siteRequestHost } from "../site/request-host";

export const SCOPES = ["bookings:read", "inbox:read", "bookings:propose"] as const;
export const COOKIE = "__Host-cresavo-pair";
export const PUBLIC_WRITES = new Set([
  "/api/pairing/session", "/api/pairing/decision", "/api/pairing/move",
  "/oauth/register", "/oauth/authorize", "/oauth/token", "/oauth/revoke", "/mcp/owner",
]);

export function pairingOrigin(headers: Headers) {
  if (process.env.ASSISTANT_PAIRING !== "1") return null;
  const host = siteRequestHost(name => headers.get(name));
  if (host === "demo.cresavo.com") return "https://demo.cresavo.com";
  if (process.env.NODE_ENV !== "production" && host && /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(host))
    return `http://${host}`;
  return null;
}
