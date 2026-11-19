import { addDays, diffDays } from "../data/dates";
import type { Booking, DateKey } from "../data/types";

/** Customers can change or cancel online without a fee until this many hours before the visit. */
export const FREE_CHANGE_HOURS = 24;

/** The earliest a customer can book, counted from now. */
export const LEAD_MINUTES = 60;

export type ChangeRule = "free" | "late" | "past";

/** The cutoff in salon wall time, using the same local-minute rule as online changes. */
export function freeCancellationDeadline(booking: Pick<Booking, "date" | "start">) {
  const minutes = booking.start - FREE_CHANGE_HOURS * 60;
  const days = Math.floor(minutes / 1440);
  return { date: addDays(booking.date, days), time: minutes - days * 1440 };
}

export function hoursUntil(booking: Pick<Booking, "date" | "start">, today: DateKey, minutes: number): number {
  return (diffDays(booking.date, today) * 24 * 60 + booking.start - minutes) / 60;
}

/** "free": can be changed online. "late": inside the 24 h window, call the salon. "past": already happened or not active. */
export function changeRule(booking: Pick<Booking, "date" | "start" | "status">, today: DateKey, minutes: number): ChangeRule {
  const hours = hoursUntil(booking, today, minutes);
  if (booking.status !== "booked" || hours <= 0) return "past";
  return hours >= FREE_CHANGE_HOURS ? "free" : "late";
}
