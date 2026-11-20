"use client";

import type { DemoAction } from "../../actions";
import type { InputMode, Reply } from "../../assistant/thread";
import type { Choice, Proposal } from "../../command/proposal";
import type { DemoState } from "../../data/types";
import { undoBlockReason } from "../../log/undo";
import type { LogMeta } from "../../log/types";
import { canChangeBooking, staffViewer } from "../../ops/access";
import { currentRole } from "../../ops/role";
import { currentState, currentTarget } from "../../store";
import { commitAction } from "../../store/commit";
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

/** Replies whose change or undo is being saved: a second tap waits for nothing and changes nothing. */
const inFlight = new Set<string>();

/** The salon a reply belongs to; a reply saved before targets existed uses the salon shown now. */
const targetFor = (reply: Reply) => reply.target ?? currentTarget();

/** Runs one save per reply at a time. */
async function once<T>(id: string, save: () => Promise<T>): Promise<T | false> {
  if (inFlight.has(id)) return false;
  inFlight.add(id);
  try {
    return await save();
  } finally {
    inFlight.delete(id);
  }
}

/** Applies a change the owner approved on a reply. Undo sits on the card, since a toast would hide behind the panel. */
export function applyReply(id: string, action: DemoAction, meta: Meta): Promise<boolean> {
  return once(id, async () => {
    const reply = replyOf(id);
    if (!reply || reply.status) return false;
    const target = targetFor(reply);
    const result = target && await commitAction(target, action, { meta, guard: (state) => canApplyReply(state, action) }).catch(() => null);
    updateReply(id, result?.ok ? { status: "approved", undoId: result.logId ?? undefined, target: target ?? undefined } : { status: "failed" });
    return !!result?.ok;
  }).then((done) => done === true);
}

/** Approves a proposal with the provenance of the words that asked for it. */
export function approveReply(id: string, action: DemoAction): Promise<boolean> {
  const reply = replyOf(id);
  return reply?.card?.kind === "change" && reply.card.action === action
    ? applyReply(id, action, { actor: "ai", source: sourceFor(reply.input) })
    : Promise.resolve(false);
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
 * Takes back the change a reply made, in the salon it was made in. The card
 * says "Undone" only when the store accepted it; a booking conflict stays
 * visible on the reply while the original time is unavailable.
 */
export function undoReply(id: string, undoId: string): Promise<boolean> {
  return once(id, async () => {
    const reply = replyOf(id);
    if (reply?.undoId !== undoId) return false;
    const target = targetFor(reply);
    const result = target && await commitAction(target, { type: "log/undo", id: undoId }).catch(() => null);
    if (result?.ok) updateReply(id, { status: "undone", undoId: undefined });
    // That salon is gone, or this one changed the record: nothing to take back any more.
    else if (!result || result.reason === "replaced" || result.reason === "not-found" || replyUndoBlockReason({ undoId }) === "changed") updateReply(id, { undoId: undefined });
    // A conflict (time taken, customer in use, card spent) can clear again, so the undo stays offered.
    return !!result?.ok;
  }).then((done) => done === true);
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
