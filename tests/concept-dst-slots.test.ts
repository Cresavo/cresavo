import { describe, expect, it } from "vitest";
import { earliestBookingStart, LEAD_MINUTES } from "@/concept/booking/policy";
import { createDemoState } from "@/concept/data/generate";
import { isFree, pickResource } from "@/concept/data/slots";
import type { Booking, DemoState } from "@/concept/data/types";

// Availability around the Europe/Stockholm clock changes judges overlap and lead time in elapsed time.
// 2027-03-28 skips 02:00-03:00 (a Sunday); 2027-10-31 repeats 02:00-03:00. Fictional data only.

const base = createDemoState("2026-11-16");
const service = base.services.find((s) => s.id === "medical-foot-care")!;
const night: DemoState = {
  ...base,
  bookings: [],
  salon: { ...base.salon, lunch: null, hours: { ...base.salon.hours, 0: { open: 0, close: 1440 } } },
  staff: base.staff.map((s) => ({ ...s, week: { ...s.week, 0: { start: 0, end: 1440 } } })),
};
const need = (duration: number) => ({ serviceId: service.id, duration });
const visit = (date: string, start: number, duration: number, extra: Partial<Booking> = {}): Booking =>
  ({ ...base.bookings[0], id: `fixture-${date}-${start}`, staffId: "anna", date, start, duration, status: "booked", resourceId: undefined, ...extra });
const withVisit = (booking: Booking): DemoState => ({ ...night, bookings: [booking] });

describe("elapsed-time overlap on the spring night", () => {
  const spring = "2027-03-28";

  it("lets a 60-minute visit at 01:30 block a 03:00 booking for the same person, as they share 30 real minutes", () => {
    const state = withVisit(visit(spring, 90, 60));
    expect(isFree(state, "anna", spring, 180, need(30))).toBe(false);
    // The visit ends at 03:30 on the wall clock: 03:30 is free, 03:29 is not.
    expect(isFree(state, "anna", spring, 210, need(30))).toBe(true);
    expect(isFree(state, "anna", spring, 209, need(30))).toBe(false);
  });

  it("blocks the same room across the change and keeps another room free", () => {
    const room = { ...night, bookings: [visit(spring, 90, 60, { resourceId: "chair-1" })], resources: [{ id: "chair-1", name: "Chair 1" }, { id: "chair-2", name: "Chair 2" }] } as unknown as DemoState;
    const roomService = { ...service, resourceIds: ["chair-1", "chair-2"] };
    const state = { ...room, services: [roomService, ...room.services.filter((s) => s.id !== service.id)] };
    expect(pickResource(state, need(30), spring, 180)).toBe("chair-2");
    expect(pickResource({ ...state, resources: [state.resources[0]], services: [{ ...roomService, resourceIds: ["chair-1"] }] }, need(30), spring, 180)).toBeUndefined();
  });

  it("does not let a visit before the change block one that starts after its real end", () => {
    // 00:30 + 60 minutes ends at 01:30, long before 03:00.
    const state = withVisit(visit(spring, 30, 60));
    expect(isFree(state, "anna", spring, 180, need(30))).toBe(true);
  });

  it("counts clean-up time in elapsed minutes too", () => {
    const state = withVisit(visit(spring, 90, 30, { bufferAfter: 60 }));
    // Busy from 01:30 for 30 + 60 real minutes: until 04:00 on the wall clock.
    expect(isFree(state, "anna", spring, 180, need(30))).toBe(false);
    expect(isFree(state, "anna", spring, 239, need(1))).toBe(false);
    expect(isFree(state, "anna", spring, 240, need(30))).toBe(true);
  });
});

describe("elapsed-time overlap on the autumn night", () => {
  const autumn = "2027-10-31";

  it("lets a visit in the first 02:30 end before 03:00 CET, where the wall clock says it overlaps", () => {
    // 02:30 CEST + 60 minutes = 02:30 CET; 03:00 CET is 30 real minutes later.
    const state = withVisit(visit(autumn, 150, 60));
    expect(isFree(state, "anna", autumn, 180, need(30))).toBe(true);
    expect(isFree(state, "anna", autumn, 165, need(15))).toBe(false);
  });

  it("blocks starts that fall inside the repeated hour's first pass", () => {
    const state = withVisit(visit(autumn, 120, 90));
    // 02:00 CEST for 90 minutes ends at 02:30 CET: the first-pass 02:45 start is inside it, 03:00 CET is not.
    expect(isFree(state, "anna", autumn, 165, need(15))).toBe(false);
    expect(isFree(state, "anna", autumn, 180, need(15))).toBe(true);
  });
});

describe("a normal day is judged as before", () => {
  it("blocks wall-clock overlaps and frees touching visits", () => {
    const state = withVisit(visit("2027-04-04", 90, 60));
    expect(isFree(state, "anna", "2027-04-04", 120, need(30))).toBe(false);
    expect(isFree(state, "anna", "2027-04-04", 150, need(30))).toBe(true);
  });
});

describe("earliestBookingStart", () => {
  it("adds the lead time to the wall clock on an ordinary day, today and later", () => {
    expect(earliestBookingStart("2026-11-16", "2026-11-16", 600)).toBe(600 + LEAD_MINUTES);
    expect(earliestBookingStart("2026-11-18", "2026-11-16", 600)).toBe(600 + LEAD_MINUTES - 2 * 24 * 60);
  });

  it("counts the lead time in elapsed minutes over the spring change: 01:30 plus an hour is 03:30", () => {
    expect(earliestBookingStart("2027-03-28", "2027-03-28", 90)).toBe(210);
    // Booked on the Saturday evening for the Sunday morning: 23:30 + 60 min is 00:30 elapsed on the 28th.
    expect(earliestBookingStart("2027-03-28", "2027-03-27", 23 * 60 + 30)).toBe(30);
  });

  it("counts it for a later day too, when the change lies between now and then", () => {
    // 2027-03-27 12:00 + 60 min = 13:00 that day; the next day's start is 11 h and a day later on the wall clock, no shift in the sum.
    expect(earliestBookingStart("2027-03-29", "2027-03-27", 12 * 60)).toBe(13 * 60 - 2 * 24 * 60);
    // From 2027-03-28 03:30 (after the change), the same hour on the 29th is 24 real hours on.
    expect(earliestBookingStart("2027-03-29", "2027-03-28", 210)).toBe(270 - 24 * 60);
  });

  it("over the autumn change, an hour from 02:30 CEST is 02:30 CET, whose first wall start is 03:00", () => {
    expect(earliestBookingStart("2027-10-31", "2027-10-31", 150)).toBe(180);
    expect(earliestBookingStart("2027-10-31", "2027-10-31", 60)).toBe(120);
  });
});
