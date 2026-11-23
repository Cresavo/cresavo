import type { DemoState } from "../../data/types";

/** How many schedule rows Today shows before "Show all". */
export const SCHEDULE_ROWS = 5;

/**
 * The rows Today shows: the next ones that have not ended yet, at most SCHEDULE_ROWS. When fewer are left, the
 * latest finished ones fill up the list before them, so the day still reads as a day; with nothing left, the
 * day's last rows. `showAll` shows the whole day.
 */
export function scheduleRows<T extends { start: number; end: number }>(rows: T[], now: number, showAll = false): T[] {
  if (showAll) return rows;
  const upcoming = rows.filter((row) => row.end > now);
  if (upcoming.length >= SCHEDULE_ROWS) return upcoming.slice(0, SCHEDULE_ROWS);
  const ended = rows.filter((row) => row.end <= now).slice(upcoming.length - SCHEDULE_ROWS);
  return rows.filter((row) => upcoming.includes(row) || ended.includes(row));
}

/** Below this many real bookings a salon is new, and Today keeps its suggestions to one. */
export const FEW_BOOKINGS = 20;

/** How many suggestions Today shows at first, and whether the rest can be opened. */
export function suggestionLimit(state: Pick<DemoState, "bookings">): { first: number; more: boolean } {
  const real = state.bookings.filter((booking) => !booking.example).length;
  return real < FEW_BOOKINGS ? { first: 1, more: false } : { first: 2, more: true };
}
