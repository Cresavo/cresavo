"use client";

import { useSyncExternalStore } from "react";
import { hasUnseen, latestVersion } from "../../whats-new";

export const SEEN_KEY = "cresavo:whats-new-seen";
const CHANGED = "cresavo:whats-new-seen-changed";

export function readLastSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/** Remembers on this device that the newest release has been seen. Storage can be blocked; the dot then returns next visit. */
export function markSeen(): void {
  const latest = latestVersion();
  if (!latest) return;
  try {
    localStorage.setItem(SEEN_KEY, latest);
  } catch {
    // Not remembered; nothing else depends on it.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(listener: () => void) {
  window.addEventListener(CHANGED, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGED, listener);
    window.removeEventListener("storage", listener);
  };
}

/** Whether to show the dot. False on the server and during hydration, so markup never differs. */
export function useHasUnseenUpdates(): boolean {
  return useSyncExternalStore(subscribe, () => hasUnseen(readLastSeen()), () => false);
}
