import type { DateKey } from "./types";

// Date maths without time zones: a DateKey is a local calendar day.
// Display formatting lives in `src/concept/i18n/format.ts`.

/** Weekdays in the order a week is shown (Monday first); 0 = Sunday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const pad = (n: number) => String(n).padStart(2, "0");

export function toKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 86_400_000);
}

/** 0 = Sunday. */
export function weekday(key: DateKey): number {
  return fromKey(key).getDay();
}

/** Monday of the week containing the day. */
export function startOfWeek(key: DateKey): DateKey {
  const wd = weekday(key);
  return addDays(key, wd === 0 ? -6 : 1 - wd);
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function formatTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "10:30" to minutes from midnight. */
export function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}
