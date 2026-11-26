"use client";

import { useSyncExternalStore } from "react";

/**
 * When the signed-in salon on screen was last read from the server. While the connection is gone the calendar
 * says so ("Updated at 14:32"), so it never looks more current than it is. Only the open tab knows it: nothing is
 * kept in browser storage, and signing out or switching login forgets it.
 */
let readAt: number | null = null;
const listeners = new Set<() => void>();
const publish = () => listeners.forEach((listener) => listener());

/** The screen now shows the server's own copy of the salon. */
export function noteServerCopy(at = Date.now()) {
  readAt = at;
  publish();
}

/** The account salon closed: no time is shown for it any more. */
export function forgetServerCopy() {
  if (readAt === null) return;
  readAt = null;
  publish();
}

export function useServerCopyAt(): number | null {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, () => readAt, () => null);
}
