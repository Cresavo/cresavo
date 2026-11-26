"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { getActiveLocale } from "../../i18n";
import { restoreDraft, salonDraft, type SalonDraft } from "../../onboarding/salon";

/** Setup answers in this browser, so an owner who leaves half-way comes back to the same question. */
export const SETUP_DRAFT_KEY = "studio-setup-draft-v1";

interface Saved { draft: SalonDraft; step: number }

function read(): Saved {
  try {
    const raw = localStorage.getItem(SETUP_DRAFT_KEY);
    const saved: unknown = raw ? JSON.parse(raw) : null;
    if (typeof saved === "object" && saved !== null) {
      const { draft, step } = saved as { draft?: unknown; step?: unknown };
      return { draft: restoreDraft(draft, getActiveLocale()), step: Number.isInteger(step) && (step as number) >= 0 ? step as number : 0 };
    }
  } catch { /* Unreadable storage or text: start over. */ }
  return { draft: salonDraft(getActiveLocale()), step: 0 };
}

let current: Saved | undefined;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => (current ??= read());
// The server has no storage: it renders nothing for the questions until the browser has read them.
const serverSnapshot = () => undefined;

function save(next: Saved) {
  current = next;
  const untouched = next.step === 0 && JSON.stringify(next.draft) === JSON.stringify(salonDraft(next.draft.language));
  try {
    if (untouched) localStorage.removeItem(SETUP_DRAFT_KEY);
    else localStorage.setItem(SETUP_DRAFT_KEY, JSON.stringify(next));
  } catch { /* Without storage the answers last for this visit. */ }
  for (const listener of listeners) listener();
}

function useProgress() {
  const saved = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const fallback = saved ?? { draft: salonDraft(), step: 0 };
  const setDraft = useCallback((draft: SalonDraft) => save({ ...snapshot(), draft }), []);
  const setStep = useCallback((step: number) => save({ ...snapshot(), step }), []);
  /** Applies a late answer (such as a decoded logo) to the latest draft, not the one it started from. */
  const patchDraft = useCallback((patch: Partial<SalonDraft>) => {
    const latest = snapshot();
    save({ ...latest, draft: { ...latest.draft, ...patch } });
  }, []);
  /** After the salon is made: a fresh draft, and nothing left in storage. */
  const clear = useCallback((language: SalonDraft["language"]) => save({ draft: salonDraft(language), step: 0 }), []);
  /** The draft as it is now, for example after waiting for a logo that was still decoding. */
  const latestDraft = useCallback(() => snapshot().draft, []);
  return { draft: fallback.draft, step: fallback.step, setDraft, setStep, patchDraft, latestDraft, clear, restored: saved !== undefined };
}

const Progress = createContext<ReturnType<typeof useProgress> | null>(null);

/** The studio keeps setup answers while its language boundary remounts, and in the browser between visits. */
export function SetupProgressProvider({ children }: { children: ReactNode }) {
  const progress = useProgress();
  return <Progress.Provider value={progress}>{children}</Progress.Provider>;
}

export function useSetupProgress() {
  const progress = useContext(Progress);
  if (!progress) throw new Error("Missing setup progress provider");
  return progress;
}
