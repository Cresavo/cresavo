"use client";

import { MessageCircle } from "lucide-react";
import { scheduleText, suggestedRoutines } from "../../assistant/routines";
import { t } from "../../i18n";
import { dispatch, undo } from "../../store";
import { Button } from "../../ui/button";
import { Card, Section } from "../../ui/card";
import { showToast } from "../../ui/toast";
import { BriefList } from "../assistant/brief-list";
import { openAssistant } from "../assistant/thread-store";
import { useBrief } from "../assistant/use-brief";
import { useStudio } from "../use-studio";

/** The assistant's brief on Today (morning, Monday's weekly review), and a routine it suggests. Rules pick the items; AI may only phrase them. */
export function MorningBrief() {
  const { state, today, minutes } = useStudio();
  const { brief, ai } = useBrief();
  const [suggestion] = suggestedRoutines(state, { today, minutes });
  if (brief.kind === "closing" || !state.modules.assistant) return null;
  return (
    <Section title={t(brief.kind === "weekly" ? "brief.weekly" : "brief.morning")}>
      <Card className="space-y-3 p-4" data-help="morning-brief">
        {ai && <p className="font-medium">{brief.title}</p>}
        <BriefList brief={brief} />
        <Button size="sm" variant="secondary" icon={<MessageCircle size={16} />} onClick={() => openAssistant()}>
          {t("brief.ask")}
        </Button>
      </Card>
      {suggestion && (
        <Card className="space-y-2 p-4">
          <div className="min-w-0">
            <p className="text-sm text-text-secondary">{t("routine.suggested")}</p>
            <p className="font-medium leading-snug">{suggestion.routine.name}</p>
            <p className="text-sm text-text-secondary">{scheduleText(suggestion.routine)} · {suggestion.reason}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                dispatch({ type: "routine/add", routine: suggestion.routine }, { actor: "owner", source: "assistant" });
                showToast(t("assistant.routine.on", { name: suggestion.routine.name }), { label: t("common.undo"), run: undo });
              }}
            >
              {t("assistant.routine.switchOn")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "card/dismiss", id: `routine-${suggestion.routine.id}` })}>
              {t("assistant.notNow")}
            </Button>
          </div>
        </Card>
      )}
    </Section>
  );
}
