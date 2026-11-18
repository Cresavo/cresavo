"use client";

import { t } from "../../i18n";
import { Card, Section } from "../../ui/card";
import { BriefList } from "../assistant/brief-list";
import { useBrief } from "../assistant/use-brief";
import { useStudio } from "../use-studio";

/** The brief on Today (morning, Monday's weekly review). Rules pick the items; AI may only phrase them. Routines are suggested under More → Routines, not here. */
export function MorningBrief() {
  const { state } = useStudio();
  const { brief, ai } = useBrief();
  if (brief.kind === "closing" || !state.modules.assistant) return null;
  return (
    <Section title={t(brief.kind === "weekly" ? "brief.weekly" : "brief.morning")}>
      <Card className="space-y-3 p-4" data-help="morning-brief">
        {ai && <p className="font-medium">{brief.title}</p>}
        <BriefList brief={brief} />
      </Card>
    </Section>
  );
}
