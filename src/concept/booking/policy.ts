import { diffDays } from "../data/dates";
import type { Booking, DateKey } from "../data/types";

/** Customers can change or cancel online without a fee until this many hours before the visit. */
export const FREE_CHANGE_HOURS = 24;

/** The earliest a customer can book, counted from now. */
export const LEAD_MINUTES = 60;

export function earliestBookingStart(date: DateKey, today: DateKey, minutes: number): number {
  return minutes + LEAD_MINUTES - diffDays(date, today) * 24 * 60;
}

export type ChangeRule = "free" | "late" | "past";

export function hoursUntil(booking: Pick<Booking, "date" | "start">, today: DateKey, minutes: number): number {
  return (diffDays(booking.date, today) * 24 * 60 + booking.start - minutes) / 60;
}

/** "free": can be changed online. "late": inside the 24 h window, call the salon. "past": already happened or not active. */
export function changeRule(booking: Pick<Booking, "date" | "start" | "status">, today: DateKey, minutes: number): ChangeRule {
  const hours = hoursUntil(booking, today, minutes);
  if (booking.status !== "booked" || hours <= 0) return "past";
  return hours >= FREE_CHANGE_HOURS ? "free" : "late";
}
