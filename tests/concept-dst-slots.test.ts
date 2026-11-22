import { describe, expect, it } from "vitest";
import { earliestBookingStart, LEAD_MINUTES } from "@/concept/booking/policy";
import { createDemoState } from "@/concept/data/generate";
import { publicSalonView } from "@/concept/booking/public-projection";
import { canBlock, freeGaps, freeStarts, isFree, pickResource } from "@/concept/data/slots";
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

describe("blocks, gaps, shifts and fixed blocks on the clock-change nights", () => {
  const spring = "2027-03-28";
  const autumn = "2027-10-31";
  const closing = (hours: number) => ({
    ...night, bookings: [] as Booking[],
    salon: { ...night.salon, hours: { ...night.salon.hours, 0: { open: 0, close: hours * 60 } } },
    staff: night.staff.map((s) => ({ ...s, week: { ...s.week, 0: { start: 0, end: hours * 60 } } })),
  });

  it("refuses a block over time a visit really occupies and reports the gap in elapsed terms", () => {
    const state = withVisit(visit(spring, 90, 60));
    expect(canBlock(state, "anna", spring, 180, 210)).toBe(false);
    expect(canBlock(state, "anna", spring, 210, 240)).toBe(true);
    expect(canBlock(state, "anna", spring, 30, 90)).toBe(true);
    expect(freeGaps(state, "anna", spring, { min: 1 }).slice(0, 2)).toEqual([{ start: 0, end: 90 }, { start: 210, end: 1440 }]);
  });

  it("judges the end of a visit against the shift in elapsed time", () => {
    // Closing at 03:00 on the spring night: 01:30 + 60 minutes ends at 03:30 on the wall clock, after closing.
    expect(isFree(closing(3), "anna", spring, 90, need(60))).toBe(false);
    expect(isFree(closing(3), "anna", spring, 30, need(60))).toBe(true);
    expect(freeStarts(closing(3), "anna", spring, need(60)).at(-1)).toBe(60);
    // Autumn: 02:30 CEST + 60 minutes ends at 02:30 CET, well before a 03:00 close.
    expect(isFree(closing(3), "anna", autumn, 150, need(60))).toBe(true);
  });

  it("keeps a fixed block that starts in the skipped hour in force from the jump", () => {
    const state = { ...night, blocks: [{ id: "blk", staffId: "anna" as const, date: spring, start: 150, end: 210, reason: "admin" as const }] };
    expect(isFree(state, "anna", spring, 180, need(30))).toBe(false);
    expect(isFree(state, "anna", spring, 210, need(30))).toBe(true);
  });

  it("tells the repeated hour's second 02:30 from the first when the trusted instant is known", () => {
    const second = Date.parse("2027-10-31T01:30:00Z"); // 02:30 CET, the second pass
    const first = Date.parse("2027-10-30T23:30:00Z"); // 02:30 CEST
    expect(earliestBookingStart("2027-10-31", "2027-10-31", 150, second)).toBe(210);
    expect(earliestBookingStart("2027-10-31", "2027-10-31", 150, first)).toBe(180);
    // An instant that names another minute is ignored.
    expect(earliestBookingStart("2027-10-31", "2027-10-31", 150, Date.parse("2027-10-31T05:00:00Z"))).toBe(180);
  });

  it("keeps the seconds out of the lead time on an ordinary day", () => {
    const at = Date.parse("2026-11-16T08:00:20Z"); // 09:00:20 in Stockholm
    expect(earliestBookingStart("2026-11-16", "2026-11-16", 540, at)).toBe(600);
    expect(earliestBookingStart("2026-11-16", "2026-11-16", 540, at)).toBe(earliestBookingStart("2026-11-16", "2026-11-16", 540));
    expect(earliestBookingStart("2027-10-31", "2027-10-31", 150, Date.parse("2027-10-31T01:30:20Z"))).toBe(210);
  });

  it("ends a block at the first 03:00 of the autumn night, so it does not reach the repeated hour's second pass", () => {
    // A treatment starts 02:00 (first pass), waits 02:30-03:30 elapsed, and resumes at the second 02:30.
    const resumes = { serviceId: service.id, duration: 120, processing: { after: 30, duration: 60 } };
    const state = { ...night, blocks: [{ id: "blk", staffId: "anna" as const, date: autumn, start: 165, end: 180, reason: "admin" as const }] };
    expect(isFree(state, "anna", autumn, 120, resumes)).toBe(true);
    expect(canBlock(night, "anna", autumn, 165, 180)).toBe(true);
    // The block still holds the first pass: a visit there is refused.
    expect(isFree(state, "anna", autumn, 165, need(15))).toBe(false);
  });

  it("projects a completed visit's timing as the store judges it", () => {
    const completed = visit("2027-04-04", 600, 60, { status: "completed", bufferAfter: 120 });
    const state = withVisit(completed);
    expect(isFree(state, "anna", "2027-04-04", 720, need(30))).toBe(true);
    const projected = publicSalonView(state, new Date("2027-04-01T08:00:00Z"));
    expect(isFree(projected, "anna", "2027-04-04", 720, need(30))).toBe(true);
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
