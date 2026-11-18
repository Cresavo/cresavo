import { isActive, isFree, pickResource } from "../data/slots";
import type { DemoState } from "../data/types";
import { canApplyPatch, revertPatch } from "./patch";
import type { LogEntry } from "./types";

type UndoBlockReason = "changed" | "time-taken";

function previewUndo(state: DemoState, entry?: LogEntry): DemoState | UndoBlockReason {
  if (!entry?.patch || entry.undone || !canApplyPatch(state, entry.patch)) return "changed";
  const reverted = revertPatch(state, entry.patch);
  if (!entry.patch.collections.bookings) return reverted;

  const current = new Map(state.bookings.map((booking) => [booking.id, booking]));
  for (const [index, booking] of reverted.bookings.entries()) {
    if (!isActive(booking)) continue;
    const { id, staffId, date, start } = booking;
    const beforeUndo = current.get(id);
    const restored = booking.status === "booked" && beforeUndo?.status !== "booked";
    const moved = beforeUndo && (beforeUndo.staffId !== staffId || beforeUndo.date !== date || beforeUndo.start !== start);
    if (!restored && !moved) continue;

    if (!isFree(reverted, staffId, date, start, booking, id)) return "time-taken";
    // The bookings patch gives the reverted state its own array. Reserve the
    // room here so the next restored booking sees it too.
    reverted.bookings[index] = { ...booking, resourceId: pickResource(reverted, booking, date, start, id) };
  }
  return reverted;
}

/** The reason a log entry cannot be undone, if any. */
export function undoBlockReason(state: DemoState, entry?: LogEntry): UndoBlockReason | undefined {
  const result = previewUndo(state, entry);
  return typeof result === "string" ? result : undefined;
}

export function isUndoable(state: DemoState, entry: LogEntry): boolean {
  return !undoBlockReason(state, entry);
}

/** Whether the log entry with this id exists and can still be undone (it may have been evicted from the log). */
export function canUndo(state: DemoState, id: string): boolean {
  const entry = state.log.find((e) => e.id === id);
  return !!entry && isUndoable(state, entry);
}

/** Takes one change back. The entry stays in the log, marked as undone. */
export function undoEntry(state: DemoState, id: string): DemoState {
  const reverted = previewUndo(state, state.log.find((e) => e.id === id));
  if (typeof reverted === "string") return state;
  return { ...reverted, log: reverted.log.map((e) => (e.id === id ? { ...e, undone: true } : e)) };
}
