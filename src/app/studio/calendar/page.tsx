"use client";

import { usePairing } from "@/concept/studio/pairing/session";
import { PairedCalendar } from "@/concept/studio/pairing/calendar";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarOff, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, startOfWeek } from "@/concept/data/dates";
import { openingFor } from "@/concept/data/slots";
import type { StaffId } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatDayLong, formatDayMonth, formatNumber } from "@/concept/i18n/format";
import { dayBookings, utilisation } from "@/concept/selectors";
import { BookingSheets, type OpenSheet } from "@/concept/studio/booking/booking-sheets";
import { CalendarOverflow } from "@/concept/studio/calendar/filter";
import { DayGrid } from "@/concept/studio/calendar/day-grid";
import { WeekAgenda } from "@/concept/studio/calendar/week-agenda";
import { WeekGrid } from "@/concept/studio/calendar/week-grid";
import { staffViewer } from "@/concept/ops/access";
import { useRole } from "@/concept/ops/role";
import { PageHeader } from "@/concept/studio/page-header";
import { StaffDot } from "@/concept/studio/staff-dot";
import { useStudio } from "@/concept/studio/use-studio";
import { Badge } from "@/concept/ui/badge";
import { Button, ButtonLink, IconButton } from "@/concept/ui/button";
import { SegmentedControl } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";

type View = "day" | "week";

export default function CalendarPage() {
  const pairing = usePairing();
  const [local, setLocal] = useState(false);
  if (!pairing?.workspace) return <LocalCalendar />;
  const switchCalendar = <Button variant="secondary" onClick={() => setLocal(!local)}>
    {t(local ? "pair.calendar" : "pair.localCalendar")}
  </Button>;
  if (local) return <LocalCalendar switchCalendar={switchCalendar} />;
  return <>
    <PageHeader title={t("calendar.title")} actions={switchCalendar} />
    <PairedCalendar />
  </>;
}

