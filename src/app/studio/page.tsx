"use client";

import { useState } from "react";
import { CalendarOff, Phone } from "lucide-react";
import { openingFor } from "@/concept/data/slots";
import { t, tc } from "@/concept/i18n";
import { formatDayLong } from "@/concept/i18n/format";
import { dayBookings } from "@/concept/selectors";
import { BookingSheets, type OpenSheet } from "@/concept/studio/booking/booking-sheets";
import { staffViewer } from "@/concept/ops/access";
import { useRole } from "@/concept/ops/role";
import { NeedsMoving } from "@/concept/studio/today/needs-moving";
import { PageHeader } from "@/concept/studio/page-header";
import { EveningSummary } from "@/concept/studio/today/evening-summary";
import { MorningBrief } from "@/concept/studio/today/morning-brief";
import { NextCustomer } from "@/concept/studio/today/next-customer";
import { Suggestions } from "@/concept/studio/today/suggestions";
import { Timeline } from "@/concept/studio/today/timeline";
import { TodayStats } from "@/concept/studio/today/today-stats";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Section } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

function greeting(minutes: number, name: string) {
  if (minutes < 11 * 60) return t("today.greeting.morning", { name });
  if (minutes < 17 * 60) return t("today.greeting.afternoon", { name });
  return t("today.greeting.evening", { name });
}

export default function TodayPage() {
  const { state, today, minutes } = useStudio();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const role = useRole();
  const viewer = role === "staff" ? staffViewer(state) : null;
  const open = !!openingFor(state.salon, today);
  const count = dayBookings(state, today, viewer?.id).length;

  return (
    <>
      <PageHeader
        title={greeting(minutes, viewer?.firstName ?? "Anna")}
        subtitle={`${formatDayLong(today)} · ${open ? tc("today.bookingCount", count) : t("today.closed")}`}
        actions={
          <Button size="lg" icon={<Phone size={18} />} onClick={() => setSheet({ kind: "phone" })}>
            {t("today.phoneMode")}
          </Button>
        }
      />
      <div className="space-y-6">
        {open && !viewer && <TodayStats />}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="order-last min-w-0 lg:order-none">
            <Section title={t("today.schedule")}>
              {open ? (
                <Timeline date={today} staffId={viewer?.id} onOpen={setSheet} />
              ) : (
                <EmptyState icon={<CalendarOff size={22} />} title={t("today.closed")} text={t("today.closedText")} />
              )}
            </Section>
          </div>
          <div className="min-w-0 space-y-6">
            {!viewer && <EveningSummary />}
            {!viewer && <MorningBrief />}
            <NeedsMoving staffId={viewer?.id} onOpen={setSheet} />
            <NextCustomer staffId={viewer?.id} onOpen={setSheet} />
            {!viewer && (
              <Section title={t("today.suggestions")}>
                <Suggestions onOpen={setSheet} />
              </Section>
            )}
          </div>
        </div>
      </div>
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
