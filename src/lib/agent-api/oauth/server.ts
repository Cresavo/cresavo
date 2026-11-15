import { auditContext, recordAudit } from "../audit";
import { createHash, generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { z } from "zod";
import { discoveryOrigin } from "../discovery";
import { AGENT_SCOPES } from "../keys";
import { verifiedClientAddress } from "../../../../scripts/client-address.mjs";
import { assertTestDatabase } from "../../../../scripts/test-db-guard.mjs";

const headers = { "Cache-Control": "no-store", Pragma: "no-cache", "Referrer-Policy": "no-referrer" };
const loopback = (host: string) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
const hash = (value: string) => createHash("sha256").update(value).digest("base64url");
const random = () => randomBytes(32).toString("base64url");
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
class OAuthError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}
const fail = (code: string, status = 400): never => { throw new OAuthError(code, status); };
type Client = { redirect_uris: string[]; scope: string; expires: number };
type Code = { client: string; redirect: string; resource: string; scope: string; challenge: string; expires: number };
function createState() {
  return { clients: new Map<string, Client>(), codes: new Map<string, Code>(), key: generateKeyPairSync("ed25519") };
}
// Shared across route bundles in ONE lab process. Never a production store.
const globalState = globalThis as typeof globalThis & { bookingOAuthLab?: ReturnType<typeof createState> };
function state() { return globalState.bookingOAuthLab ??= createState(); }
function lab(origin: string, request: Request) {
  if (process.env.BOOKING_OAUTH_LAB !== "1" || process.env.BOOKING_RUNTIME === "vercel" || !loopback(new URL(origin).hostname))
    fail("temporarily_unavailable", 503);
  assertTestDatabase();
  verifiedClientAddress(request.headers, process.env.BOOKING_ADDRESS_SECRET);
  if (!["127.0.0.1", "::1"].includes(request.headers.get("x-booking-client-ip") ?? "")) fail("access_denied", 403);
}
function clean() {
  const s = state();
  for (const [id, row] of s.clients) if (row.expires <= Date.now()) s.clients.delete(id);
  for (const [id, row] of s.codes) if (row.expires <= Date.now()) s.codes.delete(id);
  return s;
}
function scopes(value: string) {
  const values = [...new Set(value.split(" ").filter(Boolean))];
  if (!values.length || values.some(v => !(AGENT_SCOPES as readonly string[]).includes(v))) fail("invalid_scope");
  return values.join(" ");
}
function params(value: URLSearchParams) {
  if ([...value.keys()].some(k => value.getAll(k).length !== 1)) fail("invalid_request");
  return value;
}
async function body(request: Request) {
  // Bound the stream before parsing; never echo input or parser errors.
  const reader = request.body?.getReader();
  if (!reader) return fail("invalid_request");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 8192) { await reader.cancel(); return fail("invalid_request"); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function metadata(kind: "resource" | "server") {
  try {
    const origin = discoveryOrigin();
    return json(kind === "resource" ? {
      resource: `${origin}/api/v1/mcp`, authorization_servers: [origin], scopes_supported: AGENT_SCOPES,
      bearer_methods_supported: ["header"],
    } : {
      issuer: origin, authorization_endpoint: `${origin}/authorize`, token_endpoint: `${origin}/token`,
      registration_endpoint: `${origin}/register`, code_challenge_methods_supported: ["S256"],
      response_types_supported: ["code"], grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"], scopes_supported: AGENT_SCOPES,
    });
  } catch { return json({ error: "temporarily_unavailable" }, 503); }
}
const registration = z.object({
  redirect_uris: z.array(z.string().max(2048).refine(value => {
    try { const u = new URL(value); return !u.username && !u.password && !u.hash &&
      (u.protocol === "https:" || (u.protocol === "http:" && loopback(u.hostname))); } catch { return false; }
  })).min(1).max(10),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z.array(z.literal("authorization_code")).length(1).default(["authorization_code"]),
  response_types: z.array(z.literal("code")).length(1).default(["code"]),
  scope: z.string().max(256).default("services:read availability:read"),
});
async function oauthInternal(request: Request, action: "register" | "authorize" | "token") {
  let response: Response;
  let auditClient: string | undefined;
  let auditScopes: string[] = [];
  try {
    const origin = discoveryOrigin(); lab(origin, request);
    const s = clean(); const resource = `${origin}/api/v1/mcp`;
    if (action === "register") {
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") fail("invalid_client_metadata");
      const parsed = registration.safeParse(JSON.parse(await body(request)));
      if (!parsed.success) return fail("invalid_client_metadata");
      if (s.clients.size >= 1000) fail("temporarily_unavailable", 503);
      const data = parsed.data; const scope = scopes(data.scope); const id = random();
      auditClient = id; auditScopes = scope.split(" ");
      s.clients.set(id, { redirect_uris: data.redirect_uris, scope, expires: Date.now() + 86400000 });
      response = json({ ...data, scope, client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000) }, 201);
    } else {
      if (request.url.length > 8192) fail("invalid_request");
      const p = params(action === "authorize" ? new URL(request.url).searchParams :
        request.headers.get("content-type")?.split(";")[0] === "application/x-www-form-urlencoded" ?
          new URLSearchParams(await body(request)) : fail("invalid_request"));
      const clientId = p.get("client_id") ?? ""; const client = s.clients.get(clientId);
      if (!client) fail("invalid_client");
      auditClient = clientId;
      if (p.get("resource") !== resource) fail("invalid_target");
      const redirect = p.get("redirect_uri") ?? "";
      if (!client!.redirect_uris.includes(redirect)) fail("invalid_request");
      if (action === "authorize") {
        const challenge = p.get("code_challenge") ?? "";
        if (p.get("response_type") !== "code") fail("unsupported_response_type");
        if (p.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) fail("invalid_request");
        const scope = scopes(p.get("scope") ?? client!.scope);
        if (scope.split(" ").some(v => !client!.scope.split(" ").includes(v))) fail("invalid_scope");
        if (s.codes.size >= 1000) fail("temporarily_unavailable", 503);
        // Operator explicitly enables automatic SYNTHETIC approval on isolated loopback only.
        auditScopes = scope.split(" ");
        const code = random();
        s.codes.set(hash(code), { client: clientId, redirect, resource, scope, challenge, expires: Date.now() + 60000 });
        const target = new URL(redirect); target.searchParams.set("code", code);
        if (p.has("state")) target.searchParams.set("state", p.get("state")!);
        target.searchParams.set("iss", origin);
        response = new Response(null, { status: 302, headers: { ...headers, Location: target.href } });
      } else {
        if (p.get("grant_type") !== "authorization_code") fail("unsupported_grant_type");
        const key = hash(p.get("code") ?? ""); const code = s.codes.get(key);
        const verifier = p.get("code_verifier") ?? "";
        if (!code || code.expires <= Date.now() || code.client !== clientId || code.redirect !== redirect || code.resource !== resource ||
          !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || hash(verifier) !== code.challenge) fail("invalid_grant");
        // No await between validation and consumption: atomic within this single process.
        auditScopes = code!.scope.split(" ");
        s.codes.delete(key);
        const now = Math.floor(Date.now() / 1000);
        const head = Buffer.from(JSON.stringify({ alg: "EdDSA", typ: "at+jwt" })).toString("base64url");
        const payload = Buffer.from(JSON.stringify({ iss: origin, sub: clientId, client_id: clientId, aud: resource,
          scope: code!.scope, iat: now, exp: now + 300, jti: random() })).toString("base64url");
        const input = `${head}.${payload}`;
        const token = `${input}.${sign(null, Buffer.from(input), s.key.privateKey).toString("base64url")}`;
        response = json({ access_token: token, token_type: "Bearer", expires_in: 300, scope: code!.scope });
      }
    }
  } catch (e) {
    response = json({ error: e instanceof OAuthError ? e.code : e instanceof SyntaxError ? "invalid_request" : "temporarily_unavailable" },
      e instanceof OAuthError ? e.status : e instanceof SyntaxError ? 400 : 503);
  }
  try {
  assertTestDatabase();
  await recordAudit({ event: action === "register" ? (response.status === 201 ? "oauth.client_registered" : "oauth.register_denied") : action === "authorize" ? (response.status === 302 ? "oauth.authorize_granted" : "oauth.authorize_denied") : (response.status === 200 ? "oauth.token_issued" : "oauth.token_denied"), outcome: String(response.status), route: action, clientId: auditClient, scopes: auditScopes });
  } catch { console.error("AGENT_AUDIT_WRITE_FAILED"); }
  console.info(JSON.stringify({ event: "oauth_lab_request", route: action, status: response.status }));
  return response;
}

