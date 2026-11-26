import { oauthEndpoint, protectedResourceMetadata } from "@/lib/agent-api/grants/server";
import { BUSINESSES } from "@/lib/agent-api/v1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ business: string }> }) {
  const { business } = await ctx.params;
  if (!Object.hasOwn(BUSINESSES, business)) return new Response(null, { status: 404 });
  return oauthEndpoint((_request, origin) => protectedResourceMetadata(origin, business))(request);
}
