"use client";

import { formatTime } from "../../i18n/format";
import type { DragEvent, MouseEvent } from "react";
import { lunchFor, openingFor, workWindow } from "../../data/slots";
import type { DateKey, Staff } from "../../data/types";
import { t, tc } from "../../i18n";
import { dayBookings } from "../../selectors";
import { cx } from "../../ui/cx";
import { Badge } from "../../ui/badge";
import { showActionFailure } from "../../ui/toast";
import type { OpenSheet } from "../booking/booking-sheets";
import { commitWithUndoToast } from "../log/commit-toast";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";
import { BookingBlock, DRAG_TYPE } from "./block";
import { calendarScale, HourLines, TimeAxis } from "./time-axis";

const PX_PER_MIN = 1.25;
const WARNING_BLOCK_HEIGHT = 64;

const snap = (minutes: number) => Math.floor(minutes / 15) * 15;

/** "3 bookings", or what is wrong when the person is not working but has bookings left. */
function dayHeading(count: number, works: boolean) {
  if (works) return tc("calendar.bookingCount", count);
  return count ? tc("calendar.offToMove", count) : t("calendar.off");
}

/** One column per staff member for a single day. Tap a free spot to book, drag a booking to move it. */
export function DayGrid({ date, staff, resourceId, onOpen }: { date: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes, target } = useStudio();
  const hours = openingFor(state.salon, date)!;
  const lunch = lunchFor(state.salon, date);
  const { open: from, close: to } = hours;
  const columns = staff.map(person => {
    const shift = workWindow(state, person.id, date);
    const entries = dayBookings(state, date, person.id, resourceId).map(booking => ({
      booking,
      misfit: !shift || booking.start < shift.start || booking.start + booking.duration > shift.end,
    }));
    return { person, shift, entries };
  });
  const entries = columns.flatMap(column => column.entries);
  const scale = calendarScale(
    calendarScale(PX_PER_MIN, entries.map(({ booking }) => booking)),
    entries.filter(({ misfit }) => misfit).map(({ booking }) => booking),
    WARNING_BLOCK_HEIGHT,
  );
  const height = (to - from) * scale;
  const minuteAt = (event: { clientY: number; currentTarget: Element }) =>
    snap(from + (event.clientY - event.currentTarget.getBoundingClientRect().top) / scale);

  const onColumnClick = (person: Staff) => (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onOpen({ kind: "new", preset: { staffId: person.id, date, start: minuteAt(event) } });
  };

  const onDrop = (person: Staff) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const id = event.dataTransfer.getData(DRAG_TYPE);
    const booking = state.bookings.find((b) => b.id === id);
    if (!booking) return;
    if (booking.staffId !== person.id) {
      const name = state.staff.find((s) => s.id === booking.staffId)!.firstName;
      showActionFailure("reference.sameStaffOnly", undefined, "studio", t("calendar.sameStaffOnly", { name }));
      return;
    }
    const start = minuteAt(event);
    const moved = target ? commitWithUndoToast(target, { type: "booking/move", id, date, start }, t("calendar.movedTo", { time: formatTime(start) })).then((result) => result.ok, () => false) : Promise.resolve(false);
    void moved.then((ok) => { if (!ok) showActionFailure("calendar.slotTaken"); });
  };

  return (
    <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-hairline">
      <div className="studio-calendar-grid studio-calendar-day" style={{ "--calendar-columns": columns.length } as React.CSSProperties}>
        <div className="flex border-b border-hairline">
          <div className="w-11 shrink-0" />
          {columns.map(({ person, shift, entries }) => (
            <div key={person.id} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-3 py-3 text-body">
              <StaffDot staffId={person.id} />
              <span className="truncate font-medium">{person.firstName}</span>
              <Badge tone={shift ? "neutral" : "warn"}>
                {dayHeading(entries.length, !!shift)}
              </Badge>
            </div>
          ))}
        </div>
        <div className="flex py-3 pr-1">
          <TimeAxis from={from} to={to} pxPerMin={scale} />
          {columns.map(({ person, shift, entries }) => {
            const works = shift !== null;
            return (
              <div
                key={person.id}
                onClick={works ? onColumnClick(person) : undefined}
                onDragOver={(event) => works && event.preventDefault()}
                onDrop={works ? onDrop(person) : undefined}
                className={cx("relative min-w-0 flex-1 border-l border-hairline", works ? "cursor-copy" : "bg-surface-2/70")}
                style={{ height }}
              >
                <HourLines from={from} to={to} pxPerMin={scale} />
                {shift && shift.start > from && <div className="pointer-events-none absolute inset-x-0 top-0 bg-surface-2/70" style={{ height: (shift.start - from) * scale }} />}
                {shift && shift.end < to && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface-2/70" style={{ height: (to - shift.end) * scale }} />}
                {lunch && works && (
                  <div
                    className="pointer-events-none absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--ui-border)_6px_7px)] text-minimum text-text-secondary"
                    style={{ top: (lunch.start - from) * scale, height: (lunch.end - lunch.start) * scale }}
                  >
                    {t("calendar.lunch")}
                  </div>
                )}
                {entries.map(({ booking, misfit }) => (
                  <BookingBlock
                    key={booking.id}
                    booking={booking}
                    misfit={misfit}
                    top={(booking.start - from) * scale + 1}
                    height={booking.duration * scale - 2}
                    scale={scale}
                    onOpen={() => onOpen({ kind: "booking", id: booking.id })}
                    onGapOpen={(start) => onOpen({ kind: "new", preset: { staffId: person.id, date, start } })}
                  />
                ))}
                {date === today && minutes > from && minutes < to && (
                  <div className="pointer-events-none absolute inset-x-0 z-sticky border-t-2 border-danger" style={{ top: (minutes - from) * scale }}>
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-danger" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
