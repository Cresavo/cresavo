"use client";

import type { DemoAction } from "../../actions";
import type { InputMode, Reply } from "../../assistant/thread";
import type { Choice, Proposal } from "../../command/proposal";
import type { DemoState } from "../../data/types";
import { findLogEntry, undoBlockReason } from "../../log/undo";
import type { LogMeta } from "../../log/types";
import { canChangeBooking, staffViewer } from "../../ops/access";
import { currentRole } from "../../ops/role";
import { currentState, dispatchCommitted } from "../../store";
import { replyOf, updateReply } from "./thread-store";

// What the owner can do with a reply card in the panel. Plain functions over
// the demo store and the thread, so the rules are testable without React.

type Meta = Partial<Omit<LogMeta, "at">>;

/** Where a change the owner asked for came from: spoken commands are logged as voice, typed ones as the assistant. */
export const sourceFor = (input: InputMode | undefined): LogMeta["source"] => (input === "voice" ? "voice" : "assistant");

function canApplyReply(state: DemoState, action: DemoAction): boolean {
  const role = currentRole();
  if (role === "owner" || action.type === "booking/create") return true;
  if (action.type === "booking/cancel") return canChangeBooking(state, role, action.id);
  return action.type === "booking/move" && canChangeBooking(state, role, action.id) &&
    (!action.staffId || action.staffId === staffViewer(state)?.id);
}

/** Replies whose change is being committed, so a second click cannot apply it twice. */
const inFlight = new Set<string>();

/**
 * Applies a change the owner approved on a reply. Undo sits on the card, since a toast would hide behind the panel.
 * The card says "approved", with its Undo, only once the change is saved; a refused commit marks it failed.
 */
export async function applyReply(id: string, action: DemoAction, meta: Meta): Promise<boolean> {
  const reply = replyOf(id);
  if (!reply || reply.status || inFlight.has(id)) return false;
  inFlight.add(id);
  try {
    const result = await dispatchCommitted(action, meta, (state) => canApplyReply(state, action));
    updateReply(id, result.ok ? { status: "approved", undoId: result.logId ?? undefined } : { status: "failed" });
    return result.ok;
  } finally {
    inFlight.delete(id);
  }
}

/**
 * Approves a proposal with the provenance of the words that asked for it. The owner's own click is
 * their approval too (offering a cancelled time to the waiting list needs it); a colleague's is not.
 */
export function approveReply(id: string, action: DemoAction): Promise<boolean> {
  const reply = replyOf(id);
  const approval = currentRole() === "owner" ? { approvedBy: "owner" as const } : {};
  return reply?.card?.kind === "change" && reply.card.action === action
    ? applyReply(id, action, { actor: "ai", source: sourceFor(reply.input), ...approval })
    : Promise.resolve(false);
}

/** Whether the panel should offer Undo for a reply: only while the store would accept it. */
export function replyUndoable(reply: Reply): boolean {
  return !replyUndoBlockReason(reply);
}

export function replyUndoBlockReason(reply: Pick<Reply, "undoId">) {
  if (!reply.undoId) return "changed";
  const state = currentState();
  return state ? undoBlockReason(state, findLogEntry(state.log, reply.undoId)) : "changed";
}

/**
 * Takes back the change a reply made. The card says "Undone" only when the store accepted it;
 * A booking conflict stays visible on the reply while the original time is unavailable.
 */
export async function undoReply(id: string, undoId: string): Promise<boolean> {
  if (replyOf(id)?.undoId !== undoId) return false;
  // "Undone" only once the undo is saved.
  const done = (await dispatchCommitted({ type: "log/undo", id: undoId })).ok;
  if (done) updateReply(id, { status: "undone", undoId: undefined });
  // A conflict (time taken, customer in use, card spent) can clear again, so the undo stays offered.
  else if (replyUndoBlockReason({ undoId }) === "changed") updateReply(id, { undoId: undefined });
  return done;
}

/** A clarifying choice: the picked proposal replaces the card (and any model reading still on its way). */
export function pickReply(id: string, choice: Extract<Choice, { proposal: Proposal }>) {
  updateReply(id, { card: choice.proposal });
}

/** Takes the owner's words back into the message box. The old proposal can no longer be approved. Returns the words. */
export function editReply(id: string): string {
  const request = replyOf(id)?.request ?? "";
  updateReply(id, { status: "edited" });
  return request;
}
