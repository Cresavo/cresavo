import { DISCOVERY_CACHE, discoveryOrigin } from "@/lib/agent-api/discovery";
import { conceptUspProfile } from "@/concept/server/discovery";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** USP discovery profile for the demo business. */
export const GET = withRequestLog("/api/concept/usp", () => {
  try {
    return Response.json(conceptUspProfile(discoveryOrigin()), { headers: { "Cache-Control": DISCOVERY_CACHE } });
  } catch {
    return Response.json({ error: "DISCOVERY_CONFIG_INVALID" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
});
