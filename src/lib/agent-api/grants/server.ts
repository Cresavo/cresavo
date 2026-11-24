import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "../../db";
import { DomainError } from "../../errors";
import { checkRateLimit } from "../../rate-limit";
import { requestLocale } from "../../locale-server";
import { readCapped, waitlistClientKey } from "../../../concept/site/waitlist-server";
import { translate, type MessageKey } from "../../../concept/i18n";
import { cleanClientName, exactRedirect, fetchDocument, secureUrl } from "../../../concept/pairing/clients";
import { PairError, requirePair } from "../../../concept/pairing/http";
import { ACCESS_SECONDS, agentOAuthEnabled, CODE_MINUTES, GRANT_SCOPES, issuer, REFRESH_DAYS, resourceBusiness, salonName, salonResource } from "./policy";
import { discoveryOrigin } from "../discovery";

type Tx = Prisma.TransactionClient;
const minute = 60_000, day = 24 * 60 * minute;
const secret = () => randomBytes(32).toString("base64url");
export const tokenDigest = (value: string) => createHash("sha256").update(`agent-oauth-v1:${value}`).digest("hex");

/** Wraps an OAuth route: off unless enabled, one address budget, static errors, never cached. */
export function oauthEndpoint(handle: (request: Request, origin: string) => Promise<Response> | Response) {
  return async (request: Request) => {
    if (!agentOAuthEnabled()) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    let response: Response;
    try {
      await checkRateLimit("agent-oauth", waitlistClientKey(request.headers));
      response = await handle(request, discoveryOrigin());
    } catch (error) {
      const [status, code] = error instanceof PairError ? [error.status, error.code]
        : error instanceof DomainError && error.status === 429 ? [429, "rate_limited"]
        : error instanceof z.ZodError || error instanceof SyntaxError ? [400, "invalid_request"]
        : [500, "server_error"];
      if (status === 500) console.error("AGENT_OAUTH_INTERNAL_ERROR");
      response = Response.json({ error: code }, { status });
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
}

async function body(request: Request, mime: string) {
  requirePair(request.headers.get("content-type")?.split(";")[0].trim() === mime, "invalid_content_type", 415);
  const raw = await readCapped(request, 16_384);
  requirePair(raw !== "too-large", "request_too_large", 413);
  return raw;
}
function fields(raw: string) {
  const values = new URLSearchParams(raw);
  requirePair([...values.keys()].length === new Set(values.keys()).size);
  return Object.fromEntries(values);
}
const scopeList = (value: string | undefined) => [...new Set((value ?? GRANT_SCOPES.join(" ")).split(" ").filter(Boolean))];

const clientMetadata = z.object({
  client_id: z.string().optional(),
  client_name: z.string().max(100).transform(cleanClientName).pipe(z.string().min(1)),
  redirect_uris: z.array(z.string().max(2048)).min(1).max(16),
  token_endpoint_auth_method: z.literal("none").optional(),
});

async function resolveClient(id: string) {
  requirePair(id.length <= 2048, "invalid_client");
  if (id.startsWith("https://")) {
    const document = clientMetadata.parse(await fetchDocument(id));
    requirePair(document.client_id === id, "invalid_client_metadata");
    return { id, name: document.client_name, redirects: document.redirect_uris, published: true };
  }
  const client = await db.agentOAuthClient.findUnique({ where: { id } });
  requirePair(client && client.expiresAt > new Date(), "invalid_client");
  return { id, name: cleanClientName(client.name), redirects: client.redirects, published: false };
}

export async function register(request: Request) {
  const document = clientMetadata.parse(JSON.parse(await body(request, "application/json")));
  document.redirect_uris.forEach(uri => secureUrl(uri, true));
  const redirects = [...new Set(document.redirect_uris)].sort();
  const id = randomUUID();
  await db.agentOAuthClient.create({ data: { id, name: document.client_name, redirects, expiresAt: new Date(Date.now() + REFRESH_DAYS * day) } });
  return Response.json({ client_id: id, client_name: document.client_name, redirect_uris: document.redirect_uris,
    token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }, { status: 201 });
}

const esc = (s: string) => s.replace(/[&<>"']/g, v => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[v]!);
function page(language: string, title: string, content: string, callbackOrigin: string) {
  return new Response(`<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;background:#f5f2ed;color:#332d30;font:17px/1.55 system-ui}main{max-width:34rem;margin:8vh auto;padding:2rem;background:#fff;border:1px solid #d8d1cb;border-radius:16px}h1{font-size:1.5rem;line-height:1.25;overflow-wrap:anywhere}p,li{overflow-wrap:anywhere}button{font:inherit;border:1px solid #69585f;border-radius:8px;padding:.55rem 1.15rem;background:#fff;margin-right:.5rem;color:#433a40;min-height:44px}button[value=allow]{background:#57434c;color:#fff}</style>
<main><h1>${esc(title)}</h1>${content}</main></html>`, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Content-Language": language, "X-Frame-Options": "DENY",
    "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' ${callbackOrigin}`,
  } });
}

/** GET: the customer's consent screen. Nothing is granted until they choose Allow. */
export async function authorize(request: Request, origin: string) {
  const q = fields(new URL(request.url).search);
  requirePair(q.response_type === "code" && q.code_challenge_method === "S256" && /^[\w-]{43}$/.test(q.code_challenge ?? ""));
  requirePair(q.client_id && q.redirect_uri && (q.state ?? "").length <= 2048);
  const business = resourceBusiness(q.resource ?? "", origin);
  requirePair(business, "invalid_target");
  const scopes = scopeList(q.scope);
  requirePair(scopes.every(s => (GRANT_SCOPES as readonly string[]).includes(s)), "invalid_scope");
  const redirect = secureUrl(q.redirect_uri, true);
  const client = await resolveClient(q.client_id);
  requirePair(exactRedirect(client.redirects, q.redirect_uri), "invalid_redirect_uri");
  const handle = secret();
  await db.agentOAuthCode.create({ data: { hash: tokenDigest(handle), consent: true, businessId: business, clientId: client.id,
    clientName: client.name, redirectUri: q.redirect_uri, challenge: q.code_challenge, scopes: scopes.join(" "),
    state: q.state ?? "", expiresAt: new Date(Date.now() + CODE_MINUTES * minute) } });
  const language = requestLocale(request);
  const text = (key: MessageKey, vars?: Record<string, string>) => translate(language, key, vars);
  return page(language, text("agentOauth.consent", { client: client.name, salon: salonName(business) }), `
<p>${esc(text(client.published ? "pair.publishedClient" : "pair.identify", { client: client.name }))}</p>
<ul>${GRANT_SCOPES.filter(s => scopes.includes(s)).map(s => `<li>${esc(text(`agentOauth.${s}`))}</li>`).join("")}</ul>
<p>${esc(text("agentOauth.privacy"))}</p><p>${esc(text("agentOauth.callback", { host: redirect.host }))}</p>
<form method="post" action="/agent-oauth/authorize"><input type="hidden" name="consent" value="${handle}">
<button name="decision" value="allow">${esc(text("pair.allow"))}</button><button name="decision" value="decline">${esc(text("pair.decline"))}</button></form>`, redirect.origin);
}

/** POST from the consent screen: same origin only, one use of the consent handle. */
export async function consent(request: Request, origin: string) {
  requirePair(request.headers.get("origin") === origin, "invalid_origin", 403);
  const q = fields(await body(request, "application/x-www-form-urlencoded"));
  requirePair(q.consent && ["allow", "decline"].includes(q.decision));
  const location = await db.$transaction(async tx => {
    const pending = await tx.agentOAuthCode.findUnique({ where: { hash: tokenDigest(q.consent) } });
    requirePair(pending?.consent && pending.expiresAt > new Date(), "invalid_consent");
    await tx.agentOAuthCode.delete({ where: { hash: pending.hash } });
    const url = new URL(pending.redirectUri);
    if (pending.state) url.searchParams.set("state", pending.state);
    if (q.decision === "allow") {
      const code = secret();
      await tx.agentOAuthCode.create({ data: { ...pending, hash: tokenDigest(code), consent: false, expiresAt: new Date(Date.now() + CODE_MINUTES * minute) } });
      url.searchParams.set("code", code);
    } else url.searchParams.set("error", "access_denied");
    url.searchParams.set("iss", issuer(origin));
    return url.href;
  });
  return new Response(null, { status: 303, headers: { Location: location } });
}

export async function revokeGrant(tx: Tx, grantId: string, now = new Date()) {
  const grant = await tx.agentGrant.findUnique({ where: { id: grantId } });
  if (!grant || grant.revokedAt) return;
  await tx.agentGrant.update({ where: { id: grantId }, data: { revokedAt: now } });
  await tx.agentApiKey.update({ where: { id: grant.keyId }, data: { revokedAt: now } });
  await tx.agentGrantToken.deleteMany({ where: { grantId } });
}

async function issue(tx: Tx, grant: { id: string; scopes: string }, now: Date) {
  const access = secret(), refresh = secret();
  await tx.agentGrantToken.create({ data: { grantId: grant.id, accessHash: tokenDigest(access), refreshHash: tokenDigest(refresh),
    expiresAt: new Date(+now + ACCESS_SECONDS * 1000), refreshExpiresAt: new Date(+now + REFRESH_DAYS * day) } });
  return { access_token: access, refresh_token: refresh, token_type: "Bearer", expires_in: ACCESS_SECONDS, scope: grant.scopes };
}

export async function token(request: Request, origin: string) {
  const q = fields(await body(request, "application/x-www-form-urlencoded"));
  requirePair(q.client_id && !request.headers.has("authorization"), "invalid_client");
  const now = new Date();
  const result = await db.$transaction(async tx => {
    if (q.grant_type === "authorization_code") {
      requirePair(q.code && q.code_verifier && q.redirect_uri, "invalid_grant");
      const hash = tokenDigest(q.code);
      const code = await tx.agentOAuthCode.findUnique({ where: { hash } });
      const verifier = /^[\w.~-]{43,128}$/.test(q.code_verifier) ? createHash("sha256").update(q.code_verifier).digest("base64url") : "";
      requirePair(code && !code.consent && code.clientId === q.client_id && code.redirectUri === q.redirect_uri &&
        verifier === code.challenge && (q.resource ?? salonResource(code.businessId, origin)) === salonResource(code.businessId, origin), "invalid_grant");
      // A second use of the same code revokes everything the first use issued.
      const prior = await tx.agentGrant.findUnique({ where: { codeHash: hash } });
      if (prior) { await revokeGrant(tx, prior.id, now); return null; }
      requirePair(code.expiresAt > now, "invalid_grant");
      const id = randomUUID(), clientId = `grant_${id}`;
      const key = await tx.agentApiKey.create({ data: {
        keyPrefix: clientId, keyHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
        scopes: code.scopes.split(" "), agentName: code.clientName, ownerName: "Customer (OAuth)",
        ownerContact: "customer-oauth", kind: "oauth-grant",
        client: { create: { id: clientId, businessId: code.businessId } },
      } });
      const grant = await tx.agentGrant.create({ data: { id, businessId: code.businessId, clientId, keyId: key.id,
        oauthClientId: code.clientId, clientName: code.clientName, scopes: code.scopes, codeHash: hash } });
      // Keep the code's digest until the refresh lifetime ends, for replay detection.
      await tx.agentOAuthCode.update({ where: { hash }, data: { expiresAt: new Date(+now + REFRESH_DAYS * day) } });
      return issue(tx, grant, now);
    }
    requirePair(q.grant_type === "refresh_token", "unsupported_grant_type");
    requirePair(q.refresh_token, "invalid_grant");
    const prior = await tx.agentGrantToken.findUnique({ where: { refreshHash: tokenDigest(q.refresh_token) }, include: { grant: true } });
    requirePair(prior && prior.grant.oauthClientId === q.client_id && !prior.grant.revokedAt, "invalid_grant");
    // Reuse of a rotated refresh token means it leaked: end the whole grant.
    if (prior.rotated) { await revokeGrant(tx, prior.grantId, now); return null; }
    requirePair(prior.refreshExpiresAt > now, "invalid_grant");
    requirePair(q.scope === undefined || scopeList(q.scope).sort().join(" ") === scopeList(prior.grant.scopes).sort().join(" "), "invalid_scope");
    await tx.agentGrantToken.update({ where: { accessHash: prior.accessHash }, data: { rotated: true, expiresAt: now } });
    return issue(tx, prior.grant, now);
  });
  requirePair(result, "invalid_grant");
  return Response.json(result);
}

/** RFC 7009: always 200, also for an unknown token. */
export async function revoke(request: Request) {
  const q = fields(await body(request, "application/x-www-form-urlencoded"));
  requirePair(q.token && q.client_id);
  const hash = tokenDigest(q.token);
  await db.$transaction(async tx => {
    const row = await tx.agentGrantToken.findFirst({ where: { OR: [{ accessHash: hash }, { refreshHash: hash }] }, include: { grant: true } });
    if (row && row.grant.oauthClientId === q.client_id) await revokeGrant(tx, row.grantId);
  });
  return new Response(null, { status: 200 });
}

export function authorizationServerMetadata(origin: string) {
  return Response.json({ issuer: issuer(origin), authorization_endpoint: `${origin}/agent-oauth/authorize`,
    token_endpoint: `${origin}/agent-oauth/token`, registration_endpoint: `${origin}/agent-oauth/register`,
    revocation_endpoint: `${origin}/agent-oauth/revoke`, response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"], scopes_supported: GRANT_SCOPES,
    client_id_metadata_document_supported: true, authorization_response_iss_parameter_supported: true });
}
export function protectedResourceMetadata(origin: string, business: string) {
  return Response.json({ resource: salonResource(business, origin), authorization_servers: [issuer(origin)],
    scopes_supported: GRANT_SCOPES, bearer_methods_supported: ["header"] });
}

/** The principal behind a customer agent's access token, or null. Revocation lives on the credential row. */
export async function grantPrincipal(accessToken: string, now = new Date()) {
  if (!agentOAuthEnabled() || !/^[\w-]{43}$/.test(accessToken)) return null;
  const row = await db.agentGrantToken.findUnique({ where: { accessHash: tokenDigest(accessToken) }, include: { grant: true } });
  if (!row || row.rotated || row.expiresAt <= now || row.grant.revokedAt) return null;
  const key = await db.agentApiKey.findUnique({ where: { id: row.grant.keyId }, include: { client: true } });
  if (!key || key.revokedAt || !key.client.active || key.clientId !== row.grant.clientId) return null;
  if (+now - +row.grant.lastUsedAt > minute) await db.agentGrant.update({ where: { id: row.grant.id }, data: { lastUsedAt: now } });
  return { keyId: key.id, clientId: key.clientId, keyPrefix: key.keyPrefix, businessId: key.businessId,
    agentName: row.grant.clientName, ownerName: key.ownerName, kind: key.kind, scopes: row.grant.scopes.split(" "), grantId: row.grant.id };
}
