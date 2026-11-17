import type { ChangeDraft } from "./define";

// A change proposed by an outside AI through a write tool. It waits in the
// owner's inbox until approved or declined; nothing is applied before that.

/** Which kind of assistant asked, as far as its User-Agent tells. */
export type AgentClient = "claude" | "chatgpt" | "agent";

export type ProposalStatus = "pending" | "approved" | "declined" | "failed";

export interface AgentProposal extends ChangeDraft {
  id: string;
  tool: string;
  client: AgentClient;
  /** Epoch milliseconds. */
  createdAt: number;
  status: ProposalStatus;
  decidedAt?: number;
}

/** Claude, ChatGPT or "an agent", from the caller's User-Agent header. */
export function clientFromUserAgent(userAgent: string | null): AgentClient {
  if (!userAgent) return "agent";
  if (/claude|anthropic/i.test(userAgent)) return "claude";
  if (/openai|chatgpt/i.test(userAgent)) return "chatgpt";
  return "agent";
}
