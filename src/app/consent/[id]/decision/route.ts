import { customerDecision } from "@/lib/agent-api/proposals";
import { requireConsentLab } from "@/lib/agent-api/customer-identity";
import { ConsentLinkState, stagingConsentOrigin } from "@/lib/agent-api/consent-staging";
import { verifiedClientAddress } from "../../../../../scripts/client-address.mjs";
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    // Staging: the configured HTTPS consent origin, customers off loopback. Labs: loopback only.
    const staging = stagingConsentOrigin();
    const origin = staging ?? requireConsentLab();
    const client = verifiedClientAddress(request.headers, process.env.BOOKING_ADDRESS_SECRET);
    if (request.headers.has("authorization") || request.headers.has("x-api-key") ||
        request.headers.get("origin") !== origin ||
        !request.headers.get("content-type")?.startsWith("application/json") ||
        (!staging && !["127.0.0.1", "::1"].includes(client)))
      return Response.json({ error: "consent_denied" }, { status: 403, headers });
    const reader = request.body?.getReader();
    if (!reader) throw new Error("CONSENT_DENIED");
    const chunks: Uint8Array[] = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 2048) { void reader.cancel(); throw new Error("CONSENT_DENIED"); }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    const { id } = await ctx.params;
    return Response.json(await customerDecision(id, JSON.parse(text)), { headers });
  } catch (error) {
    // A spent link tells its holder why. It never carries proposal terms or authority.
    if (error instanceof ConsentLinkState)
      return Response.json({ error: "consent_denied", state: error.state }, { status: error.state === "expired" ? 410 : 409, headers });
    // Do not reflect or log bearer link material, parser errors or SQL.
    return Response.json({ error: "consent_denied" }, { status: 403, headers });
  }
}
