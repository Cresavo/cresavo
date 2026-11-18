"use client";

import type { DemoAction } from "../../actions";
import type { InputMode, Reply } from "../../assistant/thread";
import type { Choice, Proposal } from "../../command/proposal";
import type { DemoState } from "../../data/types";
import { undoBlockReason } from "../../log/undo";
import type { LogMeta } from "../../log/types";
import { canChangeBooking, staffViewer } from "../../ops/access";
import { currentRole } from "../../ops/role";
import { currentState, dispatch, dispatchWithLog } from "../../store";
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

/** Applies a change the owner approved on a reply. Undo sits on the card, since a toast would hide behind the panel. */
export function applyReply(id: string, action: DemoAction, meta: Meta) {
  const reply = replyOf(id);
  if (!reply || reply.status) return false;
  const logId = dispatchWithLog(action, meta, (state) => canApplyReply(state, action));
  updateReply(id, logId !== false ? { status: "approved", undoId: logId ?? undefined } : { status: "failed" });
  return logId !== false;
}

/** Approves a proposal with the provenance of the words that asked for it. */
export function approveReply(id: string, action: DemoAction) {
  const reply = replyOf(id);
  return reply?.card?.kind === "change" && reply.card.action === action
    ? applyReply(id, action, { actor: "ai", source: sourceFor(reply.input) })
    : false;
}

/** Whether the panel should offer Undo for a reply: only while the store would accept it. */
export function replyUndoable(reply: Reply): boolean {
  return !replyUndoBlockReason(reply);
}

export function replyUndoBlockReason(reply: Pick<Reply, "undoId">) {
  if (!reply.undoId) return "changed";
  const state = currentState();
  return state ? undoBlockReason(state, state.log.find((entry) => entry.id === reply.undoId)) : "changed";
}

/**
 * Takes back the change a reply made. The card says "Undone" only when the store accepted it;
 * A booking conflict stays visible on the reply while the original time is unavailable.
 */
export function undoReply(id: string, undoId: string): boolean {
  if (replyOf(id)?.undoId !== undoId) return false;
  const done = dispatch({ type: "log/undo", id: undoId });
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
