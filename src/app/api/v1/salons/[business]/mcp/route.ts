import { handleMcp } from "@/lib/agent-api/mcp";
import { agentOAuthEnabled } from "@/lib/agent-api/grants/policy";
import { BUSINESSES } from "@/lib/agent-api/v1";
import { discoveryOrigin } from "@/lib/agent-api/discovery";

// One salon's MCP resource for customers' agents (ADR 7). Only OAuth grants for this salon pass.
async function endpoint(request: Request, ctx: { params: Promise<{ business: string }> }) {
  const { business } = await ctx.params;
  if (!agentOAuthEnabled() || process.env.BOOKING_SERVICE_ROLE === "salon" || !Object.hasOwn(BUSINESSES, business))
    return new Response(null, { status: 404 });
  const response = await handleMcp(request, business);
  if (response.status === 401) response.headers.set("WWW-Authenticate",
    `Bearer resource_metadata="${discoveryOrigin()}/.well-known/oauth-protected-resource/api/v1/salons/${business}/mcp"`);
  return response;
}
export const POST = endpoint;
export const GET = endpoint;
export const DELETE = endpoint;
