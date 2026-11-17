"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Mic, Sparkles } from "lucide-react";
import { dueRun, type Routine } from "../../assistant/routines";
import type { DemoState } from "../../data/types";
import type { Clock } from "../../finance/types";
import { runRoutine } from "../../assistant/outreach";
import { t } from "../../i18n";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { showToast } from "../../ui/toast";
import { useStudio } from "../use-studio";
import { AssistantPanel } from "./assistant-panel";
import { addMessages, messageId, openAssistant } from "./thread-store";

/** The floating button on phones (with a microphone that opens the panel listening), the panel, Ctrl/Cmd+K, and the routine runner. */
export function AssistantLauncher() {
  useShortcut();
  return (
    <>
      {/* On very narrow screens (200 % zoom on a phone) the pill collapses to one 48 px icon button; the microphone is in the panel. */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center rounded-lg bg-action text-on-action shadow-sheet max-[299px]:right-2 sm:hidden">
        <button type="button" data-help="assistant" onClick={() => openAssistant()} className="flex min-h-12 items-center gap-2 pl-4 pr-3 text-base font-semibold max-[299px]:w-12 max-[299px]:justify-center max-[299px]:px-0">
          <Sparkles size={18} aria-hidden />
          <span className="max-[299px]:sr-only">{t("assistant.open")}</span>
        </button>
        <span className="h-6 w-px bg-on-action/30 max-[299px]:hidden" aria-hidden />
        <button type="button" onClick={() => openAssistant({ listen: true })} aria-label={t("assistant.openVoice")} title={t("assistant.openVoice")} className="flex size-12 items-center justify-center max-[299px]:hidden">
          <Mic size={18} aria-hidden />
        </button>
      </div>
      <AssistantPanel />
      <RoutineRunner />
    </>
  );
}

const noChange = () => () => {};

/** Ctrl+K (⌘K on a Mac) opens the panel from anywhere in the studio; quick commands are typed there. */
function useShortcut() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      openAssistant();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** The button in the top bar from tablet width, with its keyboard shortcut. A secondary action: never competes with a page's primary button. */
export function AssistantHeaderButton() {
  const mac = useSyncExternalStore(noChange, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  return (
    <Button size="sm" variant="secondary" data-help="assistant" aria-keyshortcuts="Control+K Meta+K" icon={<Sparkles size={16} aria-hidden />} onClick={() => openAssistant()} className="hidden sm:inline-flex">
      {t("assistant.open")}
      <kbd aria-hidden className="hidden rounded-xs border border-border px-1.5 font-sans text-xs text-text-secondary lg:inline">{mac ? "⌘K" : "Ctrl K"}</kbd>
    </Button>
  );
}

/** Runs switched-on routines on their schedule while the studio is open. Each run leaves a proposal in the panel. */
function RoutineRunner() {
  const { state, today, minutes } = useStudio();
  useEffect(() => {
    for (const routine of state.routines) {
      const slot = dueRun(routine, { today, minutes });
      if (!slot) continue;
      dispatch({ type: "routine/ran", id: routine.id, at: slot });
      postRoutineRun(state, routine, { today, minutes });
      showToast(t("assistant.routine.ran", { name: routine.name }), { label: t("assistant.routine.show"), run: () => openAssistant() });
    }
  }, [state, today, minutes]);
  return null;
}

/** Puts what a routine prepared into the conversation as a proposal to approve. */
export function postRoutineRun(state: DemoState, routine: Routine, clock: Clock) {
  const text = t("assistant.routine.ran", { name: routine.name });
  addMessages([{ id: messageId(), from: "assistant", text, reply: { source: "rules", text, card: runRoutine(state, routine, clock), topic: routine.name }, at: Date.now() }]);
}
