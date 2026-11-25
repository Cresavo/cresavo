"use client";

import { formatDayLong, formatTime } from "../../i18n/format";
import { useState, type DragEvent, type MouseEvent } from "react";
import { addDays } from "../../data/dates";
import { lunchFor, openingFor, workWindow } from "../../data/slots";
import type { DateKey, Interval, Staff } from "../../data/types";
import { t, tc } from "../../i18n";
import { dayBookings } from "../../selectors";
import { cx } from "../../ui/cx";
import { Badge } from "../../ui/badge";
import { showToast } from "../../ui/toast";
import type { OpenSheet } from "../booking/booking-sheets";
import { StaffDot } from "../staff-dot";
import { useStudio } from "../use-studio";
import { BookingBlock, DRAG_TYPE } from "./block";
import { carriesBooking, useBookingDrop } from "./drop";
import { snapMinutes } from "./gap";
import { calendarRange, calendarScale, HourLines, NowLine, TimeAxis, useTextScale } from "./time-axis";

const PX_PER_MIN = 1.25;
const WARNING_BLOCK_HEIGHT = 64;


/** "3 bookings", or what is wrong when the person is not working but has bookings left. */
function dayHeading(count: number, works: boolean) {
  if (works) return tc("calendar.bookingCount", count);
  return count ? tc("calendar.offToMove", count) : t("calendar.off");
}

