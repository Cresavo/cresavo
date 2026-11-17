import type { DemoState } from "../data/types";
import { canApplyPatch, revertPatch } from "./patch";
import type { LogEntry } from "./types";

/** An entry can be undone while it has not been undone and nothing has touched its records since. */
export function isUndoable(state: DemoState, entry: LogEntry): boolean {
  return !!entry.patch && !entry.undone && canApplyPatch(state, entry.patch);
}

/** Whether the log entry with this id exists and can still be undone (it may have been evicted from the log). */
export function canUndo(state: DemoState, id: string): boolean {
  const entry = state.log.find((e) => e.id === id);
  return !!entry && isUndoable(state, entry);
}

/** Takes one change back. The entry stays in the log, marked as undone. */
export function undoEntry(state: DemoState, id: string): DemoState {
  const entry = state.log.find((e) => e.id === id);
  if (!entry?.patch || !isUndoable(state, entry)) return state;
  const reverted = revertPatch(state, entry.patch);
  return { ...reverted, log: reverted.log.map((e) => (e.id === id ? { ...e, undone: true } : e)) };
}
