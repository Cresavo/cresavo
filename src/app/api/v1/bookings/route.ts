import { agentRoute } from "@/lib/agent-api/v1";
import { createBookingV1 } from "@/lib/agent-api/bookings";
export function POST(request: Request) {
  return agentRoute(request, "POST /api/v1/bookings", "bookings:write", createBookingV1);
}
