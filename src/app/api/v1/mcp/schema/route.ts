import { nativeMcpSchema } from "@/lib/agent-api/mcp-inputs";
export function GET() {
  return Response.json(nativeMcpSchema(), { headers: { "Cache-Control": "public, max-age=60" } });
}
