import { createHash } from "node:crypto";
import { db } from "../../src/lib/db";
import { POST as register } from "../../src/app/agent-oauth/register/route";
import { GET as authorize, POST as consent } from "../../src/app/agent-oauth/authorize/route";
import { POST as token } from "../../src/app/agent-oauth/token/route";
import { labRequest, origin } from "./lab-request";

// A customer agent's OAuth access token for one salon, through the real register, consent and token
// endpoints. Callers stub AGENT_OAUTH=1, BOOKING_PUBLIC_ORIGIN=origin and the lab address secret.
const redirect = "http://127.0.0.1:4555/callback";
const verifier = "g".repeat(43);
const form = (values: Record<string, string>) => ({ method: "POST", body: new URLSearchParams(values).toString(),
  headers: { "content-type": "application/x-www-form-urlencoded", origin } });

export async function grantToken(business: string, scopes: string[]) {
  const registered = await register(labRequest(`${origin}/agent-oauth/register`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: "Synthetic grant test agent", redirect_uris: [redirect] }) }));
  const { client_id: clientId } = await registered.json();
  const page = await authorize(labRequest(`${origin}/agent-oauth/authorize?${new URLSearchParams({ response_type: "code", client_id: clientId,
    redirect_uri: redirect, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    resource: `${origin}/api/v1/salons/${business}/mcp`, scope: scopes.join(" ") })}`));
  const handle = /name="consent" value="([\w-]{43})"/.exec(await page.text())![1];
  const allowed = await consent(labRequest(`${origin}/agent-oauth/authorize`, form({ consent: handle, decision: "allow" })));
  const code = new URL(allowed.headers.get("location")!).searchParams.get("code")!;
  const issued = await token(labRequest(`${origin}/agent-oauth/token`, form({ grant_type: "authorization_code", client_id: clientId,
    code, code_verifier: verifier, redirect_uri: redirect })));
  const { access_token: accessToken } = await issued.json();
  if (!accessToken) throw new Error("SYNTHETIC_GRANT_FAILED");
  return { accessToken: accessToken as string, oauthClientId: clientId as string };
}

/** Removes the grants, their credential rows and agent clients for these OAuth clients. Audit rows stay (append-only). */
export async function deleteGrants(oauthClientIds: string[]) {
  const grants = await db.agentGrant.findMany({ where: { oauthClientId: { in: oauthClientIds } } });
  const keys = grants.map(g => g.keyId), clients = grants.map(g => g.clientId);
  await db.agentGrantToken.deleteMany({ where: { grantId: { in: grants.map(g => g.id) } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: keys } } });
  await db.agentGrant.deleteMany({ where: { id: { in: grants.map(g => g.id) } } });
  await db.agentApiKey.deleteMany({ where: { id: { in: keys } } });
  return clients;
}
