import { handleMcp } from "@/lib/agent-api/mcp";
// The standalone gateway owns the MCP transport in split installations.
// Existing standalone salon installations retain their original entry point.
function endpoint(request: Request) {
  if (process.env.BOOKING_SERVICE_ROLE === "salon") return new Response(null, { status: 404 });
  return handleMcp(request);
}
export const POST = endpoint;
export const GET = endpoint;
export const DELETE = endpoint;
