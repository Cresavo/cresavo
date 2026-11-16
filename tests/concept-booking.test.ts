import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { buildIcs } from "@/concept/booking/ics";
import { customerBookings, findCustomerByPhone, normalizePhone } from "@/concept/booking/lookup";
import { changeRule } from "@/concept/booking/policy";
import { parseBookingRequest } from "@/concept/booking/request";
import { openSlots, suggestSlots } from "@/concept/booking/suggest";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, isFree } from "@/concept/data/slots";

// 2026-11-16 is a Monday.
const today = "2026-11-16";
const clock = { today, minutes: 9 * 60 };
const state = createDemoState(today);

describe("booking request wrapper", () => {
  it("reads the flagship sentence", () => {
    const request = parseBookingRequest("foot care some afternoon next week with Anna", state, today);
    expect(request).toMatchObject({ staffId: "anna", period: "afternoon", from: "2026-11-23", to: "2026-11-29", soonest: false });
    expect(request.serviceCandidates).toContain("medical-foot-care");
    expect(request.serviceId).toBe(request.serviceCandidates[0]);
  });

  it("handles a named day, a time and typos", () => {
    const request = parseBookingRequest("deep tissue massage tomorow at 3pm", state, today);
    expect(request).toMatchObject({ serviceId: "deep-tissue", from: "2026-11-17", to: "2026-11-17", time: 15 * 60 });
    expect(parseBookingRequest("massage thursday next week afternon", state, today)).toMatchObject({ from: "2026-11-26", to: "2026-11-26", period: "afternoon" });
  });

  it("treats 'after work' as evening and 'as soon as possible' as an open window", () => {
    expect(parseBookingRequest("classic massage after work", state, today).period).toBe("evening");
    const soon = parseBookingRequest("ingrown nail as soon as possible", state, today);
    expect(soon).toMatchObject({ serviceId: "ingrown-nail", from: today, to: addDays(today, 14), soonest: true });
  });

  it("finds nothing instead of guessing", () => {
    expect(parseBookingRequest("hello there", state, today).serviceId).toBeUndefined();
  });
});

describe("slot suggestions", () => {
  const query = { serviceId: "medical-foot-care", from: "2026-11-23", to: "2026-11-29", period: "afternoon" as const };

  it("returns three free afternoon times spread over several days", () => {
    const slots = suggestSlots(state, query, clock);
    expect(slots).toHaveLength(3);
    expect(new Set(slots.map((s) => s.date)).size).toBeGreaterThan(1);
    for (const slot of slots) {
      expect(slot.start).toBeGreaterThanOrEqual(12 * 60);
      expect(slot.start).toBeLessThan(17 * 60);
      expect(isFree(state, slot.staffId, slot.date, slot.start, 60)).toBe(true);
    }
  });

  it("stays on the one day asked for and offers a second option there", () => {
    const slots = suggestSlots(state, { ...query, from: "2026-11-24", to: "2026-11-24", period: undefined }, clock);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.date === "2026-11-24")).toBe(true);
  });

  it("prefers the time closest to the one asked for", () => {
    const [slot] = suggestSlots(state, { ...query, from: "2026-11-24", to: "2026-11-24", period: undefined, time: 15 * 60 }, clock, 1);
    const free = freeStarts(state, "anna", "2026-11-24", 60, { step: 30 });
    const closest = [...free].sort((a, b) => Math.abs(a - 900) - Math.abs(b - 900))[0];
    expect(slot.start).toBe(closest);
  });

  it("keeps a lead time today and nothing on closed days", () => {
    expect(openSlots(state, "classic-60", today, { today, minutes: 17 * 60 })).toEqual([]);
    expect(openSlots(state, "classic-60", "2026-11-22", clock)).toEqual([]);
    expect(openSlots(state, "classic-60", "2026-11-10", clock)).toEqual([]);
  });

  it("returns nothing when the day is full", () => {
    const date = "2026-11-24";
    let full = state;
    for (const start of freeStarts(state, "anna", date, 30, { step: 30 })) {
      full = reduce(full, { type: "booking/create", customerId: "k001", serviceId: "ingrown-nail", staffId: "anna", date, start, source: "phone" });
    }
    expect(suggestSlots(full, { serviceId: "medical-foot-care", from: date, to: date }, clock)).toEqual([]);
  });
});

describe("change rule", () => {
  const booking = { date: "2026-11-18", start: 14 * 60, status: "booked" as const };
  it("is free until 24 hours before, then late, then past", () => {
    expect(changeRule(booking, "2026-11-17", 14 * 60)).toBe("free");
    expect(changeRule(booking, "2026-11-17", 14 * 60 + 1)).toBe("late");
    expect(changeRule(booking, "2026-11-18", 14 * 60)).toBe("past");
    expect(changeRule({ ...booking, status: "cancelled" }, today, 0)).toBe("past");
  });
});

