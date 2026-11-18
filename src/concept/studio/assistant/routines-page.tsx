"use client";

import { Play, Repeat } from "lucide-react";
import { scheduleText, slotKey, suggestedRoutines, toSkillMd, type Routine } from "../../assistant/routines";
import { t, tc } from "../../i18n";
import { dispatch } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { Switch } from "../../ui/controls";
import { EmptyState } from "../../ui/empty-state";
import { MorePage } from "../more/more-page";
import { useStudio } from "../use-studio";
import { postRoutineRun } from "./assistant-launcher";
import { openAssistant } from "./thread-store";
import { dispatchWithUndoToast } from "../log/undo-toast";

const ASSISTANT = { actor: "owner", source: "assistant" } as const;

/** Routines the owner keeps (switch on/off, run now, read as SKILL.md) and the ones the assistant suggests. */
export function RoutinesPage() {
  const { state, today, minutes } = useStudio();
  const suggestions = suggestedRoutines(state, { today, minutes });
  return (
    <MorePage title={t("nav.routines")} subtitle={tc("routine.subtitle", state.routines.filter((r) => r.enabled).length)} module="assistant">
      <div className="space-y-6">
        <p className="max-w-2xl text-[15px] text-text-secondary">{t("routine.intro")}</p>
        {state.routines.length ? (
          <div className="space-y-3">
            {state.routines.map((routine) => <RoutineCard key={routine.id} routine={routine} />)}
          </div>
        ) : (
          <EmptyState icon={<Repeat size={22} />} title={t("routine.emptyTitle")} text={t("routine.emptyText")} />
        )}
        {suggestions.length > 0 && (
          <Section title={t("routine.suggested")}>
            {suggestions.map(({ routine, reason }) => (
              <Card key={routine.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{routine.name}</p>
                  <p className="text-sm text-text-secondary">{scheduleText(routine)} · {reason}</p>
                </div>
                <Button size="sm" onClick={() => {
                  dispatchWithUndoToast({ type: "routine/add", routine }, t("assistant.routine.on", { name: routine.name }), ASSISTANT);
                }}>
                  {t("assistant.routine.switchOn")}
                </Button>
              </Card>
            ))}
          </Section>
        )}
      </div>
    </MorePage>
  );
}

function RoutineCard({ routine }: { routine: Routine }) {
  const { state, today, minutes } = useStudio();
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-action-bg text-text"><Repeat size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{routine.name}</p>
          <p className="text-sm text-text-secondary">{scheduleText(routine)} · {t(routine.enabled ? "routine.on" : "routine.off")}</p>
        </div>
        <Switch checked={routine.enabled} label={routine.name} onChange={() => dispatch({ type: "routine/toggle", id: routine.id, at: slotKey(today, minutes) }, ASSISTANT)} />
      </div>
      <p className="text-sm">{routine.description}</p>
      <ol className="list-decimal space-y-0.5 pl-5 text-sm text-text-secondary">
        {routine.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-action">{t("routine.skillFile")}</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-3 text-xs leading-relaxed">{toSkillMd(routine)}</pre>
      </details>
      <Button size="sm" variant="secondary" icon={<Play size={16} />} onClick={() => {
        postRoutineRun(state, routine, { today, minutes });
        openAssistant();
      }}>
        {t("routine.runNow")}
      </Button>
    </Card>
  );
}
