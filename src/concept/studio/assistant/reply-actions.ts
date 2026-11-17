"use client";

import type { DemoAction } from "../../actions";
import type { Choice, Proposal } from "../../command/proposal";
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

/** A clarifying choice: the picked proposal replaces the card (and any model reading still on its way). */
export function pickReply(id: string, choice: Extract<Choice, { proposal: Proposal }>) {
  updateReply(id, { card: choice.proposal });
}
