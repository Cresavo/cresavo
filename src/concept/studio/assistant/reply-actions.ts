"use client";

import type { DemoAction } from "../../actions";
import type { InputMode, Reply } from "../../assistant/thread";
import type { Choice, Proposal } from "../../command/proposal";
import type { DemoState } from "../../data/types";
import { undoBlockReason } from "../../log/undo";
import type { LogMeta } from "../../log/types";
import { canChangeBooking, staffViewer } from "../../ops/access";
import { currentRole } from "../../ops/role";
import { currentState, currentTarget, latestStateOf, targetOf } from "../../store";
import type { Target } from "../../store/commit";
import { commitAction } from "../../store/commit";
import { replyIn, replyOf, threadKey, updateReply, updateReplyIn } from "./thread-store";

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

/**
 * Applies a change the owner approved on a reply. Undo sits on the card, since a toast would hide behind the panel.
 * The card is pending while the change is saved, and the outcome goes to the conversation it was approved in,
 * even if the owner switched role or salon meanwhile.
 */
export function applyReply(id: string, action: DemoAction, meta: Meta): Promise<boolean> {
  return once(id, async () => {
    const thread = threadKey();
    const reply = replyIn(thread, id);
    if (!reply || reply.status || reply.pending) return false;
    const target = targetFor(reply);
    updateReplyIn(thread, id, { pending: true });
    const result = target && await commitAction(target, action, { meta, guard: (state) => canApplyReply(state, action) }).catch(() => null);
    updateReplyIn(thread, id, result?.ok ? { status: "approved", undoId: result.logId ?? undefined, target: target ?? undefined, pending: undefined } : { status: "failed", pending: undefined });
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

/** Whether the change behind `undoId` can never be undone in `target`'s salon again: it is gone, replaced or changed since. */
function undoGone(target: Target, undoId: string): boolean {
  const state = latestStateOf(target.workspace);
  if (!state || targetOf(state)?.epoch !== target.epoch) return true;
  return undoBlockReason(state, state.log.find((entry) => entry.id === undoId)) === "changed";
}

/**
 * Takes back the change a reply made, in the salon it was made in, writing the
 * outcome to the conversation it was pressed in. The card says "Undone" only
 * when the store accepted it. Undo stays offered after an error the store did
 * not explain, or a conflict that can clear again (time taken, card spent); it
 * is withdrawn only when the store confirms the change can never be undone.
 */
export function undoReply(id: string, undoId: string): Promise<boolean> {
  return once(id, async () => {
    const thread = threadKey();
    const reply = replyIn(thread, id);
    if (reply?.undoId !== undoId || reply.pending) return false;
    const target = targetFor(reply);
    if (!target) {
      updateReplyIn(thread, id, { undoId: undefined });
      return false;
    }
    updateReplyIn(thread, id, { pending: true });
    let result: Awaited<ReturnType<typeof commitAction>> | undefined;
    try {
      result = await commitAction(target, { type: "log/undo", id: undoId });
    } catch {
      result = undefined;
    }
    if (result?.ok) updateReplyIn(thread, id, { status: "undone", undoId: undefined, pending: undefined });
    else if (result && (result.reason === "replaced" || result.reason === "not-found" || undoGone(target, undoId))) updateReplyIn(thread, id, { undoId: undefined, pending: undefined });
    else updateReplyIn(thread, id, { pending: undefined });
    return !!result?.ok;
  }).then((done) => done === true);
}

/** A clarifying choice: the picked proposal replaces the card (and any model reading still on its way). Not while it is being saved. */
export function pickReply(id: string, choice: Extract<Choice, { proposal: Proposal }>) {
  if (replyOf(id)?.pending) return;
  updateReply(id, { card: choice.proposal });
}

/** "Not now" on a card. Not while its change is being saved. */
export function declineReply(id: string) {
  if (replyOf(id)?.pending) return;
  updateReply(id, { status: "declined" });
}

/**
 * Takes the owner's words back into the message box. The old proposal can no longer be approved. Returns the words,
 * or null while the card's change is being saved: the card then shows what was saved, and the box is left alone.
 */
export function editReply(id: string): string | null {
  const reply = replyOf(id);
  if (!reply || reply.pending) return null;
  updateReply(id, { status: "edited" });
  return reply.request ?? "";
}