/** Only tokens issued by this opt-in, process-local lab are trusted. */
export function verifyLabAccessToken(token: string, now: Date) {
  try {
    const origin = discoveryOrigin();
    if (process.env.BOOKING_OAUTH_LAB !== "1" || process.env.BOOKING_RUNTIME === "vercel" ||
        !loopback(new URL(origin).hostname)) return null;
    assertTestDatabase();
    const s = globalState.bookingOAuthLab;
    if (!s || token.length > 8192) return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return null;
    const [h, p, signature] = parts;
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    if (header.typ !== "at+jwt" || header.alg !== "EdDSA" || header.kid !== undefined || header.crit !== undefined ||
        !verify(null, Buffer.from(`${h}.${p}`), s.key.publicKey, Buffer.from(signature, "base64url"))) return null;
    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    if (claims.iss !== origin || claims.aud !== `${origin}/api/v1/mcp` ||
        !Number.isSafeInteger(claims.exp) || claims.exp <= now.getTime() / 1000 ||
        !Number.isSafeInteger(claims.iat) || claims.iat > now.getTime() / 1000 ||
        typeof claims.jti !== "string" || !claims.jti ||
        typeof claims.client_id !== "string" || claims.sub !== claims.client_id) return null;
    const registered = s.clients.get(claims.client_id);
    if (!registered || registered.expires <= now.getTime() || typeof claims.scope !== "string") return null;
    const granted: string[] = claims.scope === "" ? [] : claims.scope.split(" ");
    if (granted.some(v => !(AGENT_SCOPES as readonly string[]).includes(v) || !registered.scope.split(" ").includes(v))) return null;
    return { clientId: claims.client_id as string, scopes: [...new Set(granted)], registeredScopes: registered.scope.split(" ") };
  } catch { return null; }
}

export const oauth: typeof oauthInternal = (...args) => auditContext(() => oauthInternal(...args));
