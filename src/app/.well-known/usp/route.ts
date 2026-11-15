import { DISCOVERY_CACHE, discoveryOrigin, uspProfile } from "@/lib/agent-api/discovery";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    return Response.json(uspProfile(discoveryOrigin()), { headers: { "Cache-Control": DISCOVERY_CACHE } });
  } catch {
    return Response.json({ error: "DISCOVERY_CONFIG_INVALID" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
