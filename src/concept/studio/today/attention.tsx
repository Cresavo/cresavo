"use client";

import { t } from "../../i18n";
import { Section } from "../../ui/card";
import { BriefList } from "../assistant/brief-list";
import { useBrief } from "../assistant/use-brief";
import type { OpenSheet } from "../booking/booking-sheets";
import { useStudio } from "../use-studio";
import { Suggestions } from "./suggestions";

// The morning brief has its own card on Today and the evening summary closes the day,
// so only Monday's weekly review is left for this list.
const PHRASED = ["weekly"] as const;

/**
 * One list for everything that wants the owner's attention: Monday's weekly review when there is one (rules pick
 * the items, AI may only phrase them), then the suggestions with their actions. Routines are suggested under
 * More → Routines, not here.
 */
export function Attention({ onOpen }: { onOpen: (sheet: OpenSheet) => void }) {
  const { state } = useStudio();
  const { brief, ai } = useBrief(PHRASED);
  const weekly = brief.kind === "weekly" && state.modules.assistant;
  const news = weekly ? brief.items : [];
  return (
    <Section title={t(weekly ? "brief.weekly" : "today.suggestions")}>
      <div className="space-y-1" data-help={weekly ? "weekly-brief" : undefined}>
        {weekly && ai && <p className="py-3 font-medium">{brief.title}</p>}
        {news.length > 0 && <BriefList brief={{ ...brief, items: news }} />}
        <Suggestions onOpen={onOpen} silent={news.length > 0} />
      </div>
    </Section>
  );
}
