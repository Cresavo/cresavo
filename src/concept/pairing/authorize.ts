import { BRAND } from "../brand";
import { t } from "../i18n";
import { cleanClientName, exactRedirect, resolveClient, secureUrl } from "./clients";
import { pairingDb } from "./db";
import { body, budget, digest, minute, ownerHash, PairError, params, requirePair, sameOrigin, secret } from "./http";
import { pairingIssuer, SCOPES, SUPPORTED_SCOPES } from "./policy";
import { owner } from "./workspace";

const esc = (s: string) => s.replace(/[&<>"']/g, v => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[v]!);
function page(title: string, content: string, callbackOrigin = "") {
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="referrer" content="strict-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>
body { margin: 0; background: #f5f2ed; color: #332d30; font: 17px/1.55 system-ui; }
main { max-width: 34rem; margin: 8vh auto; padding: 2rem; background: white; border: 1px solid #d8d1cb; border-radius: 16px; }
h1 { font-size: 1.65rem; line-height: 1.25; overflow-wrap: anywhere; }
img { width: 125px; }
button, a { font: inherit; }
button { border: 1px solid #69585f; border-radius: 8px; padding: .55rem 1.15rem; background: white; margin-right: .5rem; color: #433a40; }
button[value=allow] { background: #57434c; color: white; }
p { overflow-wrap: anywhere; }
</style>
<main><img src="/brand/studio-wordmark.svg" alt="${esc(BRAND.name)}"><h1>${esc(title)}</h1>${content}</main></html>`, { headers: {
    "Content-Type": "text/html; charset=utf-8", "X-Frame-Options": "DENY",
    "Content-Security-Policy": `default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' ${callbackOrigin}`,
  } });
}
export async function authorize(request: Request, origin: string) {
  const db = pairingDb();
  try {
    await db.$transaction(async tx => {
      const w = await owner(tx, request);
      await budget(tx, "consent:" + w.id, 20, minute);
    });
  } catch (err) {
    if (!(err instanceof PairError) || err.status !== 401) throw err;
    return page(t("pair.startFirst"), `<a href="/studio/more/data">${esc(t("pair.studio"))}</a>`);
  }
  const q = params(new URL(request.url).search);
  requirePair(q.response_type === "code" && q.code_challenge_method === "S256" && /^[\w-]{43}$/.test(q.code_challenge ?? ""));
  requirePair(q.client_id?.length <= 2048 && q.redirect_uri && (q.state ?? "").length <= 2048);
  const resource = origin + "/mcp/owner";
  requirePair((q.resource ?? resource) === resource, "invalid_target");
  const scopes = (q.scope ?? SCOPES.join(" ")).split(" ");
  requirePair(scopes.length && scopes.every(s => SUPPORTED_SCOPES.some(scope => s === scope)), "invalid_scope");
  const redirect = secureUrl(q.redirect_uri, true);
  const client = await resolveClient(q.client_id);
  requirePair(exactRedirect(client.redirects, q.redirect_uri), "invalid_redirect_uri");
  const handle = secret();
  await db.$transaction(async tx => {
    const w = await owner(tx, request);
    await tx.pairCode.create({ data: {
      hash: digest(handle), consent: true, workspaceId: w.id, clientId: client.id, clientName: client.name,
      redirectUri: q.redirect_uri, challenge: q.code_challenge, scopes: [...new Set(scopes)].join(" "),
      state: q.state ?? "", audience: resource, expiresAt: new Date(Date.now() + 5 * minute),
    } });
  });
  return page(t("pair.consent", { host: redirect.host }), `
<p>${esc(t(client.id.startsWith("https://") ? "pair.publishedClient" : "pair.identify", { client: cleanClientName(client.name) }))}</p>
<ul>${SUPPORTED_SCOPES.filter(s => scopes.includes(s)).map(s => "<li>" + esc(t(`pair.${s}`)) + "</li>").join("")}</ul>
<p>${esc(t("pair.privacy"))}</p>
<form method="post" action="/oauth/authorize"><input type="hidden" name="consent" value="${handle}">
<button name="decision" value="allow">${esc(t("pair.allow"))}</button><button name="decision" value="decline">${esc(t("pair.decline"))}</button></form>`, redirect.origin);
}

export async function consent(request: Request, origin: string) {
  sameOrigin(request, origin);
  const q = params(await body(request, "application/x-www-form-urlencoded"));
  requirePair(ownerHash(request) && q.consent && ["allow", "decline"].includes(q.decision));
  const callback = await pairingDb().$transaction(async tx => {
    const w = await owner(tx, request);
    const record = await tx.pairCode.findUnique({ where: { hash: digest(q.consent) } });
    requirePair(record?.consent && record.workspaceId === w.id && record.expiresAt > new Date(), "invalid_consent");
    const url = new URL(record.redirectUri);
    if (record.state) url.searchParams.set("state", record.state);
    await tx.pairCode.delete({ where: { hash: record.hash } });
    if (q.decision === "allow") {
      const code = secret();
      await tx.pairCode.create({ data: { ...record, hash: digest(code), consent: false, expiresAt: new Date(Date.now() + 5 * minute) } });
      url.searchParams.set("code", code);
    } else url.searchParams.set("error", "access_denied");
    url.searchParams.set("iss", pairingIssuer(origin));
    return url.href;
  });
  return new Response(null, { status: 303, headers: { Location: callback } });
}
