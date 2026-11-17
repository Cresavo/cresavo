"use client";

import { useState } from "react";
import { CalendarOff, CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, startOfWeek } from "@/concept/data/dates";
import { openingFor } from "@/concept/data/slots";
import type { StaffId } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { formatDayLong, formatDayMonth, formatNumber } from "@/concept/i18n/format";
import { utilisation } from "@/concept/selectors";
import { BookingSheets, type OpenSheet } from "@/concept/studio/booking/booking-sheets";
import { CalendarFilter } from "@/concept/studio/calendar/filter";
import { DayGrid } from "@/concept/studio/calendar/day-grid";
import { WeekAgenda } from "@/concept/studio/calendar/week-agenda";
import { WeekGrid } from "@/concept/studio/calendar/week-grid";
import { staffViewer } from "@/concept/ops/access";
import { useRole } from "@/concept/ops/role";
import { PageHeader } from "@/concept/studio/page-header";
import { useStudio } from "@/concept/studio/use-studio";
import { Button, IconButton } from "@/concept/ui/button";
import { Segmented } from "@/concept/ui/controls";
import { EmptyState } from "@/concept/ui/empty-state";

type View = "day" | "week";

export default function CalendarPage() {
  const { state, today } = useStudio();
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(today);
  const role = useRole();
  const viewer = role === "staff" ? staffViewer(state) : null;
  const [chosenStaff, setStaffFilter] = useState<StaffId | "all">("all");
  const [resourceId, setResourceId] = useState<string | undefined>();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const staffFilter = viewer?.id ?? chosenStaff;
  const staff = state.staff.filter((s) => staffFilter === "all" || s.id === staffFilter);
  const room = state.resources.some((r) => r.id === resourceId) ? resourceId : undefined;
  const closure = state.salon.closures.find((c) => c.date === date);
  const monday = startOfWeek(date);
  const step = view === "day" ? 1 : 7;
  const label = view === "day" ? formatDayLong(date) : `${formatDayMonth(monday)} – ${formatDayMonth(addDays(monday, 6))}`;
  const busy = utilisation(state, view === "day" ? date : monday, view === "day" ? 1 : 7, staffFilter === "all" ? undefined : staffFilter);

  return (
    <>
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle", { percent: formatNumber(busy * 100) })}
        actions={
          <Button data-help="new-booking" icon={<CalendarPlus size={18} />} onClick={() => setSheet({ kind: "new", preset: { date } })}>
            {t("calendar.newBooking")}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <IconButton label={t("calendar.previous")} onClick={() => setDate(addDays(date, -step))}>
            <ChevronLeft size={20} />
          </IconButton>
          <Button variant="secondary" size="sm" onClick={() => setDate(today)}>{t("date.today")}</Button>
          <IconButton label={t("calendar.next")} onClick={() => setDate(addDays(date, step))}>
            <ChevronRight size={20} />
          </IconButton>
          <span className="ml-1 font-medium">{label}</span>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <Segmented<View>
            label={t("calendar.view")}
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: t("calendar.day") },
              { value: "week", label: t("calendar.week") },
            ]}
          />
          {(!viewer || state.resources.length > 0) && (
            <CalendarFilter
              staff={viewer ? [] : state.staff}
              staffId={staffFilter}
              onStaff={setStaffFilter}
              rooms={state.resources}
              roomId={room}
              onRoom={setResourceId}
            />
          )}
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
      <p className="mt-3 hidden text-sm text-text-secondary lg:block">{t("calendar.dragHint")}</p>
      <BookingSheets sheet={sheet} onChange={setSheet} />
    </>
  );
}
