import { useSyncExternalStore } from "react";
import { helpEntry } from "../map/entries";

// Which "Show me" guide is running, and at which step. One at a time, for the whole studio, so the help sheet, a
// friendly message's "Show me" button or (later) a connected assistant can start it.

export interface ShowMeGuide {
  entryId: string;
  index: number;
}

let guide: ShowMeGuide | null = null;
const listeners = new Set<() => void>();

function set(next: ShowMeGuide | null) {
  guide = next;
  for (const listener of listeners) listener();
}

/** Starts pointing the way to a help-map entry. False for an unknown id. */
export function startShowMe(entryId: string): boolean {
  if (!helpEntry(entryId)) return false;
  set({ entryId, index: 0 });
  return true;
}

export function moveShowMe(index: number) {
  if (guide) set({ ...guide, index: Math.max(0, index) });
}

export function stopShowMe() {
  set(null);
}

export function useShowMe(): ShowMeGuide | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => guide,
    () => null,
  );
}
