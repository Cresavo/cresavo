"use client";

import type { DemoAction } from "../../actions";
import type { InputMode, Reply } from "../../assistant/thread";
import type { Choice, Proposal } from "../../command/proposal";
import { undoBlockReason } from "../../log/undo";
import type { LogMeta } from "../../log/types";
import { currentState, dispatch } from "../../store";
import { replyOf, updateReply } from "./thread-store";

// What the owner can do with a reply card in the panel. Plain functions over
// the demo store and the thread, so the rules are testable without React.

type Meta = Partial<Omit<LogMeta, "at">>;

/** Where a change the owner asked for came from: spoken commands are logged as voice, typed ones as the assistant. */
export const sourceFor = (input: InputMode | undefined): LogMeta["source"] => (input === "voice" ? "voice" : "assistant");

/** The activity log entry the last dispatch wrote. */
const lastLogId = () => currentState()?.log[0]?.id;

/** Applies a change the owner approved on a reply. Undo sits on the card, since a toast would hide behind the panel. */
export function applyReply(id: string, action: DemoAction, meta: Meta) {
  const done = dispatch(action, meta);
  updateReply(id, done ? { status: "approved", undoId: lastLogId() } : { status: "failed" });
  return done;
}

/** Approves a proposal with the provenance of the words that asked for it. */
export function approveReply(id: string, action: DemoAction) {
  return applyReply(id, action, { actor: "ai", source: sourceFor(replyOf(id)?.input) });
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
  const done = dispatch({ type: "log/undo", id: undoId });
  if (done) updateReply(id, { status: "undone", undoId: undefined });
  else if (replyUndoBlockReason({ undoId }) !== "time-taken") updateReply(id, { undoId: undefined });
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