/** One column per staff member for a single day. Tap a free spot to book, drag a booking to move it. */
export function DayGrid({ date, staff, resourceId, onOpen }: { date: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void }) {
  const { state, today, minutes } = useStudio();
  const drop = useBookingDrop();
  const text = useTextScale();
  // While a booking is dragged, the header offers the day before and after, keeping the time.
  const [dragging, setDragging] = useState(false);
  const hours = openingFor(state.salon, date)!;
  const lunch = lunchFor(state.salon, date);
  const { open, close } = hours;
  const columns = staff.map(person => {
    const shift = workWindow(state, person.id, date);
    const entries = dayBookings(state, date, person.id, resourceId).map(booking => ({
      booking,
      misfit: !shift || booking.start < shift.start || booking.start + booking.duration > shift.end,
    }));
    return { person, shift, entries };
  });
  const entries = columns.flatMap(column => column.entries);
  const { from, to } = calendarRange(open, close, entries.map(({ booking }) => booking));
  const scale = calendarScale(
    calendarScale(PX_PER_MIN * text, entries.map(({ booking }) => booking), 44 * text),
    entries.filter(({ misfit }) => misfit).map(({ booking }) => booking),
    WARNING_BLOCK_HEIGHT * text,
  );
  const height = (to - from) * scale;
  const minuteAt = (event: { clientY: number; currentTarget: Element }) =>
    snapMinutes(from + (event.clientY - event.currentTarget.getBoundingClientRect().top) / scale);

  // The shaded hours and lunch cannot be booked, so a tap there says why instead of opening a form that cannot be confirmed.
  const onColumnClick = (person: Staff, shift: Interval) => (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const start = minuteAt(event);
    if (start < shift.start || start >= shift.end) {
      showToast(t("calendar.outsideShift", { name: person.firstName, from: formatTime(shift.start), to: formatTime(shift.end) }));
    } else if (lunch && start >= lunch.start && start < lunch.end) {
      showToast(t("calendar.lunchClosed", { from: formatTime(lunch.start), to: formatTime(lunch.end) }));
    } else {
      onOpen({ kind: "new", preset: { staffId: person.id, date, start } });
    }
  };

  const onDrop = (person: Staff) => (event: DragEvent<HTMLDivElement>) => {
    setDragging(false);
    drop(event, person.id, date, minuteAt(event));
  };

  return (
    <div className="overflow-x-auto"
      onDragStart={(event) => {
        // Changing the page inside dragstart can cancel the drag in Chromium, so the targets appear a frame later.
        if (carriesBooking(event)) requestAnimationFrame(() => setDragging(true));
      }} onDragEnd={() => setDragging(false)}>
      <div className="studio-calendar-grid studio-calendar-day" style={{ "--calendar-columns": columns.length } as React.CSSProperties}>
        <div className="relative flex border-b border-hairline">
          {dragging && <NextDayTargets date={date} onDrop={() => setDragging(false)} />}
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
        <div className="relative flex py-3 pr-1">
          <TimeAxis from={from} to={to} pxPerMin={scale} />
          {columns.map(({ person, shift, entries }) => {
            const works = shift !== null;
            return (
              <div
                key={person.id}
                onClick={shift ? onColumnClick(person, shift) : undefined}
                onDragOver={(event) => works && carriesBooking(event) && event.preventDefault()}
                onDrop={works ? onDrop(person) : undefined}
                className={cx("relative min-w-0 flex-1 border-l border-hairline", works ? "cursor-copy" : "bg-surface-2/70")}
                style={{ height }}
              >
                <HourLines from={from} to={to} pxPerMin={scale} />
                {shift && shift.start > from && <div className="pointer-events-none absolute inset-x-0 top-0 bg-surface-2/70" style={{ height: (shift.start - from) * scale }} />}
                {shift && shift.end < to && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface-2/70" style={{ height: (to - shift.end) * scale }} />}
                {lunch && works && (
                  <div
                    aria-hidden
                    className="studio-calendar-lunch pointer-events-none absolute inset-x-0"
                    style={{ top: (lunch.start - from) * scale, height: (lunch.end - lunch.start) * scale }}
                  />
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
              </div>
            );
          })}
          {/* One "Lunch" for the day, centred over the columns of the people who work. */}
          {lunch && columns.some(({ shift }) => shift) && (
            <div className="pointer-events-none absolute left-11 right-1 flex items-center justify-center text-minimum text-text-secondary"
              style={{ top: `calc(var(--space-3) + ${(lunch.start - from) * scale}px)`, height: (lunch.end - lunch.start) * scale }}>
              {t("calendar.lunch")}
            </div>
          )}
          {date === today && <NowLine minutes={minutes} from={from} to={to} pxPerMin={scale} />}
        </div>
      </div>
    </div>
  );
}

/**
 * The day before and the day after as drop targets over the column headings, shown only during a drag
 * so they never shift the grid under the pointer. A booking dropped there keeps its time and staff member.
 * A day already past is left empty: nothing can be booked there.
 */
function NextDayTargets({ date, onDrop }: { date: DateKey; onDrop: () => void }) {
  const { state, today } = useStudio();
  const drop = useBookingDrop();
  const [over, setOver] = useState<DateKey | null>(null);
  const days = [addDays(date, -1), addDays(date, 1)];
  const onDropDay = (day: DateKey) => (event: DragEvent<HTMLDivElement>) => {
    setOver(null);
    onDrop();
    const booking = state.bookings.find((b) => b.id === event.dataTransfer.getData(DRAG_TYPE));
    if (booking) drop(event, booking.staffId, day, booking.start);
  };
  return (
    <div className="absolute inset-0 z-sticky flex gap-2 bg-bg p-1">
      {days.map((day, index) => day < today ? <div key={day} className="flex-1" /> : (
        <div
          key={day}
          onDragOver={(event) => { if (!carriesBooking(event)) return; event.preventDefault(); setOver(day); }}
          onDragLeave={() => setOver((current) => (current === day ? null : current))}
          onDrop={onDropDay(day)}
          className={cx(
            "flex min-w-0 flex-1 items-center rounded-md px-3 text-meta",
            index ? "justify-end text-right" : "justify-start",
            over === day ? "bg-action-bg font-medium text-text" : "bg-surface-2 text-text-secondary",
          )}
        >
          <span className="truncate">{t("calendar.dropOnDay", { day: formatDayLong(day) })}</span>
        </div>
      ))}
    </div>
  );
}
