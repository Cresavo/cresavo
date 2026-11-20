"use client";

import { useMemo } from "react";
import { useLocale } from "@/app/components/locale-provider";
import { studioSalonCopy } from "../i18n/salon-eko-copy";
import { targetOf, useDemo, withLifetimeOf } from "../store";
import { useNow } from "../use-now";

/** Demo state plus the current day and minute. Only used inside the loaded studio shell. */
export function useStudio() {
  const saved = useDemo();
  const language = useLocale();
  const state = useMemo(() => saved && withLifetimeOf(studioSalonCopy(saved, language), saved), [saved, language]);
  const now = useNow();
  if (!state) throw new Error("useStudio() was called before the demo state loaded");
  // The salon this render shows: commands made from it are bound to it (null only for a state the store never read).
  return { state, today: now.today, minutes: now.minutes, target: targetOf(state) };
}
