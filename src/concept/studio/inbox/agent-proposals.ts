"use client";

import { useEffect, useState } from "react";
import { dispatchWithLog } from "../../store";
import type { AgentProposal } from "../../tools/agent-proposal";
import { PUBLIC_DEMO } from "../../ai/api-client";
import { decisionOutbox, type AgentDecision } from "./agent-decisions";

// Proposals from outside AIs (MCP) live on the server; the studio's data lives
// in the browser. The Inbox polls the server, and an approval applies the
// change here through the normal dispatch (logged as the assistant via MCP)
// before telling the server the outcome. The decision is kept in the browser
// and sent again on each poll until the server stops listing the proposal, so
// a failed request never offers the same proposal for a second approval.

// Each poll is a server invocation. The public demo closes the concept MCP, so it
// polls rarely; a local studio still sees new proposals within seconds.
const POLL_MS = PUBLIC_DEMO ? 60_000 : 15_000;
const ENDPOINT = "/api/concept/proposals";

const outbox = decisionOutbox(() => (typeof window === "undefined" ? undefined : window.localStorage));

async function sendDecision(id: string, decision: AgentDecision) {
  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) throw new Error(`Decision request failed with ${response.status}`);
}

async function fetchPending(): Promise<AgentProposal[]> {
  const response = await fetch(ENDPOINT, { cache: "no-store" });
  if (!response.ok) throw new Error(`Proposals request failed with ${response.status}`);
  return ((await response.json()) as { proposals: AgentProposal[] }).proposals;
}

/** Pending proposals, refreshed every few seconds while the page is visible. */
export function useAgentProposals(enabled = true) {
  const [proposals, setProposals] = useState<AgentProposal[]>([]);
  const [, setDecisions] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () => {
      if (document.visibilityState !== "visible") return;
      const listedAt = Date.now();
      fetchPending().then(
        (next) => {
          if (!active) return;
          setProposals(next);
          void outbox.reconcile(next.map((p) => p.id), listedAt, sendDecision);
        },
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

  /** Applies or declines a proposal once and returns the resulting log ID, if any. */
  const decide = (proposal: AgentProposal, approve: boolean) => {
    const logId = outbox.decide(proposal.id, approve, () => dispatchWithLog(proposal.action, { actor: "ai", source: "mcp" }), sendDecision);
    setDecisions((count) => count + 1);
    return logId;
  };

  return { proposals: enabled ? outbox.undecided(proposals) : [], decide };
}
