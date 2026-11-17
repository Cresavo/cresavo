import { randomUUID } from "node:crypto";
import { createDemoState } from "../data/generate";
import type { DemoState } from "../data/types";
import { applyAction } from "../log/capture";
import type { AgentClient, AgentProposal } from "../tools/agent-proposal";
import { salonClock } from "../tools/clock";
import type { ChangeDraft, ToolContext } from "../tools/define";

// The demo business as outside AIs see it. The studio keeps its own copy in
// the browser; this one lives in server memory (per process, lost on restart)
// and is generated from the same deterministic data, so ids match. Proposals
// from agents wait here until the owner decides in the studio, which applies
// the change to the browser copy and, on approval, to this one too.

const MAX_PROPOSALS = 50;

interface DemoBusiness {
  state: DemoState;
  proposals: AgentProposal[];
  /** Idempotency key (per caller) to the proposal it created and what was asked. */
  keys: Map<string, { fingerprint: string; proposalId: string }>;
}

const holder = globalThis as typeof globalThis & { flerdoConceptBusiness?: DemoBusiness };

function fresh(today: string): DemoBusiness {
  return { state: createDemoState(today), proposals: [], keys: new Map() };
}

/** The business for today; a new day starts over, like the studio does. */
function business(now = new Date()): DemoBusiness {
  const { today } = salonClock(now);
  if (holder.flerdoConceptBusiness?.state.generatedFor !== today) holder.flerdoConceptBusiness = fresh(today);
  return holder.flerdoConceptBusiness;
}

export function toolContext(now = new Date()): ToolContext {
  return { state: business(now).state, clock: salonClock(now) };
}

/** Back to freshly generated data with no proposals. */
export function resetDemoBusiness(now = new Date()) {
  holder.flerdoConceptBusiness = fresh(salonClock(now).today);
}

export type CreateResult = { proposal: AgentProposal; replayed: boolean } | { conflict: true };

/**
 * Stores a draft as a pending proposal. The same idempotency key with the same
 * request returns the first proposal without drafting again; with a different
 * request it is a conflict. `draft` may throw a ToolError, which stores nothing.
 */
export function createProposal(input: { caller: string; key: string; tool: string; client: AgentClient; fingerprint: string; draft: () => ChangeDraft }, now = Date.now()): CreateResult {
  const current = business(new Date(now));
  const scoped = `${input.caller}:${input.key}`;
  const known = current.keys.get(scoped);
  if (known) {
    const proposal = current.proposals.find((p) => p.id === known.proposalId);
    if (known.fingerprint !== input.fingerprint) return { conflict: true };
    if (proposal) return { proposal, replayed: true };
  }
  const proposal: AgentProposal = { ...input.draft(), id: `ap-${randomUUID()}`, tool: input.tool, client: input.client, createdAt: now, status: "pending" };
  current.proposals = [proposal, ...current.proposals].slice(0, MAX_PROPOSALS);
  current.keys.set(scoped, { fingerprint: input.fingerprint, proposalId: proposal.id });
  return { proposal, replayed: false };
}

export function findProposal(id: string): AgentProposal | undefined {
  return business().proposals.find((p) => p.id === id);
}

export function pendingProposals(): AgentProposal[] {
  return business().proposals.filter((p) => p.status === "pending");
}

/**
 * Records the owner's decision. An approval also applies the change to the
 * server copy, logged as the assistant via MCP. "failed" means the studio
 * could not apply it (its own data had moved on).
 */
export function decideProposal(id: string, decision: "approved" | "declined" | "failed", now = Date.now()): AgentProposal | undefined {
  const current = business(new Date(now));
  const proposal = current.proposals.find((p) => p.id === id);
  if (!proposal || proposal.status !== "pending") return undefined;
  if (decision === "approved") current.state = applyAction(current.state, proposal.action, { actor: "ai", source: "mcp", at: now });
  const decided: AgentProposal = { ...proposal, status: decision, decidedAt: now };
  current.proposals = current.proposals.map((p) => (p.id === id ? decided : p));
  return decided;
}
