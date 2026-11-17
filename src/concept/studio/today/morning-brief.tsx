"use client";

import { MessageCircle, Repeat, Sparkles, Sun } from "lucide-react";
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
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-eko-accent-soft text-eko-accent"><Sun size={18} /></span>
          <p className="min-w-0 flex-1 pt-1.5 font-medium">{ai ? brief.title : t("brief.intro")}</p>
          {ai && <Sparkles size={16} className="mt-1 shrink-0 text-eko-accent" aria-label={t("assistant.source.ai")} />}
        </div>
        <BriefList brief={brief} />
        <Button size="sm" variant="secondary" icon={<MessageCircle size={16} />} onClick={() => openAssistant()}>
          {t("brief.ask")}
        </Button>
      </Card>
      {suggestion && (
        <Card className="space-y-2 p-4">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-eko-accent-soft text-eko-accent"><Repeat size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-eko-accent">{t("routine.suggested")}</p>
              <p className="font-medium leading-snug">{suggestion.routine.name}</p>
              <p className="text-sm text-eko-muted">{scheduleText(suggestion.routine)} · {suggestion.reason}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-12">
            <Button
              size="sm"
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
