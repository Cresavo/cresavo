import type { Booking, Customer, DateKey, DemoState } from "../data/types";
import { changeRule } from "./policy";

/** Digits only, without country code or trunk zero, so "070-174 06 50" equals "+46 70 174 06 50". */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^(?:00)?46/, "").replace(/^0/, "");
}

export function findCustomerByPhone(state: Pick<DemoState, "customers">, phone: string): Customer | undefined {
  const wanted = normalizePhone(phone);
  return wanted.length >= 7 ? state.customers.find((c) => normalizePhone(c.phone) === wanted) : undefined;
}

export interface CustomerBookings {
  upcoming: Booking[];
  past: Booking[];
}

export function customerBookings(state: Pick<DemoState, "bookings">, customerId: string, today: DateKey, minutes: number): CustomerBookings {
  const own = state.bookings.filter((b) => b.customerId === customerId);
  const isUpcoming = (b: Booking) => b.status === "booked" && changeRule(b, today, minutes) !== "past";
  const byTime = (a: Booking, b: Booking) => a.date.localeCompare(b.date) || a.start - b.start;
  return {
    upcoming: own.filter(isUpcoming).sort(byTime),
    past: own
      .filter((b) => !isUpcoming(b) && b.status !== "cancelled")
      .sort((a, b) => byTime(b, a))
      .slice(0, 8),
  };
}
