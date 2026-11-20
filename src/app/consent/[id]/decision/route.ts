import { ZodError } from "zod";
import { customerDecision } from "@/lib/agent-api/proposals";
import { labCustomerIdentity, requireConsentLab } from "@/lib/agent-api/customer-identity";
import { timingSafeEqual } from "node:crypto";
import { ConsentLinkState, STAGING_CHANNEL, stagingConsentOrigin } from "@/lib/agent-api/consent-staging";
import { db } from "@/lib/db";
import { AgentApiError } from "@/lib/agent-api/errors";
import { DomainError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifiedClientAddress } from "../../../../../scripts/client-address.mjs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
// A definite refusal: the request was rejected before or inside the decision, nothing was committed.
class Refused extends Error {}
// The same work whether or not the proposal exists or the secret is well formed.
const ABSENT = "0".repeat(64);
function linkMatches(token: string, stored: string | null | undefined) {
  const expected = Buffer.from(/^[a-f0-9]{64}$/.test(stored ?? "") ? stored! : ABSENT, "hex");
  const given = Buffer.from(labCustomerIdentity.credentialDigest(/^[A-Za-z0-9_-]{43}$/.test(token) ? token : "x"), "hex");
  return timingSafeEqual(expected, given) && Boolean(stored) && /^[A-Za-z0-9_-]{43}$/.test(token);
}
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Staging: the configured HTTPS consent origin, customers off loopback. Labs: loopback only.
    const staging = stagingConsentOrigin();
    const origin = staging ?? requireConsentLab();
    let client: string;
    try { client = verifiedClientAddress(request.headers, process.env.BOOKING_ADDRESS_SECRET); }
    catch { throw new Refused(); }
    if (request.headers.has("authorization") || request.headers.has("x-api-key") ||
        request.headers.get("origin") !== origin ||
        !request.headers.get("content-type")?.startsWith("application/json") ||
        (!staging && !["127.0.0.1", "::1"].includes(client)))
      return Response.json({ error: "consent_denied" }, { status: 403, headers });
    const { id } = await ctx.params;
    // Per client address first, before anything else is read.
    if (staging) {
      await checkRateLimit("consent-ip", client);
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Refused();
    }
    const reader = request.body?.getReader();
    if (!reader) throw new Refused();
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 2048) { void reader.cancel(); throw new Refused(); }
      chunks.push(value);
    }
    const input: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (staging) {
      // The proposal's own budget is charged only for a holder of its link: the agent knows the
      // proposal ID, only the customer the secret. Unknown proposal and wrong secret are the same
      // refusal, and the digests are compared in constant time.
      const token = (input as { token?: unknown } | null)?.token;
      const row = await db.agentProposal.findFirst({ where: { id, consentDelivery: STAGING_CHANNEL }, select: { tokenHash: true } });
      if (!linkMatches(typeof token === "string" ? token : "", row?.tokenHash)) throw new Refused();
      await checkRateLimit("consent-proposal", id);
    }
    return Response.json(await customerDecision(id, input), { headers });
  } catch (error) {
    // A spent link tells its holder why. It never carries proposal terms or authority.
    if (error instanceof ConsentLinkState)
      return Response.json({ error: "consent_denied", state: error.state, ...(error.decision ? { decision: error.decision } : {}) },
        { status: error.state === "expired" ? 410 : 409, headers });
    if (error instanceof DomainError && error.status === 429)
      return Response.json({ error: "consent_rate_limited" }, { status: 429, headers: { ...headers, "Retry-After": String(error.retryAfter ?? 60) } });
    // Do not reflect or log bearer link material, parser errors or SQL.
    if (error instanceof Refused || error instanceof AgentApiError || error instanceof ZodError || error instanceof SyntaxError)
      return Response.json({ error: "consent_denied" }, { status: 403, headers });
    // Anything else (database, connection, audit after commit) may have happened after the
    // decision was committed: the page must not claim that nothing was approved.
    return Response.json({ error: "consent_unavailable" }, { status: 500, headers });
  }
}
