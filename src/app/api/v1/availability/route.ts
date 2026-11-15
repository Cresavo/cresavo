import { agentRoute, availabilityV1 } from "@/lib/agent-api/v1";
export function GET(request: Request) {
  return agentRoute(request, "GET /api/v1/availability", "availability:read", availabilityV1);
}
