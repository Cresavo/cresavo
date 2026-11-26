"use client";

import { lazy, Suspense, useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import { createRoutineAttempts } from "../../assistant/routine-attempts";
import { dueRun, type Routine } from "../../assistant/routines";
import type { DemoState } from "../../data/types";
import type { Clock } from "../../finance/types";
import { runRoutine } from "../../assistant/outreach";
import { useLabFlag } from "../../labs/flags";
import { t } from "../../i18n";
import { currentRole, useRole } from "../../ops/role";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { showToast } from "../../ui/toast";
import { useSalonNow } from "../../use-now";
import { useStudio } from "../use-studio";
import { AssistantPanel } from "./assistant-panel";
import { addMessages, messageId, openAssistant } from "./thread-store";

const HeaderVoiceMic = lazy(() => import("./header-voice-mic"));

/** Mounts the assistant panel and routine runner. Ctrl+K (⌘K) reaches it through Search (`SearchPalette`). */
export function AssistantLauncher() {
  return (
    <>
      <AssistantPanel />
      <RoutineRunner />
    </>
  );
}

/** The button in the top bar from tablet width. A secondary action: never competes with a page's primary button. */
export function AssistantHeaderButton() {
  // With the Labs switch on, a quiet microphone beside it opens the panel already listening.
  const labOn = useLabFlag("voiceAssistant");
  return (
    <>
      <Button size="sm" variant="tertiary" data-help="assistant" data-help-id="shell.assistant" icon={<MessageCircle size={16} aria-hidden />} onClick={() => openAssistant()} className="max-sm:w-11 max-sm:justify-center max-sm:px-0">
        <span className="max-sm:sr-only">{t("assistant.open")}</span>
      </Button>
      {labOn && (
        <Suspense fallback={null}>
          <HeaderVoiceMic />
        </Suspense>
      )}
    </>
  );
}

/** Runs switched-on routines on their schedule while the studio is open. Each run leaves a proposal in the panel. */
function RoutineRunner() {
  const { state, target } = useStudio();
  const salon = target?.epoch ?? state.salon.slug;
  // The salon's clock, as the reducer judges it: a browser in another time zone must not try a slot early.
  const { today, minutes } = useSalonNow();
  const role = useRole();
  // A run the server refuses is tried again on a later tick, never in a loop, and announced once.
  const attempts = useRef(createRoutineAttempts());
  useEffect(() => {
    if (role !== "owner") return;
    for (const routine of state.routines) {
      const slot = dueRun(routine, { today, minutes });
      if (!slot || !attempts.current.shouldAttempt(salon, routine.id, slot, today, minutes)) continue;
      if (!dispatch({ type: "routine/ran", id: routine.id, at: slot })) continue;
      if (!attempts.current.firstAnnouncement(salon, routine.id, slot)) continue;
      postRoutineRun(state, routine, { today, minutes });
      showToast(t("assistant.routine.ran", { name: routine.name }), { label: t("assistant.routine.show"), run: () => { if (currentRole() === "owner") openAssistant(); } });
    }
  }, [state, salon, today, minutes, role]);
  return null;
}

/** Puts what a routine prepared into the conversation as a proposal to approve. */
export function postRoutineRun(state: DemoState, routine: Routine, clock: Clock) {
  const text = t("assistant.routine.ran", { name: routine.name });
  addMessages([{ id: messageId(), from: "assistant", text, reply: { source: "rules", text, card: runRoutine(state, routine, clock), topic: routine.name }, at: Date.now() }], undefined, "owner");
}
