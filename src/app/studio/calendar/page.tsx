"use client";

import { usePairing } from "@/concept/studio/pairing/session";
import { PairedCalendar } from "@/concept/studio/pairing/calendar";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarOff, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, isDateKey, startOfWeek } from "@/concept/data/dates";
import { openingFor } from "@/concept/data/slots";
import type { StaffId } from "@/concept/data/types";
import { t, tc } from "@/concept/i18n";
import { formatDayLong, formatDayMonth, formatNumber } from "@/concept/i18n/format";
import { dayBookings, utilisation } from "@/concept/selectors";
import { BookingSheets, type OpenSheet } from "@/concept/studio/booking/booking-sheets";
import { CalendarOverflow } from "@/concept/studio/calendar/filter";
import { DayGrid } from "@/concept/studio/calendar/day-grid";
import { MonthReveal } from "@/concept/studio/calendar/month-reveal";
import { CalendarOfflineNote, useCalendarOffline } from "@/concept/studio/calendar/offline-note";
import { dropCalendarDateLink, useRequestedCalendarDay } from "@/concept/studio/calendar/show-day";
import { CalendarPreview } from "@/concept/studio/calendar/preview";
import { CalendarShortcuts } from "@/concept/studio/calendar/shortcuts";
import { WeekAgenda } from "@/concept/studio/calendar/week-agenda";
import { WeekGrid } from "@/concept/studio/calendar/week-grid";
import { canChangeBooking, staffViewer } from "@/concept/ops/access";
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
  const params = useSearchParams();
  const bookingLink = params?.get("booking");
  const dateLink = params?.get("date");
  const [local, setLocal] = useState(!!bookingLink || !!(dateLink && isDateKey(dateLink)));
  const [openedLink, setOpenedLink] = useState(bookingLink);
  const [openedDate, setOpenedDate] = useState(dateLink && isDateKey(dateLink) ? dateLink : null);
  const [requestedDate, setRequestedDate] = useState<string | null>(null);
  // Search also announces the day directly, so a sticky ?date= still opens the local board.
  useRequestedCalendarDay((date) => {
    setRequestedDate(date);
    setOpenedDate(date);
    setLocal(true);
  });
  // A notice must open the local visit even when a paired calendar is the usual view.
  if (bookingLink && bookingLink !== openedLink) {
    setOpenedLink(bookingLink);
    setLocal(true);
  }
  // A search for a day does the same: the paired calendar does not read ?date=.
  if (dateLink && isDateKey(dateLink) && dateLink !== openedDate) {
    setOpenedDate(dateLink);
    setLocal(true);
  } else if (!dateLink && openedDate) {
    // The date is dropped from the URL after it is applied, so the same day can be searched again.
    setOpenedDate(null);
  }
  if (!pairing?.workspace) return <LocalCalendar requestedDate={requestedDate} />;
  const switchCalendar = <Button variant="secondary" onClick={() => setLocal(!local)}>
    {t(local ? "pair.calendar" : "pair.localCalendar")}
  </Button>;
  if (local) return <LocalCalendar switchCalendar={switchCalendar} requestedDate={requestedDate} />;
  return <>
    <PageHeader title={t("calendar.title")} actions={switchCalendar} />
    <PairedCalendar />
  </>;
}

