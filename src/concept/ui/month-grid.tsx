"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, monthKey, WEEK_ORDER, weekday } from "../data/dates";
import type { DateKey } from "../data/types";
import { t, words } from "../i18n";
import { formatDayLong, formatMonthYear } from "../i18n/format";
import { IconButton } from "./button";
import { cx } from "./cx";

/** "2026-11" moved by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** The month's days in Monday-first weeks; the blanks before the first day are null. */
export function monthCells(month: string): (DateKey | null)[] {
  const first = `${month}-01`;
  const lead = WEEK_ORDER.indexOf(weekday(first));
  const cells: (DateKey | null)[] = Array.from({ length: lead }, () => null);
  for (let day = first; monthKey(day) === month; day = addDays(day, 1)) cells.push(day);
  return cells;
}

export interface DayInfo {
  /** Not selectable: closed, past or out of range. */
  disabled?: boolean;
  /** Something is there (free times, bookings): a small dot under the number. */
  mark?: boolean;
  /** Read after the date by a screen reader, e.g. "3 free". */
  note?: string;
}

interface MonthGridProps {
  month: string;
  today: DateKey;
  selected?: DateKey;
  /** Names the group of days. */
  label: string;
  onSelect: (date: DateKey) => void;
  onMonth: (month: string) => void;
  info?: (date: DateKey) => DayInfo;
  /** The first and last month that can be shown. */
  minMonth?: string;
  maxMonth?: string;
  className?: string;
}

const KEY_STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

/**
 * A small month to pick a day from. The chosen day is a filled circle, today is underlined, and a dot
 * says something is there. Arrow keys move focus a week or a day and turn the month at its edge; Enter picks.
 */
export function MonthGrid({ month, today, selected, label, onSelect, onMonth, info, minMonth, maxMonth, className }: MonthGridProps) {
  // Only a change of month moves; the first month is simply there.
  const [last, setLast] = useState(month);
  const [direction, setDirection] = useState<"next" | "previous">();
  if (month !== last) {
    setLast(month);
    setDirection(month > last ? "next" : "previous");
  }
  const cells = monthCells(month);
  const marks = !!info && cells.some((day) => day && info(day).mark);
  const days = cells.filter((day): day is DateKey => !!day);
  const usable = (day: DateKey) => !info?.(day).disabled && (!minMonth || monthKey(day) >= minMonth) && (!maxMonth || monthKey(day) <= maxMonth);
  const focusable = [selected, today, ...days].find((day) => day && monthKey(day) === month && usable(day));

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, from: DateKey) => {
    const step = KEY_STEP[event.key];
    if (!step) return;
    event.preventDefault();
    let next = addDays(from, step);
    // Skip closed days in the direction of travel, never further than a month.
    for (let tries = 0; tries < 31 && !usable(next); tries++) next = addDays(next, Math.sign(step));
    if (!usable(next)) return;
    const grid = event.currentTarget.closest("[data-month-grid]");
    if (monthKey(next) !== month) {
      onMonth(monthKey(next));
      requestAnimationFrame(() => grid?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
      return;
    }
    grid?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus();
  };

  return (
    <div data-month-grid className={cx("w-full max-w-sm", className)}>
      <div className="flex items-center gap-1">
        <p aria-live="polite" className="flex-1 text-body font-semibold first-letter:uppercase">{formatMonthYear(month)}</p>
        <IconButton label={t("month.previous")} disabled={!!minMonth && month <= minMonth} onClick={() => onMonth(shiftMonth(month, -1))}>
          <ChevronLeft size={20} aria-hidden />
        </IconButton>
        <IconButton label={t("month.next")} disabled={!!maxMonth && month >= maxMonth} onClick={() => onMonth(shiftMonth(month, 1))}>
          <ChevronRight size={20} aria-hidden />
        </IconButton>
      </div>
      <div aria-hidden className="grid grid-cols-7 text-center text-minimum text-text-secondary">
        {WEEK_ORDER.map((day) => <span key={day} className="py-1">{words.weekdaysShort[day]}</span>)}
      </div>
      {/* Keyed by month so a new month arrives instead of the numbers changing in place. */}
      <div key={month} role="group" aria-label={label} className={cx("grid grid-cols-7", direction && `ui-month-${direction}`)}>
        {cells.map((day, index) => {
          if (!day) return <span key={`blank-${index}`} />;
          const details = info?.(day) ?? {};
          const enabled = usable(day);
          const chosen = day === selected;
          return (
            <button
              key={day}
              type="button"
              data-date={day}
              disabled={!enabled}
              aria-pressed={chosen}
              aria-current={day === today ? "date" : undefined}
              aria-label={[formatDayLong(day), details.note].filter(Boolean).join(", ")}
              tabIndex={day === focusable ? 0 : -1}
              onClick={() => onSelect(day)}
              onKeyDown={(event) => onKey(event, day)}
              className="ui-press group flex min-h-target min-w-0 flex-col items-center justify-center rounded-full bg-transparent text-body disabled:cursor-default disabled:bg-transparent"
            >
              <span className={cx(
                "flex size-9 items-center justify-center rounded-full transition-colors duration-quick",
                chosen ? "bg-action font-semibold text-on-action"
                  : !enabled ? "text-text-secondary line-through decoration-1"
                  // With marks in use, a day without one (full) is quieter than a day with one.
                  : cx("group-hover:bg-surface-2", details.mark ? "font-medium text-text" : marks && "text-text-secondary"),
                day === today && !chosen && "font-semibold underline decoration-2 underline-offset-4",
              )}>
                {Number(day.slice(8))}
              </span>
              <span aria-hidden className={cx("mt-px size-1 rounded-full", details.mark && enabled ? (chosen ? "bg-text" : "bg-text-secondary") : "bg-transparent")} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
