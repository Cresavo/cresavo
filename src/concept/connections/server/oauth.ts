// OAuth 2.0 refresh-token grant (RFC 6749 section 6) for providers that issue
// short-lived access tokens (Google, Microsoft, Fortnox, Visma). Tokens are
// cached in memory per token URL + client + refresh token hash and never logged.
import { createHash } from "node:crypto";
import { connectionError, type ConnectionError, type PortName } from "../core";
import { basicAuth, field, form, request, text, type Fetcher } from "./http";

export interface OAuthClient {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** "body" sends client_id/client_secret as form fields (Google, Microsoft); "basic" as an Authorization header (Fortnox, Visma). */
  clientAuth: "body" | "basic";
  scope?: string;
}

const cache = new Map<string, { token: string; expiresAt: number }>();
// Rotated refresh tokens, by the configured one. Kept in memory only: a restart falls back to the configured
// token, which a rotating provider (Fortnox, Visma) has invalidated. TODO(goal 11): persist in the secret store.
const rotated = new Map<string, string>();
const keyOf = (client: OAuthClient) => createHash("sha256").update(`${client.tokenUrl}\n${client.clientId}\n${client.refreshToken}`).digest("hex");

export function clearTokenCache() {
  cache.clear();
  rotated.clear();
}

export async function accessToken(client: OAuthClient, port: PortName, provider: string, fetcher: Fetcher, now = Date.now()): Promise<{ ok: true; token: string } | { ok: false; error: ConnectionError }> {
  const key = keyOf(client);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now + 60_000) return { ok: true, token: cached.token };
  const refreshToken = rotated.get(key) ?? client.refreshToken;
  const body = form({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    ...(client.clientAuth === "body" ? { client_id: client.clientId, client_secret: client.clientSecret } : {}),
    scope: client.scope,
  });
  const result = await request({ port, provider, fetch: fetcher, secrets: [client.clientSecret, client.refreshToken, refreshToken] }, client.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...(client.clientAuth === "basic" ? { Authorization: basicAuth(client.clientId, client.clientSecret) } : {}) },
    body,
  }, (data) => (field(data, "error") === "invalid_grant" ? { code: "unauthorized", providerCode: "invalid_grant" } : { providerCode: field(data, "error") }));
  if (!result.ok) return result;
  const token = text(field(result.data, "access_token"));
  const expiresIn = Number(field(result.data, "expires_in"));
  if (!token) return { ok: false, error: connectionError(port, provider, "unknown") };
  const next = text(field(result.data, "refresh_token"));
  if (next && next !== refreshToken) rotated.set(key, next);
  cache.set(key, { token, expiresAt: now + (Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 300) * 1000 });
  return { ok: true, token };
}
