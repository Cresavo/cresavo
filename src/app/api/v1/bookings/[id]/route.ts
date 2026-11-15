import { agentRoute } from "@/lib/agent-api/v1";
import { getBookingV1 } from "@/lib/agent-api/bookings";
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return agentRoute(request, "GET /api/v1/bookings/{id}", "bookings:read", (p) => getBookingV1(p, id));
}
