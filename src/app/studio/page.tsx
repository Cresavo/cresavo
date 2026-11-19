"use client";

import { useState } from "react";
import { CalendarOff, Phone } from "lucide-react";
import { openingFor, staffWorks } from "@/concept/data/slots";
import { t, tc } from "@/concept/i18n";
import { formatDayLong } from "@/concept/i18n/format";
import { dayBookings } from "@/concept/selectors";
import { BookingSheets, type OpenSheet } from "@/concept/studio/booking/booking-sheets";
import { staffViewer } from "@/concept/ops/access";
import { useRole } from "@/concept/ops/role";
import { NeedsMoving } from "@/concept/studio/today/needs-moving";
import { PageHeader } from "@/concept/studio/page-header";
import { EveningSummary } from "@/concept/studio/today/evening-summary";
import { Attention } from "@/concept/studio/today/attention";
import { NextCustomer } from "@/concept/studio/today/next-customer";
import { Timeline } from "@/concept/studio/today/timeline";
import { TodayStats } from "@/concept/studio/today/today-stats";
import { useStudio } from "@/concept/studio/use-studio";
import { FirstSteps } from "@/concept/studio/onboarding/checklist";
import { SalonEntry } from "@/concept/studio/onboarding/entry";
import { Button, ButtonLink } from "@/concept/ui/button";
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
  const off = !!viewer && !staffWorks(state, viewer.id, today);
  const count = dayBookings(state, today, viewer?.id).length;

  const empty = !!state.industry && !state.bookings.length;
  return (
    <>
      <PageHeader
        title={greeting(minutes, viewer?.firstName ?? state.staff[0].firstName)}
        subtitle={`${formatDayLong(today)} · ${!open ? t("today.closed") : off ? t("today.dayOff") : tc("today.bookingCount", count)}`}
        actions={
          !empty && <Button icon={<Phone size={18} />} onClick={() => setSheet({ kind: "phone" })}>
            {t("today.phoneMode")}
          </Button>
        }
      />
      {role === "owner" && <>
        {!state.industry && <SalonEntry today />}
        {state.industry && <FirstSteps />}
      </>}
      {/* The next customer comes first, then the day's schedule. */}
      {empty ? <EmptyState icon={<CalendarOff size={22} />} title={t("setup.empty.today")} action={<ButtonLink href={state.services.length ? "/studio/calendar" : "/studio/more/services"}>{t(state.services.length ? "nav.calendar" : "services.add")}</ButtonLink>} /> : <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(20rem,30vw,26rem)] lg:gap-8">
        <div className="min-w-0 space-y-6">
          <NextCustomer staffId={viewer?.id} onOpen={setSheet} />
          {open && !viewer && <TodayStats />}
          <Section title={t("today.schedule")}>
            {!open ? (
              <EmptyState icon={<CalendarOff size={22} />} title={t("today.closed")} text={t("today.closedText")} />
            ) : off && count === 0 ? (
              <EmptyState icon={<CalendarOff size={22} />} title={t("today.dayOff")} />
            ) : (
              <Timeline date={today} staffId={viewer?.id} onOpen={setSheet} />
            )}
          </Section>
        </div>
        <div className="min-w-0 space-y-6">
          <NeedsMoving staffId={viewer?.id} onOpen={setSheet} />
          {!viewer && <EveningSummary />}
          {!viewer && <Attention onOpen={setSheet} />}
        </div>
      </div>}
      {state.industry && role === "owner" && <SalonEntry />}
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
