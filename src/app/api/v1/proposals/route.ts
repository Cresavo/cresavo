import { agentRoute, Created } from "@/lib/agent-api/v1";
import { createProposal } from "@/lib/agent-api/proposals";
export function POST(request: Request) {
  return agentRoute(request, "POST /api/v1/proposals", "bookings:write", async (p, _q, r) => new Created(await createProposal(p, await r.json())));
}
