import { DISCOVERY_CACHE, discoveryOrigin } from "@/lib/agent-api/discovery";
import { conceptAgentCard } from "@/concept/server/discovery";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A2A agent card for a customer's assistant. */
export const GET = withRequestLog("/api/concept/a2a/agent-card.json", () => {
  try {
    return Response.json(conceptAgentCard(discoveryOrigin()), { headers: { "Cache-Control": DISCOVERY_CACHE } });
  } catch {
    return Response.json({ error: "DISCOVERY_CONFIG_INVALID" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
});
