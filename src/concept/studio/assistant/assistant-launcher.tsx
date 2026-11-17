"use client";

import { useEffect } from "react";
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

/** The floating button on phones (with a microphone that opens the panel listening), the panel, and the routine runner. */
export function AssistantLauncher() {
  return (
    <>
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex items-center rounded-full bg-action text-on-action shadow-sheet sm:hidden">
        <button type="button" onClick={() => openAssistant()} className="flex min-h-12 items-center gap-2 pl-4 pr-3 text-[15px] font-semibold">
          <Sparkles size={18} />
          {t("assistant.open")}
        </button>
        <span className="h-6 w-px bg-on-action/30" aria-hidden />
        <button type="button" onClick={() => openAssistant({ listen: true })} aria-label={t("assistant.openVoice")} title={t("assistant.openVoice")} className="flex size-12 items-center justify-center">
          <Mic size={18} />
        </button>
      </div>
      <AssistantPanel />
      <RoutineRunner />
    </>
  );
}

/** The button in the top bar on larger screens, where the inline command box stays for quick commands. */
export function AssistantHeaderButton() {
  return (
    <Button size="sm" variant="secondary" icon={<Sparkles size={16} className="text-action" />} onClick={() => openAssistant()} className="hidden sm:inline-flex">
      {t("assistant.open")}
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
