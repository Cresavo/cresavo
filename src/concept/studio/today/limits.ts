import type { DemoState } from "../../data/types";

/** How many schedule rows Today shows before "Show all". */
export const SCHEDULE_ROWS = 5;

/**
 * The rows Today shows: the next ones that have not ended yet, at most SCHEDULE_ROWS. Late in the day,
 * with nothing left, the day's last rows. `showAll` shows the whole day.
 */
export function scheduleRows<T extends { start: number; end: number }>(rows: T[], now: number, showAll = false): T[] {
  if (showAll) return rows;
  const upcoming = rows.filter((row) => row.end > now);
  return upcoming.length ? upcoming.slice(0, SCHEDULE_ROWS) : rows.slice(-SCHEDULE_ROWS);
}

/** Below this many real bookings a salon is new, and Today keeps its suggestions to one. */
export const FEW_BOOKINGS = 20;

/** How many suggestions Today shows at first, and whether the rest can be opened. */
export function suggestionLimit(state: Pick<DemoState, "bookings">): { first: number; more: boolean } {
  const real = state.bookings.filter((booking) => !booking.example).length;
  return real < FEW_BOOKINGS ? { first: 1, more: false } : { first: 2, more: true };
}
