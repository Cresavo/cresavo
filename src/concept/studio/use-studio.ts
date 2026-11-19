"use client";

import { useMemo } from "react";
import { getActiveLocale } from "../i18n";
import { studioSalonCopy } from "../i18n/salon-eko-copy";
import { useDemo } from "../store";
import { useNow } from "../use-now";

/** Demo state plus the current day and minute. Only used inside the loaded studio shell. */
export function useStudio() {
  const saved = useDemo();
  const language = getActiveLocale();
  const state = useMemo(() => saved && studioSalonCopy(saved, language), [saved, language]);
  const now = useNow();
  if (!state) throw new Error("useStudio() was called before the demo state loaded");
  return { state, today: now.today, minutes: now.minutes };
}
