"use client";

import { addDays } from "../../data/dates";
import { openingFor, staffWorks } from "../../data/slots";
import type { DateKey, Staff } from "../../data/types";
import { formatDayMonth, weekdayName } from "../../i18n/format";
import { dayBookings } from "../../selectors";
import { cx } from "../../ui/cx";
import type { OpenSheet } from "../booking/booking-sheets";
import { useStudio } from "../use-studio";
import { BookingBlock } from "./block";
import { HourLines, TimeAxis } from "./time-axis";

const PX_PER_MIN = 0.9;

/** Seven days side by side (desktop). Each day is split per selected staff member. */
export function WeekGrid({ monday, staff, resourceId, onOpen, onPickDay }: { monday: DateKey; staff: Staff[]; resourceId?: string; onOpen: (sheet: OpenSheet) => void; onPickDay: (date: DateKey) => void }) {
  const { state, today } = useStudio();
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const open = days.map((d) => openingFor(state.salon, d)).filter((h) => h !== null);
  const from = Math.min(...open.map((h) => h.open));
  const to = Math.max(...open.map((h) => h.close));

  return (
    <div className="overflow-hidden rounded-2xl bg-eko-surface shadow-card ring-1 ring-eko-line/70">
      <div className="flex border-b border-eko-line">
        <div className="w-11 shrink-0" />
        {days.map((d) => (
          <button
            key={d}
            onClick={() => onPickDay(d)}
            className={cx("min-w-0 flex-1 px-2 py-2.5 text-center text-sm hover:bg-eko-sunken", d === today && "text-eko-accent")}
          >
            <span className="block font-medium">{weekdayName(d).slice(0, 3)}</span>
            <span className={cx("block text-xs", d === today ? "font-semibold" : "text-eko-muted")}>{formatDayMonth(d)}</span>
          </button>
        ))}
      </div>
      <div className="flex py-3 pr-1">
        <TimeAxis from={from} to={to} pxPerMin={PX_PER_MIN} />
        {days.map((d) => {
          const hours = openingFor(state.salon, d);
          return (
            <div key={d} className={cx("relative flex min-w-0 flex-1 border-l border-eko-line/70", !hours && "bg-eko-sunken/70")} style={{ height: (to - from) * PX_PER_MIN }}>
              <HourLines from={from} to={to} pxPerMin={PX_PER_MIN} />
              {hours &&
                staff.map((person) => (
                  <div key={person.id} className={cx("relative min-w-0 flex-1", !staffWorks(state, person.id, d) && "bg-eko-sunken/50")}>
                    {dayBookings(state, d, person.id, resourceId).map((b) => (
                      <BookingBlock
                        key={b.id}
                        booking={b}
                        compact
                        top={(b.start - from) * PX_PER_MIN + 1}
                        height={b.duration * PX_PER_MIN - 2}
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
  );
}
