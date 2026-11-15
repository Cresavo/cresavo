import { DISCOVERY_CACHE, discoveryOrigin, llmsText } from "@/lib/agent-api/discovery";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    return new Response(llmsText(discoveryOrigin()), { headers: {
      "Content-Type": "text/plain; charset=utf-8", "Cache-Control": DISCOVERY_CACHE,
    } });
  } catch {
    return new Response("DISCOVERY_CONFIG_INVALID", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
