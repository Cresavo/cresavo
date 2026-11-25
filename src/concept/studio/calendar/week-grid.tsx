"use client";

import { useState, type DragEvent } from "react";
import { Button } from "../../ui/button";
import { addDays } from "../../data/dates";
import { lunchFor, openingFor, staffWorks } from "../../data/slots";
import type { DateKey, Staff } from "../../data/types";
import { t } from "../../i18n";
import { formatDayMonth, weekdayName } from "../../i18n/format";
import { dayBookings } from "../../selectors";
import { cx } from "../../ui/cx";
import type { OpenSheet } from "../booking/booking-sheets";
import { staffFill } from "../staff-dot";
import { useStudio } from "../use-studio";
import { BookingBlock, DRAG_TYPE } from "./block";
import { carriesBooking, useBookingDrop } from "./drop";
import { snapMinutes } from "./gap";
import { calendarRange, calendarScale, HourLines, NowLine, TimeAxis, useTextScale } from "./time-axis";

const PX_PER_MIN = 0.9;

/** Seven days side by side (desktop). Each day is split per selected staff member; drag a booking to another day or time. */
export function WeekGrid({ monday, staff, resourceId, onOpen, onPickDay }: { monday: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void; onPickDay: (date: DateKey) => void }) {
  const { state, today, minutes } = useStudio();
  const text = useTextScale();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const open = days.map((d) => openingFor(state.salon, d)).filter((h) => h !== null);
  const opening = open.length ? { from: Math.min(...open.map((h) => h.open)), to: Math.max(...open.map((h) => h.close)) } : { from: 0, to: 0 };
  const columns = days.map(day => staff.map(person => dayBookings(state, day, person.id, resourceId)));
  const { from, to } = calendarRange(opening.from, opening.to, columns.flat(2));
  const scale = calendarScale(PX_PER_MIN * text, columns.flat(2), 44 * text);
  const drop = useBookingDrop();
  // The column under a dragged booking, tinted so the owner sees which day and person it lands on.
  const [over, setOver] = useState<string | null>(null);
  const onDragOver = (key: string) => (event: DragEvent<HTMLDivElement>) => {
    if (!carriesBooking(event)) return;
    event.preventDefault();
    if (over !== key) setOver(key);
  };
  const onDragLeave = (key: string) => (event: DragEvent<HTMLDivElement>) => {
    // Leaving for a booking inside the same column is not leaving the column.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver((current) => (current === key ? null : current));
  };
  const onDrop = (staffId: Staff["id"], date: DateKey) => (event: DragEvent<HTMLDivElement>) => {
    setOver(null);
    drop(event, staffId, date, snapMinutes(from + (event.clientY - event.currentTarget.getBoundingClientRect().top) / scale));
  };
  // A closed day has no staff columns; the day itself still takes the drop so the toast can say the booking stayed.
  const onDropClosed = (date: DateKey) => (event: DragEvent<HTMLDivElement>) => {
    setOver(null);
    const booking = state.bookings.find((b) => b.id === event.dataTransfer.getData(DRAG_TYPE));
    if (booking) drop(event, booking.staffId, date, booking.start);
  };

  return (
    <>
    {staff.length > 1 && <StaffKey staff={staff} />}
    <div className="studio-calendar-flat overflow-x-auto" onDragEnd={() => setOver(null)}>
      <div className="studio-calendar-grid studio-calendar-week" style={{ "--calendar-columns": days.length * Math.max(1, staff.length) } as React.CSSProperties}>
        <div className="flex pr-1">
          <div className="w-11 shrink-0" />
          {days.map((d) => (
            <Button variant="tertiary" size="sm"
              key={d}
              onClick={() => onPickDay(d)}
              aria-current={d === today ? "date" : undefined}
              className="studio-week-day flex-1 flex-col !gap-0 !px-1 !py-2"
            >
              <span className={cx("block text-minimum", d === today ? "font-semibold text-text" : "text-text-secondary")}>{weekdayName(d).slice(0, 3)}</span>
              {/* The bare number is what the eye reads; "25 Nov" stays the button's name for screen readers. */}
              <span className="sr-only">{formatDayMonth(d)}</span>
              <span aria-hidden className={cx("studio-week-num", d === today && "studio-today-mark")}>{Number(d.slice(8))}</span>
            </Button>
          ))}
        </div>
        {staff.length > 1 && (
          /* A thin tick in each person's colour over their column; the key above names the colours once. */
          <div className="flex border-b border-hairline pb-1 pr-1">
            <div className="w-11 shrink-0" />
            {days.map((d) => (
              <div key={d} className="flex min-w-0 flex-1 gap-1 px-1">
                {openingFor(state.salon, d) && staff.map((person) => (
                  <span key={person.id} className={cx("h-0.5 min-w-0 flex-1 rounded-full", staffFill(person.id))}>
                    <span className="sr-only">{person.firstName}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
        {staff.length < 2 && <div className="border-b border-hairline" />}
        <div className="relative flex py-3 pr-1">
          <TimeAxis from={from} to={to} pxPerMin={scale} />
          {days.map((d, dayIndex) => {
            const hours = openingFor(state.salon, d);
            const lunch = lunchFor(state.salon, d);
            return (
              <div key={d}
                onDragOver={!hours && d >= today ? onDragOver(`closed:${d}`) : undefined}
                onDragLeave={onDragLeave(`closed:${d}`)}
                onDrop={!hours && d >= today ? onDropClosed(d) : undefined}
                className={cx("relative flex min-w-0 flex-1 border-l border-hairline/70", !hours && "bg-surface-2/70", over === `closed:${d}` && "bg-action-bg/60")}
                style={{ height: (to - from) * scale }}>
                <HourLines from={from} to={to} pxPerMin={scale} />
                {hours &&
                  staff.map((person, staffIndex) => {
                    const works = staffWorks(state, person.id, d);
                    const key = `${d}:${person.id}`;
                    // Past days are not drop targets (the move is also refused in the drop handler). A day off still
                    // accepts the drop so the toast can say the booking stayed.
                    const accepts = d >= today;
                    return (
                      <div key={person.id}
                        onDragOver={accepts ? onDragOver(key) : undefined}
                        onDragLeave={onDragLeave(key)}
                        onDrop={accepts ? onDrop(person.id, d) : undefined}
                        className={cx("relative min-w-0 flex-1", !works && "bg-surface-2/50", over === key && "bg-action-bg/60")}>
                        {lunch && works && (
                          <div
                            aria-hidden
                            className="studio-calendar-lunch pointer-events-none absolute inset-x-0"
                            style={{ top: (lunch.start - from) * scale, height: (lunch.end - lunch.start) * scale }}
                          />
                        )}
                        {columns[dayIndex][staffIndex].map((b) => (
                          <BookingBlock
                            key={b.id}
                            booking={b}
                            compact
                            top={(b.start - from) * scale + 1}
                            height={b.duration * scale - 2}
                            scale={scale}
                            onOpen={() => onOpen({ kind: "booking", id: b.id })}
                          />
                        ))}
                      </div>
                    );
                  })}
                {hours && lunch && staff.some((person) => staffWorks(state, person.id, d)) && (
                  <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center text-minimum text-text-secondary" style={{ top: (lunch.start - from) * scale, height: (lunch.end - lunch.start) * scale }}>
                    {t("calendar.lunch")}
                  </div>
                )}
              </div>
            );
          })}
          {days.includes(today) && <NowLine minutes={minutes} from={from} to={to} pxPerMin={scale} />}
        </div>
      </div>
    </div>
    </>
  );
}

/**
 * Which colour is whose, said once above the week: a tick and the first name for each person, in the same order as
 * the columns under every day. The week's columns then need only a thin tick, never a row of repeated names.
 */
function StaffKey({ staff }: { staff: Staff[] }) {
  return (
    <ul aria-label={t("calendar.staff")} className="mb-2 flex flex-wrap justify-end gap-x-4 gap-y-1 text-minimum text-text-secondary">
      {staff.map((person) => (
        <li key={person.id} className="flex items-center gap-1.5">
          <span aria-hidden className={cx("h-3 w-0.5 rounded-full", staffFill(person.id))} />
          {person.firstName}
        </li>
      ))}
    </ul>
  );
}
