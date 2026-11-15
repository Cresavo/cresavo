import { agentRoute } from "@/lib/agent-api/v1";
import { getProposal } from "@/lib/agent-api/proposals";
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return agentRoute(request, "GET /api/v1/proposals/{id}", ["bookings:read", "bookings:write"], p => getProposal(p, id));
}
