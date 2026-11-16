"use client";

import { useState } from "react";
import { CalendarOff, Phone } from "lucide-react";
import { openingFor } from "@/concept/data/slots";
import { t, tc } from "@/concept/i18n";
import { formatDayLong } from "@/concept/i18n/format";
import { dayBookings } from "@/concept/selectors";
import { BookingSheets, type OpenSheet } from "@/concept/studio/booking/booking-sheets";
import { PageHeader } from "@/concept/studio/page-header";
import { NextCustomer } from "@/concept/studio/today/next-customer";
import { Suggestions } from "@/concept/studio/today/suggestions";
import { Timeline } from "@/concept/studio/today/timeline";
import { TodayStats } from "@/concept/studio/today/today-stats";
import { useStudio } from "@/concept/studio/use-studio";
import { Button } from "@/concept/ui/button";
import { Section } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

function greeting(minutes: number) {
  if (minutes < 11 * 60) return t("today.greeting.morning", { name: "Anna" });
  if (minutes < 17 * 60) return t("today.greeting.afternoon", { name: "Anna" });
  return t("today.greeting.evening", { name: "Anna" });
}

export default function TodayPage() {
  const { state, today, minutes } = useStudio();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const open = !!openingFor(state.salon, today);
  const count = dayBookings(state, today).length;

  return (
    <>
      <PageHeader
        title={greeting(minutes)}
        subtitle={`${formatDayLong(today)} · ${open ? tc("today.bookingCount", count) : t("today.closed")}`}
        actions={
          <Button size="lg" icon={<Phone size={18} />} onClick={() => setSheet({ kind: "phone" })}>
            {t("today.phoneMode")}
          </Button>
        }
      />
      <div className="space-y-6">
        {open && <TodayStats />}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="order-last min-w-0 lg:order-none">
            <Section title={t("today.schedule")}>
              {open ? (
                <Timeline date={today} onOpen={setSheet} />
              ) : (
                <EmptyState icon={<CalendarOff size={22} />} title={t("today.closed")} text={t("today.closedText")} />
              )}
            </Section>
          </div>
          <div className="min-w-0 space-y-6">
            <NextCustomer onOpen={setSheet} />
            <Section title={t("today.suggestions")}>
              <Suggestions onOpen={setSheet} />
            </Section>
          </div>
        </div>
      </div>
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
