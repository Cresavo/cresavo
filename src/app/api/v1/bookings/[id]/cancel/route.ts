import { agentRoute } from "@/lib/agent-api/v1";
import { cancelBookingV1 } from "@/lib/agent-api/bookings";
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return agentRoute(request, "POST /api/v1/bookings/{id}/cancel", "bookings:write", (p) => cancelBookingV1(p, id));
}
