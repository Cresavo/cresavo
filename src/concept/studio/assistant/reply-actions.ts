"use client";

import type { DemoAction } from "../../actions";
import type { Reply } from "../../assistant/thread";
import type { Choice, Proposal } from "../../command/proposal";
import { canUndo } from "../../log/undo";
import type { LogMeta } from "../../log/types";
import { currentState, dispatch } from "../../store";
import { updateReply } from "./thread-store";

// What the owner can do with a reply card in the panel. Plain functions over
// the demo store and the thread, so the rules are testable without React.

type Meta = Partial<Omit<LogMeta, "at">>;

/** The activity log entry the last dispatch wrote. */
const lastLogId = () => currentState()?.log[0]?.id;

/** Applies a change the owner approved on a reply. Undo sits on the card, since a toast would hide behind the panel. */
export function applyReply(id: string, action: DemoAction, meta: Meta) {
  const done = dispatch(action, meta);
  updateReply(id, done ? { status: "approved", undoId: lastLogId() } : { status: "failed" });
  return done;
}

/** Approves a proposal the assistant drafted. */
export function approveReply(id: string, action: DemoAction) {
  return applyReply(id, action, { actor: "ai", source: "assistant" });
}

/** Whether the panel should offer Undo for a reply: only while the store would accept it. */
export function replyUndoable(reply: Reply): boolean {
  const state = currentState();
  return !!reply.undoId && !!state && canUndo(state, reply.undoId);
}

/**
 * Takes back the change a reply made. The card says "Undone" only when the store accepted it;
 * otherwise Undo is withdrawn (a later edit touched the same records, or the entry is gone).
 */
export function undoReply(id: string, undoId: string): boolean {
  const done = dispatch({ type: "log/undo", id: undoId });
  updateReply(id, done ? { status: "undone", undoId: undefined } : { undoId: undefined });
  return done;
}

/** A clarifying choice: the picked proposal replaces the card (and any model reading still on its way). */
export function pickReply(id: string, choice: Extract<Choice, { proposal: Proposal }>) {
  updateReply(id, { card: choice.proposal });
}