describe("customer lookup", () => {
  it("matches phone numbers across formats", () => {
    expect(normalizePhone("070-174 06 50")).toBe(normalizePhone("+46 70 174 06 50"));
    const customer = state.customers[0];
    expect(findCustomerByPhone(state, customer.phone.replace(/-/g, " "))?.id).toBe(customer.id);
    expect(findCustomerByPhone(state, "123")).toBeUndefined();
  });

  it("splits upcoming and past bookings", () => {
    const upcoming = state.bookings.find((b) => b.status === "booked" && b.date > today)!;
    const result = customerBookings(state, upcoming.customerId, today, clock.minutes);
    expect(result.upcoming.map((b) => b.id)).toContain(upcoming.id);
    expect(result.past.every((b) => b.status !== "cancelled" && !result.upcoming.includes(b))).toBe(true);
  });
});

describe("online booking actions", () => {
  const date = "2026-11-24";
  const [start] = freeStarts(state, "anna", date, 60, { step: 30 });
  const notice = { title: "New online booking", body: "Medical foot care" };
  const guest = { name: "Lisa Berg", phone: "073-555 01 02", at: { date: today, time: 600 } };
  const book = { type: "online/book", guest, notice, serviceId: "medical-foot-care", staffId: "anna", date, start } as const;

  it("books a new customer and tells the owner", () => {
    const next = reduce(state, book);
    const booking = next.bookings[next.bookings.length - 1];
    const customer = next.customers.find((c) => c.id === booking.customerId)!;
    expect(customer).toMatchObject({ firstName: "Lisa", lastName: "Berg" });
    expect(booking).toMatchObject({ source: "online", status: "booked", date, start });
    expect(next.inbox[0]).toMatchObject({ title: "New online booking", customerId: customer.id, bookingId: booking.id, read: false });
  });

  it("reuses a known customer by phone and refuses a taken slot", () => {
    const known = state.customers[0];
    const next = reduce(state, { ...book, guest: { ...guest, name: "Someone Else", phone: known.phone } });
    expect(next.customers).toHaveLength(state.customers.length);
    expect(next.bookings[next.bookings.length - 1].customerId).toBe(known.id);
    expect(reduce(reduce(state, book), { ...book, guest: { ...guest, phone: "073-999 99 99" } })).toEqual(reduce(state, book));
  });

  it("adds a waiting-list request that the owner can answer", () => {
    const next = reduce(state, { type: "online/waitlist", guest, notice: { title: "Waiting list", body: "Wants a time", draftReply: "Hi" }, serviceId: "medical-foot-care" });
    expect(next.customers[next.customers.length - 1]).toMatchObject({ firstName: "Lisa", waitlist: true });
    expect(next.inbox[0]).toMatchObject({ title: "Waiting list", handled: false, draftReply: "Hi" });
  });

  it("moves a booking with an inbox notice only when the new slot is free", () => {
    const booked = reduce(state, book);
    const booking = booked.bookings[booked.bookings.length - 1];
    const [later] = freeStarts(booked, "anna", addDays(date, 1), 60, { step: 30 });
    const moved = reduce(booked, { type: "booking/move", id: booking.id, date: addDays(date, 1), start: later, notice: { kind: "reschedule", date: today, time: 600, title: "Moved", body: "", read: false, handled: true } });
    expect(moved.bookings.find((b) => b.id === booking.id)).toMatchObject({ date: addDays(date, 1), start: later });
    expect(moved.inbox[0].title).toBe("Moved");
    expect(reduce(booked, { type: "booking/move", id: booking.id, date: "2026-11-22", start: 600, notice: { kind: "reschedule", date: today, time: 0, title: "x", body: "", read: false, handled: true } })).toBe(booked);
  });
});

describe("calendar file", () => {
  it("describes the visit in local time with a reminder", () => {
    const booking = state.bookings.find((b) => b.status === "booked")!;
    const service = state.services.find((s) => s.id === booking.serviceId)!;
    const staff = state.staff.find((s) => s.id === booking.staffId)!;
    const ics = buildIcs({ booking, service, staff, salon: state.salon, createdAt: "20261116T080000Z" });
    expect(ics).toContain(`DTSTART:${booking.date.replace(/-/g, "")}T`);
    expect(ics).toContain("SUMMARY:" + service.name);
    expect(ics).toContain("LOCATION:Salong Eko\\, Dalagatan 34");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
});
