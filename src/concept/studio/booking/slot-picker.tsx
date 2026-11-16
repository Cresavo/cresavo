"use client";

import { useMemo } from "react";
import { addDays, formatTime } from "../../data/dates";
import { freeStarts, staffWorks } from "../../data/slots";
import type { DateKey, StaffId } from "../../data/types";
import { dayChipLabel, formatDayMonth } from "../../i18n/format";
import { t } from "../../i18n";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";

export interface Slot {
  date: DateKey;
  start: number;
}

interface SlotPickerProps {
  staffId: StaffId;
  duration: number;
  date: DateKey;
  onDateChange: (date: DateKey) => void;
  value: Slot | null;
  onChange: (slot: Slot) => void;
  ignoreBookingId?: string;
  days?: number;
}

/** Day chips plus free start times for one staff member. */
export function SlotPicker({ staffId, duration, date, onDateChange, value, onChange, ignoreBookingId, days = 21 }: SlotPickerProps) {
  const { state, today, minutes } = useStudio();
  const staff = state.staff.find((s) => s.id === staffId);
  const workdays = useMemo(() => {
    const list: DateKey[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(today, i);
      if (staffWorks(staff, state.salon, d)) list.push(d);
    }
    return list;
  }, [days, today, staff, state.salon]);
  const times = freeStarts(state, staffId, date, duration, {
    ignoreId: ignoreBookingId,
    after: date === today ? minutes : 0,
    step: 15,
  });

  return (
    <div className="space-y-4">
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {workdays.map((d) => (
          <button
            key={d}
            onClick={() => onDateChange(d)}
            aria-pressed={d === date}
            className={cx(
              "flex min-h-14 min-w-[76px] shrink-0 flex-col items-center justify-center rounded-xl px-2 text-sm ring-1 ring-inset",
              d === date ? "bg-eko-ink text-eko-bg ring-eko-ink" : "bg-eko-surface ring-eko-line hover:bg-eko-sunken",
            )}
          >
            <span className="font-medium">{dayChipLabel(d, today)}</span>
            <span className={cx("text-xs", d === date ? "opacity-70" : "text-eko-muted")}>{formatDayMonth(d)}</span>
          </button>
        ))}
      </div>
      {times.length ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {times.map((start) => {
            const selected = value?.date === date && value.start === start;
            return (
              <button
                key={start}
                onClick={() => onChange({ date, start })}
                aria-pressed={selected}
                className={cx(
                  "min-h-11 rounded-xl text-center text-sm font-medium tabular-nums ring-1 ring-inset",
                  selected ? "bg-eko-accent text-eko-on-accent ring-eko-accent" : "bg-eko-surface ring-eko-line hover:bg-eko-sunken",
                )}
              >
                {formatTime(start)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-eko-sunken px-4 py-3 text-sm text-eko-muted">{t("slots.noneThisDay")}</p>
      )}
    </div>
  );
}
