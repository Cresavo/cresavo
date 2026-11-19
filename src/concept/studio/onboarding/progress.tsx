"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { salonDraft } from "../../onboarding/salon";

function useProgress() {
  const [draft, setDraft] = useState(() => salonDraft());
  const [step, setStep] = useState(0);
  return { draft, setDraft, step, setStep };
}

const Progress = createContext<ReturnType<typeof useProgress> | null>(null);

/** The studio keeps setup answers while its language boundary remounts. */
export function SetupProgressProvider({ children }: { children: ReactNode }) {
  const progress = useProgress();
  return <Progress.Provider value={progress}>{children}</Progress.Provider>;
}

export function useSetupProgress() {
  const progress = useContext(Progress);
  if (!progress) throw new Error("Missing setup progress provider");
  return progress;
}
