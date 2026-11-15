import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { nativeMcpSchema } from "@/lib/agent-api/mcp-inputs";
export function GET() {
  if (process.env.BOOKING_SERVICE_ROLE === "salon") return new Response(null, { status: 404 });
  if (isPublicReadonly()) return readonlyForbidden();
  return Response.json(nativeMcpSchema(), { headers: { "Cache-Control": "public, max-age=60" } });
}
