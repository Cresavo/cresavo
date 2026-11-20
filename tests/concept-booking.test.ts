import { describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { buildIcs, googleCalendarLink } from "@/concept/booking/ics";
import { recallGuest, rememberGuest } from "@/concept/booking/guest";
import { customerBookings, findCustomerByPhone, isMobilePhone, normalizePhone, phoneMatches } from "@/concept/booking/lookup";
import { changeRule, freeCancellationDeadline } from "@/concept/booking/policy";
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

  it.each(["December 24", "24 december", "Christmas Eve", "julafton"])("keeps the specific day requested as %s", (date) => {
    expect(parseBookingRequest(`Foot care ${date}`, state, today)).toMatchObject({
      serviceId: "medical-foot-care", from: "2026-12-24", to: "2026-12-24", soonest: false,
    });
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
      expect(isFree(state, slot.staffId, slot.date, slot.start, { serviceId: "medical-foot-care", duration: 60 })).toBe(true);
    }
  });

  it("stays on the one day asked for and offers a second option there", () => {
    const slots = suggestSlots(state, { ...query, from: "2026-11-24", to: "2026-11-24", period: undefined }, clock);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.date === "2026-11-24")).toBe(true);
  });

  it("prefers the time closest to the one asked for", () => {
    const [slot] = suggestSlots(state, { ...query, from: "2026-11-24", to: "2026-11-24", period: undefined, time: 15 * 60 }, clock, 1);
    const free = freeStarts(state, "anna", "2026-11-24", { serviceId: "medical-foot-care", duration: 60 }, { step: 30 });
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
    for (const start of freeStarts(state, "anna", date, { serviceId: "ingrown-nail", duration: 30 }, { step: 30 })) {
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

  it.each([["2027-01-01", 14], ["2027-03-28", 13], ["2027-10-31", 15]] as const)("uses the same elapsed-hour deadline and cutoff on %s", (date, hour) => {
    const appointment = { ...booking, date, start: 14 * 60 + 15 };
    const deadline = freeCancellationDeadline(appointment);
    expect(deadline).toEqual({ date: addDays(date, -1), time: hour * 60 + 15 });
    expect(changeRule(appointment, deadline.date, deadline.time)).toBe("free");
    expect(changeRule(appointment, deadline.date, deadline.time + 1)).toBe("late");
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
  const [start] = freeStarts(state, "anna", date, { serviceId: "medical-foot-care", duration: 60 }, { step: 30 });
  const notice = { title: "New online booking", body: "Medical foot care" };
  const guest = { name: "Lisa Berg", phone: "073-555 01 02", at: { date: today, time: 600 } };
  const book = { type: "online/book", guest, notice, serviceId: "medical-foot-care", staffId: "anna", date, start } as const;
  // The salon's clock at the moment the guest acted: waiting-list requests for a passed day end at once.
  const guestMoment = Date.parse(`${today}T10:00:00+01:00`);

  it("books a new customer and tells the owner", () => {
    const next = reduce(state, book);
    const booking = next.bookings[next.bookings.length - 1];
    const customer = next.customers.find((c) => c.id === booking.customerId)!;
    expect(customer).toMatchObject({ firstName: "Lisa", lastName: "Berg" });
    expect(booking).toMatchObject({ source: "online", status: "booked", date, start });
    expect(next.inbox.filter(item => item.bookingId === booking.id && item.delivery).map(item => item.delivery?.channel).sort()).toEqual(["email", "sms"]);
    expect(next.inbox.find(item => item.kind === "request" && item.bookingId === booking.id)).toMatchObject({ title: "New online booking", customerId: customer.id, bookingId: booking.id, read: false });
  });

  it("refuses a still-free slot once the confirmation falls inside the lead time", () => {
    const at = { date, time: start - 60 };
    expect(openSlots(state, book.serviceId, date, { today: date, minutes: at.time })).toContainEqual({ date, start, staffId: "anna" });
    expect(reduce(state, { ...book, guest: { ...guest, at } }).bookings).toHaveLength(state.bookings.length + 1);
    expect(reduce(state, { ...book, guest: { ...guest, at: { ...at, time: at.time + 1 } } })).toBe(state);
    expect(reduce(state, { ...book, guest: { ...guest, at: { date: addDays(date, 1), time: 0 } } })).toBe(state);
  });

  it("reuses a known customer by phone and refuses a taken slot", () => {
    const known = state.customers[0];
    const next = reduce(state, { ...book, guest: { ...guest, name: "Someone Else", phone: known.phone } });
    expect(next.customers).toHaveLength(state.customers.length);
    expect(next.bookings[next.bookings.length - 1].customerId).toBe(known.id);
    expect(reduce(reduce(state, book), { ...book, guest: { ...guest, phone: "073-999 99 99" } })).toEqual(reduce(state, book));
  });

  it("adds a waiting-list request that the owner can answer", () => {
    const next = reduce(state, { type: "online/waitlist", guest, notice: { title: "Waiting list", body: "Wants a time", draftReply: "Hi" }, serviceId: "medical-foot-care" }, guestMoment);
    expect(next.customers[next.customers.length - 1]).toMatchObject({ firstName: "Lisa", waitlist: true });
    expect(next.inbox[0]).toMatchObject({ title: "Waiting list", handled: false, draftReply: "Hi" });
  });

  it("keeps the requested practitioner on the waiting-list request", () => {
    const request = { type: "online/waitlist", guest, notice, serviceId: "classic-60", staffId: "erik" } as const;
    const next = reduce(state, request, guestMoment);
    expect(next.inbox[0]).toMatchObject({ requestedStaffId: "erik", customerId: next.customers.at(-1)!.id });
    expect(next.customers.at(-1)).toMatchObject({ preferredStaff: "erik", waitlist: true });
    expect(reduce(state, { ...request, staffId: "anna" }, guestMoment)).toBe(state);
  });

  it("moves a booking with an inbox notice only when the new slot is free", () => {
    const booked = reduce(state, book);
    const booking = booked.bookings[booked.bookings.length - 1];
    const [later] = freeStarts(booked, "anna", addDays(date, 1), { serviceId: "medical-foot-care", duration: 60 }, { step: 30 });
    const moved = reduce(booked, { type: "booking/move", id: booking.id, date: addDays(date, 1), start: later, notice: { kind: "reschedule", date: today, time: 600, title: "Moved", body: "", read: false, handled: true } });
    expect(moved.bookings.find((b) => b.id === booking.id)).toMatchObject({ date: addDays(date, 1), start: later });
    expect(moved.inbox[0].title).toBe("Moved");
    expect(reduce(booked, { type: "booking/move", id: booking.id, date: "2026-11-22", start: 600, notice: { kind: "reschedule", date: today, time: 0, title: "x", body: "", read: false, handled: true } })).toBe(booked);
  });
});

describe("calendar file", () => {
  it("describes the visit with an absolute start and a reminder", () => {
    const booking = state.bookings.find((b) => b.status === "booked")!;
    const service = state.services.find((s) => s.id === booking.serviceId)!;
    const staff = state.staff.find((s) => s.id === booking.staffId)!;
    const ics = buildIcs({ booking, service, staff, salon: state.salon, createdAt: "20261116T080000Z" });
    expect(ics).toContain(`DTSTART:${booking.date.replace(/-/g, "")}T`);
    expect(ics).toContain("SUMMARY:" + service.name);
    expect(ics).toContain("LOCATION:Salong Eko\\, Dalagatan 34");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });

  it.each([
    [600, "2026-01-12", "090000Z", "100000Z"],
    [600, "2026-03-29", "080000Z", "090000Z"],
    [600, "2026-07-13", "080000Z", "090000Z"],
    [600, "2026-10-25", "090000Z", "100000Z"],
    [150, "2026-10-25", "003000Z", "013000Z"],
  ])(
    "exports salon minute %i on %s to both calendars", (minute, date, start, end) => {
      const booking = { ...state.bookings[0], date, start: minute, duration: 60 };
      const visit = { booking, service: state.services[0], salon: state.salon, language: "sv" as const };
      const google = new URL(googleCalendarLink(visit));
      const day = date.replaceAll("-", "");
      expect(google.searchParams.get("dates")).toBe(`${day}T${start}/${day}T${end}`);
      expect(google.searchParams.get("text")).toBe("Medicinsk fotvård hos Salong Eko");
      const ics = buildIcs({ ...visit, staff: state.staff[0], createdAt: "20260101T080000Z" });
      expect(ics).toContain(`DTSTART:${day}T${start}\r\nDTEND:${day}T${end}`);
      expect(ics).toContain("SUMMARY:Medicinsk fotvård hos Salong Eko");
      expect(ics).toContain("DESCRIPTION:Du har en bokad tid om en timme");
    },
  );
});

describe("phone input and search", () => {
  it.each(["070-173 74 60", "0701737460", "+46 70 173 74 60", "0046 70 173 74 60", "1737460"])("matches %s", (query) => {
    expect(phoneMatches("070-173 74 60", query)).toBe(true);
  });

  it("matches an international contact with its national number", () => {
    expect(phoneMatches("+44 7700 900123", "07700 900123")).toBe(true);
    expect(phoneMatches("07700 900123", "+44 7700 900123")).toBe(true);
    expect(phoneMatches("+44 7700 900123", "name 900123")).toBe(false);
  });

  it.each(["070-173 74 60", "+46 70 173 74 60", "0046 70 173 74 60", "+44 7700 900123", "078-123 45 67"])("accepts %s as a mobile", (phone) => {
    expect(isMobilePhone(phone)).toBe(true);
  });

  it.each(["00000000", "070-000 00 00", "078-323 45 67", "12345678", "+0000000000", "+10000000000", "0701737460abc", "+4612345678901234"])("rejects %s as a mobile", (phone) => {
    expect(isMobilePhone(phone)).toBe(false);
  });
});

describe("device contact consent", () => {
  it("discards automatic legacy prefill, scopes new consent to one salon and supports forgetting", () => {
    const guest = { customerId: "k-demo", name: "Nova Demo", phone: "070-000 99 11" };
    const entries = new Map([["salong-eko-guest", JSON.stringify(guest)]]);
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => entries.get(key) ?? null,
      removeItem: (key: string) => entries.delete(key),
      setItem: (key: string, value: string) => entries.set(key, value),
    } });
    try {
      expect(recallGuest("leaf")).toBeUndefined();
      expect(entries.size).toBe(0);
      rememberGuest("leaf", guest);
      expect(recallGuest("leaf")).toEqual(guest);
      expect(recallGuest("fern")).toBeUndefined();
      rememberGuest("leaf");
      expect(recallGuest("leaf")).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
