"use client";

import { useMemo } from "react";
import { addDays, formatTime } from "../../data/dates";
import { freeStarts, staffWorks, type Need } from "../../data/slots";
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
  need: Need;
  date: DateKey;
  onDateChange: (date: DateKey) => void;
  value: Slot | null;
  onChange: (slot: Slot) => void;
  ignoreBookingId?: string;
  days?: number;
}

/** Day chips plus free start times for one staff member. */
export function SlotPicker({ staffId, need, date, onDateChange, value, onChange, ignoreBookingId, days = 21 }: SlotPickerProps) {
  const { state, today, minutes } = useStudio();
  const workdays = useMemo(() => {
    const list: DateKey[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(today, i);
      if (staffWorks(state, staffId, d)) list.push(d);
    }
    return list;
  }, [days, today, staffId, state]);
  const times = freeStarts(state, staffId, date, need, {
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
              "flex min-h-14 min-w-[76px] shrink-0 flex-col items-center justify-center rounded-md px-2 text-sm ring-1 ring-inset",
              d === date ? "bg-text text-bg ring-text" : "bg-surface ring-border hover:bg-surface-2",
            )}
          >
            <span className="font-medium">{dayChipLabel(d, today)}</span>
            <span className={cx("text-xs", d === date ? "opacity-70" : "text-text-secondary")}>{formatDayMonth(d)}</span>
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
                  "min-h-11 rounded-md text-center text-sm font-medium tabular-nums ring-1 ring-inset",
                  selected ? "bg-action text-on-action ring-action" : "bg-surface ring-border hover:bg-surface-2",
                )}
              >
                {formatTime(start)}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-text-secondary">{t("slots.noneThisDay")}</p>
      )}
    </div>
  );
}
