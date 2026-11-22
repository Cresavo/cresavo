"use client";

import { Button } from "../../ui/button";
import { addDays } from "../../data/dates";
import { openingFor, staffWorks } from "../../data/slots";
import type { DateKey, Staff } from "../../data/types";
import { formatDayMonth, weekdayName } from "../../i18n/format";
import { dayBookings } from "../../selectors";
import { cx } from "../../ui/cx";
import type { OpenSheet } from "../booking/booking-sheets";
import { useStudio } from "../use-studio";
import { BookingBlock } from "./block";
import { calendarScale, HourLines, TimeAxis } from "./time-axis";

const PX_PER_MIN = 0.9;

/** Seven days side by side (desktop). Each day is split per selected staff member. */
export function WeekGrid({ monday, staff, resourceId, onOpen, onPickDay }: { monday: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void; onPickDay: (date: DateKey) => void }) {
  const { state, today } = useStudio();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const open = days.map((d) => openingFor(state.salon, d)).filter((h) => h !== null);
  const from = open.length ? Math.min(...open.map((h) => h.open)) : 0;
  const to = open.length ? Math.max(...open.map((h) => h.close)) : from;
  const columns = days.map(day => staff.map(person => dayBookings(state, day, person.id, resourceId)));
  const scale = calendarScale(PX_PER_MIN, columns.flat(2));

  return (
    <div className="overflow-x-auto rounded-lg bg-surface ring-1 ring-hairline">
      <div className="studio-calendar-grid" style={{ "--calendar-columns": days.length * Math.max(1, staff.length) } as React.CSSProperties}>
        <div className="flex border-b border-hairline">
          <div className="w-11 shrink-0" />
          {days.map((d) => (
            <Button variant="tertiary" size="sm"
              key={d}
              onClick={() => onPickDay(d)}
              className={cx("flex-1 flex-col !gap-0 !px-1", d === today && "text-action")}
            >
              <span className="block font-medium">{weekdayName(d).slice(0, 3)}</span>
              <span className={cx("block text-xs", d === today ? "font-semibold" : "text-text-secondary")}>{formatDayMonth(d)}</span>
            </Button>
          ))}
        </div>
        <div className="flex py-3 pr-1">
          <TimeAxis from={from} to={to} pxPerMin={scale} />
          {days.map((d, dayIndex) => {
            const hours = openingFor(state.salon, d);
            return (
              <div key={d} className={cx("relative flex min-w-0 flex-1 border-l border-hairline", !hours && "bg-surface-2/70")} style={{ height: (to - from) * scale }}>
                <HourLines from={from} to={to} pxPerMin={scale} />
                {hours &&
                  staff.map((person, staffIndex) => (
                    <div key={person.id} className={cx("relative min-w-0 flex-1", !staffWorks(state, person.id, d) && "bg-surface-2/50")}>
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
                  ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
