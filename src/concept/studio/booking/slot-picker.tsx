"use client";

import { Button } from "../../ui/button";
import { useMemo } from "react";
import { addDays } from "../../data/dates";
import { freeStarts, staffWorks, type Need } from "../../data/slots";
import type { DateKey, StaffId } from "../../data/types";
import { dayChipLabel, formatDayMonth, formatTime } from "../../i18n/format";
import { t } from "../../i18n";
import { cx } from "../../ui/cx";
import { useStudio } from "../use-studio";

export interface Slot {
  date: DateKey;
  start: number;
}

export function slotOnDate<T extends Slot>(slot: T | null, date: DateKey): T | null {
  return slot?.date === date ? slot : null;
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
          <Button variant="secondary" size="sm"
            key={d}
            onClick={() => onDateChange(d)}
            aria-pressed={d === date}
            className={cx(
              "min-h-14 min-w-20 shrink-0 flex-col !gap-0",
              d === date && "aria-pressed:bg-action-bg aria-pressed:ring-action",
            )}
          >
            <span className="font-medium">{dayChipLabel(d, today)}</span>
            <span className="text-meta text-text-secondary">{formatDayMonth(d)}</span>
          </Button>
        ))}
      </div>
      {times.length ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {times.map((start) => {
            const selected = value?.date === date && value.start === start;
            return (
              <Button variant="secondary" size="sm"
                key={start}
                onClick={() => onChange({ date, start })}
                aria-pressed={selected}
                className={cx(
                  "tabular-nums !px-1",
                  selected && "aria-pressed:bg-action-bg aria-pressed:ring-action",
                )}
              >
                {formatTime(start)}
              </Button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-text-secondary">{t("slots.noneThisDay")}</p>
      )}
    </div>
  );
}
