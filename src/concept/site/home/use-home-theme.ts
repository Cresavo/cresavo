import { useSyncExternalStore } from "react";
import { useMedia } from "./use-media";

export type HomeTheme = "light" | "dark";

/** The homepage's own saved choice; the studio keeps its theme under a separate key. */
const KEY = "cresavo-site-theme";
const listeners = new Set<() => void>();
/** This visit's choice, for when storage is blocked. */
let pinned: HomeTheme | null = null;

function saved(): HomeTheme | null {
  try {
    const value = localStorage.getItem(KEY);
    if (value === "light" || value === "dark") return value;
  } catch { /* blocked storage: this visit's choice stands */ }
  return pinned;
}

function subscribe(change: () => void) {
  listeners.add(change);
  addEventListener("storage", change);
  return () => { listeners.delete(change); removeEventListener("storage", change); };
}

/**
 * Light or dark for the homepage. It follows the system until the visitor
 * flips the toggle; the choice is saved in this browser. `choice` pins the
 * page (null follows the system), `theme` is what is showing.
 */
export function useHomeTheme() {
  const choice = useSyncExternalStore(subscribe, saved, () => null);
  const system = useMedia("(prefers-color-scheme: dark)", false) ? "dark" : "light";
  const theme: HomeTheme = choice ?? system;
  const toggle = () => {
    pinned = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, pinned); } catch { /* the choice still holds for this visit */ }
    listeners.forEach((change) => change());
  };
  return { choice, theme, toggle };
}
