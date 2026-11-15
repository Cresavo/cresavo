import { agentRoute } from "@/lib/agent-api/v1";

// Discovery and MCP handshakes require an active client, even with no tool call.
export function GET(request: Request) {
  return agentRoute(request, "GET /api/v1/access",
    ["services:read", "availability:read", "bookings:read", "bookings:write"],
    async principal => ({
      apiVersion: "v1", scopes: principal.scopes,
      // agentRoute has already checked both credentials in split mode.
      providerMode: process.env.BOOKING_SERVICE_ROLE === "salon" ? "split" : "standalone",
    }));
}
