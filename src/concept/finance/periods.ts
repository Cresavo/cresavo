import { addDays, diffDays, monthKey, startOfWeek } from "../data/dates";
import type { DateKey } from "../data/types";
import type { Clock } from "./types";

export type PeriodKey = "day" | "week" | "month" | "year";

/** Days from `start` up to but not including `end`, optionally cut off at a time of day on the last day. */
export interface Range {
  start: DateKey;
  end: DateKey;
  /** Only count visits that ended by this time on the last day, so "so far today" compares fairly. */
  untilMinutes?: number;
  /** Whole months ("YYYY-MM") when the range is a stretch of full months. */
  months?: string[];
}

export interface PeriodRanges {
  current: Range;
  previous: Range;
  /** What occupancy and treatments are measured over. Longer than `current` for the year view. */
  detailCurrent: Range;
  detailPrevious: Range;
}

export const YEAR_MONTHS = 12;

export function shiftMonth(month: string, delta: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export const monthStart = (month: string): DateKey => `${month}-01`;

export function daysInMonth(month: string): number {
  return diffDays(monthStart(shiftMonth(month, 1)), monthStart(month));
}

/** Every day of a month, as a range. */
export function monthRange(month: string): Range {
  return { start: monthStart(month), end: monthStart(shiftMonth(month, 1)), months: [month] };
}

function monthsRange(months: string[]): Range {
  return { start: monthStart(months[0]), end: monthStart(shiftMonth(months[months.length - 1], 1)), months };
}

function lastMonths(endMonth: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - count + 1));
}

/** The period so far and the same stretch of the one before it: today with last week's same day, this month so far with last month's first days. */
export function periodRanges(period: PeriodKey, { today, minutes }: Clock): PeriodRanges {
  if (period === "year") {
    const end = shiftMonth(monthKey(today), -1);
    const current = monthsRange(lastMonths(end, YEAR_MONTHS));
    const previous = monthsRange(lastMonths(shiftMonth(end, -YEAR_MONTHS), YEAR_MONTHS));
    const detailCurrent = { start: addDays(today, -89), end: addDays(today, 1) };
    return { current, previous, detailCurrent, detailPrevious: { start: addDays(detailCurrent.start, -90), end: detailCurrent.start } };
  }
  let current: Range;
  let previous: Range;
  if (period === "day") {
    current = { start: today, end: addDays(today, 1), untilMinutes: minutes };
    previous = { start: addDays(today, -7), end: addDays(today, -6), untilMinutes: minutes };
  } else if (period === "week") {
    const start = startOfWeek(today);
    const length = diffDays(today, start) + 1;
    current = { start, end: addDays(start, length), untilMinutes: minutes };
    previous = { start: addDays(start, -7), end: addDays(start, length - 7), untilMinutes: minutes };
  } else {
    const month = monthKey(today);
    const before = shiftMonth(month, -1);
    const length = Number(today.slice(8, 10));
    const sameLength = Math.min(length, daysInMonth(before));
    current = { start: monthStart(month), end: addDays(monthStart(month), length), untilMinutes: minutes };
    previous = {
      start: monthStart(before),
      end: addDays(monthStart(before), sameLength),
      untilMinutes: length <= daysInMonth(before) ? minutes : undefined,
    };
  }
  return { current, previous, detailCurrent: current, detailPrevious: previous };
}

export function rangeDays(range: Range): number {
  return diffDays(range.end, range.start);
}
