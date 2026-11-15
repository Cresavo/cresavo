import { agentRoute, servicesV1 } from "@/lib/agent-api/v1";
export function GET(request: Request) {
  return agentRoute(request, "GET /api/v1/services", "services:read", servicesV1);
}
