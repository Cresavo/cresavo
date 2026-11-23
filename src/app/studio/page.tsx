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
import { NextDayCustomer } from "@/concept/studio/today/next-customer";
import { Timeline } from "@/concept/studio/today/timeline";
import { TodayStats } from "@/concept/studio/today/today-stats";
import { useStudio } from "@/concept/studio/use-studio";
import { FirstSteps } from "@/concept/studio/onboarding/checklist";
import { SalonEntry, useDemoTour } from "@/concept/studio/onboarding/entry";
import { DemoTour } from "@/concept/studio/onboarding/tour";
import { Button, ButtonLink } from "@/concept/ui/button";
import { Card, Section } from "@/concept/ui/card";
import { EmptyState } from "@/concept/ui/empty-state";

function greeting(minutes: number, name?: string) {
  const part = minutes < 11 * 60 ? "morning" : minutes < 17 * 60 ? "afternoon" : "evening";
  // A new salon's owner may not have given a name; greet without one rather than with the salon's name.
  return name ? t(`today.greeting.${part}`, { name }) : t(`today.greeting.${part}.plain`);
}

/** One quiet line when there is no schedule to show; the header already says why. */
function DayStatus({ text }: { text: string }) {
  return (
    <Card surface="flat" className="flex items-center gap-3 text-text-secondary">
      <CalendarOff size={18} aria-hidden className="shrink-0" />
      <p>{text}</p>
    </Card>
  );
}

export default function TodayPage() {
  const { state, today, minutes } = useStudio();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const role = useRole();
  const tour = useDemoTour();
  const viewer = role === "staff" ? staffViewer(state) : null;
  const open = !!openingFor(state.salon, today);
  const off = !!viewer && !staffWorks(state, viewer.id, today);
  const count = dayBookings(state, today, viewer?.id).length;

  const empty = !!state.industry && !state.bookings.length;
  // Figures about the day only mean something once there are real bookings, not just examples.
  const hasRealBookings = state.bookings.some((booking) => !booking.example);
  const person = viewer ?? state.staff[0];
  const ownerName = person && person.firstName !== state.salon.name ? person.firstName : undefined;
  return (
    <>
      <PageHeader
        title={greeting(minutes, ownerName)}
        subtitle={`${formatDayLong(today)} · ${!open ? t("today.closed") : off ? t("today.dayOff") : tc("today.bookingCount", count)}`}
        actions={
          !empty && <Button icon={<Phone size={18} />} onClick={() => setSheet({ kind: "phone" })}>
            {t("today.phoneMode")}
          </Button>
        }
      />
      {role === "owner" && state.industry && <FirstSteps />}
      {/* The day is the page: the schedule in the main column with the next customer inside it, and the morning
          brief beside it on a wide screen. Spacing and a few hairlines group things; nothing sits in a card. */}
      {empty ? <EmptyState icon={<CalendarOff size={22} />} title={t("setup.empty.today")} action={<ButtonLink href={state.services.length ? "/studio/calendar" : "/studio/more/services"}>{t(state.services.length ? "nav.calendar" : "services.add")}</ButtonLink>} /> : <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_clamp(18rem,28vw,24rem)] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-8">
          {role === "owner" && !state.industry && tour.open && <DemoTour close={tour.close} />}
          {/* On a phone the day comes first; the day's figures follow it. */}
          {open && !viewer && hasRealBookings && <div className="max-lg:order-last"><TodayStats /></div>}
          <Section title={t("today.schedule")}>
            {!open ? (
              <DayStatus text={t("today.closed")} />
            ) : off && count === 0 ? (
              <DayStatus text={t("today.dayOff")} />
            ) : (
              <Timeline date={today} staffId={viewer?.id} onOpen={setSheet} />
            )}
          </Section>
          <NextDayCustomer staffId={viewer?.id} onOpen={setSheet} />
        </div>
        <div className="min-w-0 space-y-8">
          <NeedsMoving staffId={viewer?.id} onOpen={setSheet} />
          {!viewer && hasRealBookings && <EveningSummary />}
          {!viewer && <Attention onOpen={setSheet} />}
        </div>
      </div>}
      {role === "owner" && (state.industry ? <SalonEntry /> : <SalonEntry onExplore={tour.start} exploreRef={tour.explore} />)}
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