function LocalCalendar({ switchCalendar }: { switchCalendar?: React.ReactNode }) {
  const { state, today } = useStudio();
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(today);
  const role = useRole();
  const viewer = role === "staff" ? staffViewer(state) : null;
  // A phone shows one person's day as a single timeline; two columns do not fit a narrow screen.
  const [chosenStaff, setStaffFilter] = useState<StaffId | "all">(() => (state.staff.length > 1 && window.matchMedia("(max-width: 639px)").matches ? state.staff[0].id : "all"));
  const [resourceId, setResourceId] = useState<string | undefined>();
  const [sheet, openSheet] = useState<OpenSheet>(null);
  // `?booking=<id>` (from "New since last time" or its toast) opens that visit on its day, once per link.
  const focus = useSearchParams()?.get("booking") ?? null;
  const [focused, setFocused] = useState<string | null>(null);
  if (focus !== focused) {
    setFocused(focus);
    const booking = focus ? state.bookings.find((b) => b.id === focus) : undefined;
    if (booking) {
      setDate(booking.date);
      setView("day");
      if (chosenStaff !== "all") setStaffFilter(booking.staffId);
      openSheet({ kind: "booking", id: booking.id });
    }
  }
  const setSheet = (next: OpenSheet) => {
    // Closing the visit drops the link, so the same notice can open it again.
    if (!next && focus) window.history.replaceState(window.history.state, "", window.location.pathname);
    openSheet(next);
  };
  const staffFilter = viewer?.id ?? chosenStaff;
  const staff = state.staff.filter((s) => staffFilter === "all" || s.id === staffFilter);
  const room = state.resources.some((r) => r.id === resourceId) ? resourceId : undefined;
  const closure = state.salon.closures.find((c) => c.date === date);
  const monday = startOfWeek(date);
  const step = view === "day" ? 1 : 7;
  const label = view === "day" ? formatDayLong(date) : `${formatDayMonth(monday)} – ${formatDayMonth(addDays(monday, 6))}`;
  const periodStart = view === "day" ? date : monday;
  const staffId = staffFilter === "all" ? undefined : staffFilter;
  const subtitle = room
    ? tc("calendar.bookingCount", Array.from({ length: step }, (_, day) => dayBookings(state, addDays(periodStart, day), staffId, room).length).reduce((sum, count) => sum + count, 0))
    : t("calendar.subtitle", { percent: formatNumber(utilisation(state, periodStart, step, staffId) * 100) });

  if (state.industry && !state.bookings.length) {
    return <>
      <PageHeader title={t("calendar.title")} actions={switchCalendar} />
      <EmptyState icon={<CalendarPlus size={22} />} title={t("setup.empty.calendar")}
        action={state.services.length
          ? <Button onClick={() => setSheet({ kind: "new", preset: { date, staffId: viewer?.id } })}>{t("calendar.newBooking")}</Button>
          : <ButtonLink href="/studio/more/services">{t("services.add")}</ButtonLink>} />
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>;
  }

  const staffControl = !viewer && state.staff.length > 1 && (
    <SegmentedControl<StaffId | "all">
      label={t("calendar.staff")}
      value={staffFilter}
      onChange={setStaffFilter}
      options={[{ value: "all", label: t("calendar.everyone") }, ...state.staff.map((s) => ({ value: s.id, label: s.firstName }))]}
    />
  );
  const chosenRoom = state.resources.find((r) => r.id === room);

  return (
    <>
      <PageHeader
        title={t("calendar.title")}
        subtitle={subtitle}
        actions={
          <>
            {switchCalendar}
            <Button data-help="new-booking" icon={<CalendarPlus size={18} />} onClick={() => setSheet({ kind: "new", preset: { date, staffId } })}>
              {t("calendar.newBooking")}
            </Button>
          </>
        }
      />
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h2 font-semibold">{label}</h2>
          {staffControl && staff.length === 1 && (
            <span className="inline-flex items-center gap-2 text-meta text-text-secondary xl:hidden"><StaffDot staffId={staff[0].id} />{staff[0].firstName}</span>
          )}
          {chosenRoom && <Badge>{chosenRoom.name}</Badge>}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center">
            <IconButton label={t("calendar.previous")} onClick={() => setDate(addDays(date, -step))}>
              <ChevronLeft size={20} aria-hidden />
            </IconButton>
            <IconButton label={t("calendar.next")} onClick={() => setDate(addDays(date, step))}>
              <ChevronRight size={20} aria-hidden />
            </IconButton>
          </div>
          <SegmentedControl<View>
            label={t("calendar.view")}
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: t("calendar.day") },
              { value: "week", label: t("calendar.week") },
            ]}
          />
          {staffControl && <div className="hidden min-w-0 xl:block">{staffControl}</div>}
          <CalendarOverflow rooms={state.resources} roomId={room} onRoom={setResourceId}
            onToday={() => setDate(today)} atToday={date === today && view === "day"}>
            {staffControl && <div className="space-y-2 xl:hidden">
              <p className="text-body font-medium">{t("calendar.staff")}</p>
              {staffControl}
            </div>}
          </CalendarOverflow>
        </div>
      </div>

      {view === "day" ? (
        openingFor(state.salon, date) ? (
          <DayGrid date={date} staff={staff} resourceId={room} onOpen={setSheet} />
        ) : (
          <EmptyState icon={<CalendarOff size={22} />} title={t("calendar.closed")} text={closure ? t("calendar.closedFor", { name: closure.name }) : t("calendar.closedText")} />
        )
      ) : (
        <>
          <div className="hidden lg:block">
            <WeekGrid monday={monday} staff={staff} resourceId={room} onOpen={setSheet} onPickDay={(d) => { setDate(d); setView("day"); }} />
          </div>
          <div className="lg:hidden">
            <WeekAgenda monday={monday} staff={staff} resourceId={room} onOpen={setSheet} />
          </div>
        </>
      )}
      {(view === "week" || openingFor(state.salon, date)) && <p className="mt-3 hidden text-sm text-text-secondary lg:block">{t("calendar.dragHint")}</p>}
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
