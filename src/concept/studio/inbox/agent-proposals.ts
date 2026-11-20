"use client";

import { useEffect, useState } from "react";
import { dispatchCommitted } from "../../store";
import type { AgentProposal } from "../../tools/agent-proposal";

// Proposals from outside AIs (MCP) live on the server; the studio's data lives
// in the browser. The Inbox polls the server, and an approval applies the
// change here through the normal dispatch (logged as the assistant via MCP)
// before telling the server the outcome.

const POLL_MS = 4000;
const ENDPOINT = "/api/concept/proposals";

async function fetchPending(): Promise<AgentProposal[]> {
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(`Proposals request failed with ${response.status}`);
  return ((await response.json()) as { proposals: AgentProposal[] }).proposals;
}

/**
 * Applies (or declines) one proposal here, then tells the server the outcome. The server hears
 * "approved" only once the change is saved in this browser; a refused change is reported as "failed".
 * Resolves with the log entry id of an approved change, null for a decline, or false when it was refused.
 */
export async function decideProposal(proposal: AgentProposal, approve: boolean, post: typeof fetch = fetch): Promise<string | null | false> {
  const result = approve ? await dispatchCommitted(proposal.action, { actor: "ai", source: "mcp", approvedBy: "owner" }) : null;
  const decision = !result ? "declined" : result.ok ? "approved" : "failed";
  await post(`${ENDPOINT}/${encodeURIComponent(proposal.id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  }).catch(() => undefined);
  return !result ? null : result.ok ? result.logId : false;
}

/** Pending proposals, refreshed every few seconds while the page is visible. */
export function useAgentProposals(enabled = true) {
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [decided, setDecided] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      fetchPending().then(
        (next) => active && setProposals(next),
        () => undefined,
      );
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled]);

  /** Applies or declines a proposal and resolves with the resulting log ID, if any. */
  const decide = (proposal: AgentProposal, approve: boolean) => {
    setDecided((ids) => [...ids, proposal.id]);
    return decideProposal(proposal, approve);
  };

  return { proposals: enabled ? proposals.filter((p) => !decided.includes(p.id)) : [], decide };
}
