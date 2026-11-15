import { DateTime } from "luxon";
import type { Service } from "@prisma/client";
import { DEMO_BUSINESS_ID } from "./config";
import { DomainError } from "./errors";
import { scheduledSlots, type Weekly } from "./schedule";
import { dateSchema } from "./validation";

// Fictional salon configuration only; no customer/contact records or credentials.
export function fixtureServices(): Service[] {
  return [
    { id: "fotvard", name: "Fotvård", duration: 60, priceOre: 65000 },
    { id: "massage", name: "Massage", duration: 30, priceOre: 45000 },
  ].map((s) => ({ ...s, businessId: DEMO_BUSINESS_ID, buffer: 0, active: true, version: 1 }));
}

export function fixtureStaff() {
  return [
    { id: "staff-demo", name: "Anna", start: "09:00", end: "17:00" },
    { id: "staff-erik", name: "Erik", start: "10:00", end: "16:00" },
  ].map(({ start, end, ...s }) => ({
    ...s, businessId: DEMO_BUSINESS_ID, active: true, version: 1,
    serviceIds: ["fotvard", "massage"],
    weekly: [1, 2, 3, 4, 5].map((weekday) => ({
      weekday, periods: [{ start, end }], breaks: [],
    })) satisfies Weekly,
    exceptions: [],
  }));
}

export function fixtureAvailability(serviceId: string, day: string, staffId: string) {
  dateSchema.parse(day);
  const service = fixtureServices().find((s) => s.id === serviceId);
  if (!service) throw new DomainError("Tjänsten finns inte");
  const staff = fixtureStaff().find((s) => s.id === staffId && s.serviceIds.includes(serviceId));
  if (!staff) throw new DomainError("Medarbetaren kan inte utföra behandlingen");
  return scheduledSlots(staff.weekly, staff.exceptions, day, service.duration + service.buffer);
}

// Demo presentation default only. Explicit valid dates (including closed days)
// are preserved; scheduling remains entirely in fixtureAvailability/scheduledSlots.
export function fixtureBookingDate(
  query: Record<string, string | string[] | undefined>,
  now: DateTime = DateTime.now(),
) {
  const today = now.setZone("Europe/Stockholm").startOf("day");
  const first = today.toISODate()!;
  const last = today.plus({ days: 60 }).toISODate()!;
  if (typeof query.date === "string" &&
      DateTime.fromISO(query.date).toISODate() === query.date &&
      query.date >= first && query.date <= last) return query.date;
  const services = fixtureServices();
  const service = services.find((s) => s.id === query.service) ?? services[0];
  const team = fixtureStaff().filter((s) => s.serviceIds.includes(service.id));
  const person = team.find((s) => s.id === query.staff) ?? team[0];
  for (let offset = 0; offset <= 60; offset++) {
    const day = today.plus({ days: offset }).toISODate()!;
    if (fixtureAvailability(service.id, day, person.id).length) return day;
  }
  return first;
}
