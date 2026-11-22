"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";
import { dueRun, type Routine } from "../../assistant/routines";
import type { DemoState } from "../../data/types";
import type { Clock } from "../../finance/types";
import { runRoutine } from "../../assistant/outreach";
import { t } from "../../i18n";
import { currentRole, useRole } from "../../ops/role";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { showToast } from "../../ui/toast";
import { useSalonNow } from "../../use-now";
import { useStudio } from "../use-studio";
import { AssistantPanel } from "./assistant-panel";
import { addMessages, messageId, openAssistant } from "./thread-store";

/** Mounts the assistant panel, keyboard shortcut and routine runner. */
export function AssistantLauncher() {
  useShortcut();
  return (
    <>
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
    <Button size="sm" variant="secondary" data-help="assistant" aria-keyshortcuts="Control+K Meta+K" icon={<MessageCircle size={16} aria-hidden />} onClick={() => openAssistant()} className="max-sm:w-11 max-sm:justify-center max-sm:px-0">
      <span className="max-sm:sr-only">{t("assistant.open")}</span>
      <kbd aria-hidden className="hidden rounded-xs border border-hairline px-2 font-sans text-xs text-text-secondary lg:inline">{t(mac ? "assistant.shortcut.mac" : "assistant.shortcut.pc")}</kbd>
    </Button>
  );
}

/** Runs switched-on routines on their schedule while the studio is open. Each run leaves a proposal in the panel. */
function RoutineRunner() {
  const { state } = useStudio();
  // The salon's clock, as the reducer judges it: a browser in another time zone must not try a slot early.
  const { today, minutes } = useSalonNow();
  const role = useRole();
  // One attempt per routine, slot and minute: a run the server refuses (its clock is behind this one) is tried again on a later tick, never in a loop.
  const attempted = useRef(new Map<string, string>());
  useEffect(() => {
    if (role !== "owner") return;
    for (const routine of state.routines) {
      const slot = dueRun(routine, { today, minutes });
      const attempt = `${slot} ${today} ${minutes}`;
      if (!slot || attempted.current.get(routine.id) === attempt) continue;
      attempted.current.set(routine.id, attempt);
      if (!dispatch({ type: "routine/ran", id: routine.id, at: slot })) continue;
      postRoutineRun(state, routine, { today, minutes });
      showToast(t("assistant.routine.ran", { name: routine.name }), { label: t("assistant.routine.show"), run: () => { if (currentRole() === "owner") openAssistant(); } });
    }
  }, [state, today, minutes, role]);
  return null;
}

/** Puts what a routine prepared into the conversation as a proposal to approve. */
export function postRoutineRun(state: DemoState, routine: Routine, clock: Clock) {
  const text = t("assistant.routine.ran", { name: routine.name });
  addMessages([{ id: messageId(), from: "assistant", text, reply: { source: "rules", text, card: runRoutine(state, routine, clock), topic: routine.name }, at: Date.now() }], undefined, "owner");
}
