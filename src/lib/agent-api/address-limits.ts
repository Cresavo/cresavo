import { checkRateLimit } from "../rate-limit";
import { waitlistClientKey } from "../../concept/site/waitlist-server";

export type AgentCreate = "proposal" | "booking";

/**
 * Per client address budgets in front of agent authentication (ADR 7): 60 requests a minute, and
 * 5 proposal and 5 booking creates an hour. Unverified addresses share one bucket. In split mode the
 * gateway enforces these per client address, and every request here comes from the gateway itself.
 */
export async function checkAgentAddress(headers: Headers, create?: AgentCreate) {
  if (process.env.BOOKING_SERVICE_ROLE === "salon") return;
  const address = waitlistClientKey(headers);
  await checkRateLimit("agent-ip", address);
  if (create === "proposal") await checkRateLimit("agent-ip-proposal", address);
  if (create === "booking") await checkRateLimit("agent-ip-booking", address);
}
