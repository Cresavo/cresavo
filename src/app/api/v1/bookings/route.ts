import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { agentRoute } from "@/lib/agent-api/v1";
import { createBookingV1 } from "@/lib/agent-api/bookings";
export function POST(request: Request) {
  if (isPublicReadonly()) return readonlyForbidden();
  return agentRoute(request, "POST /api/v1/bookings", "bookings:write", createBookingV1);
}
