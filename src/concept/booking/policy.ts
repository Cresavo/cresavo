import { DateTime } from "luxon";
import { diffDays } from "../data/dates";
import type { Booking, DateKey } from "../data/types";
import { SALON_TIMEZONE } from "../tools/clock";
import { DEFAULT_POLICY } from "./protection";

export const FREE_CHANGE_HOURS = DEFAULT_POLICY.freeHours;
export const LEAD_MINUTES = 60;

export function earliestBookingStart(date: DateKey, today: DateKey, minutes: number): number {
  return minutes + LEAD_MINUTES - diffDays(date, today) * 24 * 60;
}

export type ChangeRule = "free" | "late" | "past";
type VisitTime = Pick<Booking, "date" | "start">;

export function visitTime({ date, start }: VisitTime) {
  const time = DateTime.fromISO(date, { zone: SALON_TIMEZONE }).set({ hour: Math.floor(start / 60), minute: start % 60 });
  // A wall-clock booking has no fold flag. Use the first occurrence when clocks go back.
  return time.getPossibleOffsets()[0];
}

export function deadline(visit: VisitTime, freeHours: number) {
  return visitTime(visit).minus({ hours: freeHours });
}

export function freeCancellationDeadline(visit: VisitTime & Pick<Booking, "protection">) {
  const cutoff = deadline(visit, visit.protection?.terms.freeHours ?? FREE_CHANGE_HOURS);
  return { date: cutoff.toISODate()!, time: cutoff.hour * 60 + cutoff.minute };
}

/** The last instant (epoch ms) a booking may be changed free of charge: the cutoff of its own terms, itself included. */
export const freeChangeCutoff = (booking: VisitTime & Pick<Booking, "protection">) =>
  deadline(booking, booking.protection?.terms.freeHours ?? FREE_CHANGE_HOURS).toMillis();

/** Whether a booked visit may still be changed free of charge at this instant. The one cutoff test of the reducer, the route's answers and the booking view. */
export const freeChangeOpen = (booking: VisitTime & Pick<Booking, "protection" | "status">, instant: number) =>
  booking.status === "booked" && instant <= freeChangeCutoff(booking);

export function hoursUntil(booking: VisitTime, today: DateKey, minutes: number, instant?: number): number {
  const from = instant ?? visitTime({ date: today, start: minutes }).toMillis();
  return (visitTime(booking).toMillis() - from) / 3_600_000;
}

export function changeRule(booking: Pick<Booking, "date" | "start" | "status" | "protection">, today: DateKey, minutes: number, instant?: number): ChangeRule {
  const hours = hoursUntil(booking, today, minutes, instant);
  if (booking.status !== "booked" || hours <= 0) return "past";
  return hours >= (booking.protection?.terms.freeHours ?? FREE_CHANGE_HOURS) ? "free" : "late";
}
