"use client";

import { t } from "../../i18n";
import { Card, Section } from "../../ui/card";
import { BriefList } from "../assistant/brief-list";
import { useBrief } from "../assistant/use-brief";
import type { OpenSheet } from "../booking/booking-sheets";
import { useStudio } from "../use-studio";
import { Suggestions } from "./suggestions";

// What the brief would repeat: Today already shows the day's bookings and free
// slots, bookings to move have their own card, and replies, stock, return
// visits and holidays come as suggestions with a button right below.
const ON_TODAY = ["bookings", "gaps", "needs-moving", "inbox", "stock", "due-back", "holiday"];
const onToday = (id: string) => ON_TODAY.some((topic) => id === topic || id.startsWith(`${topic}-`));

/**
 * One card for everything that wants the owner's attention: first what the brief has to say that the page does
 * not already show (morning, or Monday's weekly review; rules pick the items, AI may only phrase them), then
 * the suggestions with their actions. Routines are suggested under More → Routines, not here.
 */
export function Attention({ onOpen }: { onOpen: (sheet: OpenSheet) => void }) {
  const { state } = useStudio();
  const { brief, ai } = useBrief();
  const briefing = brief.kind !== "closing" && state.modules.assistant;
  const news = briefing ? brief.items.filter((item) => brief.kind !== "morning" || !onToday(item.id)) : [];
  return (
    <Section title={briefing ? t(brief.kind === "weekly" ? "brief.weekly" : "brief.morning") : t("today.suggestions")}>
      <Card surface="flat" className="-mx-4" data-help={briefing ? "morning-brief" : undefined}>
        {ai && <p className="px-4 py-3 font-medium">{brief.title}</p>}
        {news.length > 0 && <BriefList brief={{ ...brief, items: news }} inset />}
        <Suggestions onOpen={onOpen} silent={news.length > 0} />
      </Card>
    </Section>
  );
}