function LocalCalendar({ switchCalendar, requestedDate }: { switchCalendar?: React.ReactNode; requestedDate?: string | null }) {
  const { state, today, target } = useStudio();
  // A signed-in salon without a connection: the board as last read, and new bookings wait for the connection.
  const { offline, readAt } = useCalendarOffline(target?.workspace === "account");
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
    // Staff view only opens their own visits; a crafted link must not show someone else's sheet.
    if (booking && canChangeBooking(state, role, booking.id)) {
      setDate(booking.date);
      setView("day");
      if (chosenStaff !== "all") setStaffFilter(booking.staffId);
      openSheet({ kind: "booking", id: booking.id });
    }
  }
  // `?date=<day>` (from Search) shows that day. The param is then dropped so the same day can be
  // searched again after the owner has moved on with the calendar controls.
  const dayLink = useSearchParams()?.get("date") ?? null;
  const [shownLink, setShownLink] = useState<string | null>(null);
  if (dayLink !== shownLink) {
    setShownLink(dayLink);
    if (dayLink && isDateKey(dayLink)) {
      setDate(dayLink);
      setView("day");
    }
  }
  // A later search for the same day also arrives as an event when the address still has ?date=
  // (router.replace can leave it there, after which router.push is a no-op).
  useRequestedCalendarDay((next) => {
    setDate(next);
    setView("day");
  });
  const [appliedRequest, setAppliedRequest] = useState<string | null>(null);
  if (requestedDate && isDateKey(requestedDate) && requestedDate !== appliedRequest) {
    // Opening the local board for a search while a paired calendar was showing.
    setAppliedRequest(requestedDate);
    setDate(requestedDate);
    setView("day");
  }
  useEffect(() => {
    if (!dayLink || !isDateKey(dayLink)) return;
    dropCalendarDateLink();
  }, [dayLink]);
  const setSheet = (next: OpenSheet) => {
    // A free spot in the grid opens a new booking too; it waits like the button while offline.
    if (offline && next?.kind === "new") return;
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
          ? <Button data-help-id="calendar.new-booking" disabled={offline} onClick={() => setSheet({ kind: "new", preset: { date, staffId: viewer?.id } })}>{t("calendar.newBooking")}</Button>
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
            <Button data-help="new-booking" data-help-id="calendar.new-booking" disabled={offline} icon={<CalendarPlus size={18} />} onClick={() => setSheet({ kind: "new", preset: { date, staffId } })}>
              {t("calendar.newBooking")}
            </Button>
          </>
        }
      />
      <CalendarOfflineNote offline={offline} readAt={readAt} today={today} />
      <MonthReveal date={date} today={today} onPick={setDate}
        info={(day) => {
          const count = dayBookings(state, day, staffId, room).length;
          return { mark: count > 0, note: count ? tc("calendar.bookingCount", count) : undefined };
        }}
        heading={<>
          <h2 className="text-h2 font-semibold">{label}</h2>
          {staffControl && staff.length === 1 && (
            <span className="inline-flex items-center gap-2 text-meta text-text-secondary xl:hidden"><StaffDot staffId={staff[0].id} />{staff[0].firstName}</span>
          )}
          {chosenRoom && <Badge>{chosenRoom.name}</Badge>}
        </>}
        toolbar={
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex shrink-0 items-center">
            <IconButton data-help-id="calendar.previous" label={t("calendar.previous")} onClick={() => setDate(addDays(date, -step))}>
              <ChevronLeft size={20} aria-hidden />
            </IconButton>
            <IconButton data-help-id="calendar.next" label={t("calendar.next")} onClick={() => setDate(addDays(date, step))}>
              <ChevronRight size={20} aria-hidden />
            </IconButton>
          </div>
          <SegmentedControl<View>
            label={t("calendar.view")}
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: t("calendar.day"), helpId: "calendar.view-day" },
              { value: "week", label: t("calendar.week"), helpId: "calendar.view-week" },
            ]}
          />
          {staffControl && <div className="studio-calendar-staff hidden min-w-0 xl:block">{staffControl}</div>}
          <CalendarOverflow rooms={state.resources} roomId={room} onRoom={setResourceId}
            onToday={() => setDate(today)} atToday={date === today && view === "day"}>
            {staffControl && <div className="studio-calendar-staff-menu space-y-2 xl:hidden">
              <p className="text-body font-medium">{t("calendar.staff")}</p>
              {staffControl}
            </div>}
          </CalendarOverflow>
          <CalendarShortcuts label={label} onPrevious={() => setDate(addDays(date, -step))} onNext={() => setDate(addDays(date, step))} onToday={() => setDate(today)} />
        </div>} />

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
      <CalendarPreview />
      <BookingSheets sheet={sheet} onChange={setSheet} dock />
    </>
  );
}
