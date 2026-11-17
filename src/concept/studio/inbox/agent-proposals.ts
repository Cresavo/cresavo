"use client";

import { useEffect, useState } from "react";
import { dispatch } from "../../store";
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

/** Pending proposals, refreshed every few seconds while the page is visible. */
export function useAgentProposals() {
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [decided, setDecided] = useState<string[]>([]);

  useEffect(() => {
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
  }, []);

  /** Applies (or declines) one proposal. Returns false when the change no longer fits the studio's data. */
  const decide = (proposal: AgentProposal, approve: boolean): boolean => {
    const applied = approve && dispatch(proposal.action, { actor: "ai", source: "mcp" });
    const decision = !approve ? "declined" : applied ? "approved" : "failed";
    setDecided((ids) => [...ids, proposal.id]);
    void fetch(`${ENDPOINT}/${encodeURIComponent(proposal.id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    }).catch(() => undefined);
    return !approve || applied;
  };

  return { proposals: proposals.filter((p) => !decided.includes(p.id)), decide };
}
