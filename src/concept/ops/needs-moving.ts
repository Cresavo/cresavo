import { openingFor, workWindow } from "../data/slots";
import type { Booking, DateKey, DemoState } from "../data/types";

/** Why a booking no longer fits the plan. */
export type MoveReason = "closed" | "off" | "hours";

export interface NeedsMove {
  booking: Booking;
  reason: MoveReason;
}

/**
 * Upcoming bookings that fall outside the plan after hours, closures or
 * someone's schedule changed: the salon is closed, the person is off, or the
 * visit lies outside their working hours. Sorted by time.
 */
export function needsMoving(state: DemoState, today: DateKey, minutes: number): NeedsMove[] {
  const list: NeedsMove[] = [];
  for (const booking of state.bookings) {
    if (booking.status !== "booked" || booking.date < today || (booking.date === today && booking.start < minutes)) continue;
    const window = workWindow(state, booking.staffId, booking.date);
    if (!openingFor(state.salon, booking.date)) list.push({ booking, reason: "closed" });
    else if (!window) list.push({ booking, reason: "off" });
    else if (booking.start < window.start || booking.start + booking.duration > window.end) list.push({ booking, reason: "hours" });
  }
  return list.sort((a, b) => a.booking.date.localeCompare(b.booking.date) || a.booking.start - b.booking.start);
}
