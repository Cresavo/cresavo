import type { DemoAction } from "../actions";
import { DEMO_CHANNEL_CURRENCY, withDemoChannels } from "../connections/demo";
import { channelLedger } from "../connections/simulated/adapters";
import { createOutbox } from "../connections/simulated/outbox";
import type { DemoState } from "../data/types";
import type { AgentClient, AgentProposal } from "../tools/agent-proposal";

// Changes an assistant proposes and the owner decides, kept in the salon's own
// state so every store gets the same rules. Creating one checks that its change
// could apply now. Approving runs the change in the same commit as the decision,
// so a change is never applied without its approval being recorded, nor the
// reverse. A change that can no longer apply is recorded as failed. Replaying a
// retried request is the store's job (its idempotency keys), not this list's.

/** Store actions an assistant may propose. Owner-only settings, payments, erasure and access changes are never proposable. */
export const PROPOSABLE_TYPES = [
  "booking/create", "booking/move", "booking/cancel", "customers/message", "inbox/reply",
  "service/price", "service/visibility", "staff/block", "stock/order",
] as const satisfies readonly DemoAction["type"][];

/** A pending proposal the owner has not decided after this long expires. */
export const PROPOSAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** New proposals are refused while this many are pending, so a runaway assistant cannot flood the Inbox. */
export const MAX_PENDING_PROPOSALS = 50;
/** Decided proposals kept for display; the oldest decided ones go first, pending ones never. */
export const MAX_KEPT_PROPOSALS = 100;

const MAX_TEXT = 300;
const MAX_ROWS = 20;
const CLIENTS: readonly AgentClient[] = ["claude", "chatgpt", "agent"];
const TOOL = /^[a-z][a-z0-9_]{0,63}$/;

/** What the caller supplies; the reducer adds the id, times and status. */
export type NewProposal = Omit<AgentProposal, "id" | "createdAt" | "status" | "decidedAt">;

export interface StoredProposal extends AgentProposal {
  /** Epoch milliseconds. */
  expiresAt: number;
}

export type ProposalAction =
  | { type: "proposal/create"; proposal: NewProposal }
  | { type: "proposal/decide"; id: string; approve: boolean };

/** Runs a store action against a state and returns the result, the same state when refused. */
type Run = (state: DemoState, action: DemoAction) => DemoState;

const proposable = new Set<string>(PROPOSABLE_TYPES);
const text = (value: unknown, required = true) =>
  (value === undefined && !required) || (typeof value === "string" && value.length <= MAX_TEXT && (!required || value.trim().length > 0));

function validProposal(input: NewProposal): boolean {
  const { action, rows } = input;
  return !!action && typeof action === "object" && proposable.has(action.type) &&
    text(input.title) && text(input.subtitle, false) && text(input.toast) &&
    (input.destructive === undefined || typeof input.destructive === "boolean") &&
    typeof input.tool === "string" && TOOL.test(input.tool) && CLIENTS.includes(input.client) &&
    Array.isArray(rows) && rows.length <= MAX_ROWS && rows.every((row) => !!row && text(row.label) && text(row.after) && text(row.before, false));
}

const scratch = () => channelLedger(createOutbox(), DEMO_CHANNEL_CURRENCY).stage();

/**
 * True when `run` changes `state`. It runs with throwaway channels that are
 * never published, so a check never sends a message or takes a payment,
 * whatever channels the store has staged around it.
 */
export function dryRun(state: DemoState, run: (payments: ReturnType<typeof scratch>["payments"]) => DemoState): boolean {
  const channels = scratch();
  return withDemoChannels(channels, () => run(channels.payments)) !== state;
}

export const proposalsOf = (state: DemoState): StoredProposal[] => state.proposals ?? [];

/** Proposals waiting for the owner, newest first; expired ones are left out. */
export const pendingProposals = (state: DemoState, now: number) =>
  proposalsOf(state).filter((proposal) => proposal.status === "pending" && proposal.expiresAt > now);

/** Keeps every pending proposal and the newest decided ones, up to `MAX_KEPT_PROPOSALS` in all. */
function prune(list: StoredProposal[]): StoredProposal[] {
  let room = Math.max(0, MAX_KEPT_PROPOSALS - list.filter((p) => p.status === "pending").length);
  return list.filter((p) => p.status === "pending" || room-- > 0);
}

/** Stores a valid proposal whose change could apply now. Anything else leaves the state as it was. */
export function createProposal(state: DemoState, input: NewProposal, now: number, wouldApply: (state: DemoState, action: DemoAction) => boolean): DemoState {
  if (!input || typeof input !== "object" || !validProposal(input)) return state;
  if (pendingProposals(state, now).length >= MAX_PENDING_PROPOSALS) return state;
  if (!wouldApply(state, input.action)) return state;
  const { title, subtitle, rows, action, toast, destructive, tool, client } = input;
  const proposal: StoredProposal = {
    id: `ap-${state.seq}`, title, ...(subtitle === undefined ? {} : { subtitle }), rows: rows.map(({ label, before, after }) => ({ label, after, ...(before === undefined ? {} : { before }) })),
    action, toast, ...(destructive === undefined ? {} : { destructive }), tool, client,
    createdAt: now, expiresAt: now + PROPOSAL_TTL_MS, status: "pending",
  };
  return { ...state, seq: state.seq + 1, proposals: prune([proposal, ...proposalsOf(state)]) };
}

/**
 * Records the owner's decision on a pending proposal. Approval runs its change
 * in the same state transition; a change that no longer applies is `failed`
 * and changes nothing else. An expired proposal is `expired` whatever the
 * decision. A decided or unknown proposal leaves the state as it was.
 */
export function decideProposal(state: DemoState, id: string, approve: boolean, now: number, run: Run): DemoState {
  const proposal = proposalsOf(state).find((p) => p.id === id);
  if (!proposal || proposal.status !== "pending" || typeof approve !== "boolean") return state;
  const mark = (from: DemoState, status: StoredProposal["status"]): DemoState => ({
    ...from,
    proposals: proposalsOf(from).map((p) => (p.id === id ? { ...p, status, decidedAt: now } : p)),
  });
  if (now >= proposal.expiresAt) return mark(state, "expired");
  if (!approve) return mark(state, "declined");
  const applied = run(state, proposal.action);
  return applied === state ? mark(state, "failed") : mark(applied, "approved");
}
