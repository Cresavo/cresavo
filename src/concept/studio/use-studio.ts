"use client";

import { useDemo } from "../store";
import { useNow } from "../use-now";

/** Demo state plus the current day and minute. Only used inside the loaded studio shell. */
export function useStudio() {
  const state = useDemo();
  const now = useNow();
  if (!state) throw new Error("useStudio() was called before the demo state loaded");
  return { state, today: now.today, minutes: now.minutes };
}
