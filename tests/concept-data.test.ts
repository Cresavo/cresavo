import { describe, expect, it } from "vitest";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { upcomingHolidays } from "@/concept/data/holidays";
import { freeGaps, freeStarts, isFree, openingFor, staffWorks } from "@/concept/data/slots";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { notSeenInThreeMonths } from "@/concept/customers/segments";
import { buildCustomerStats, lowStock, utilisation } from "@/concept/selectors";

const today = "2026-11-16";
const state = createDemoState(today);

describe("concept demo data", () => {
  it("is deterministic for a given day", () => {
    expect(JSON.stringify(createDemoState(today))).toBe(JSON.stringify(state));
  });

  it("has the salon, two staff and plenty of customers", () => {
    expect(state.salon.name).toBe("Salong Eko");
    expect(state.staff.map((s) => s.firstName)).toEqual(["Anna", "Erik"]);
    expect(state.customers.filter((c) => c.isRegular)).toHaveLength(40);
    expect(new Set(state.customers.map((c) => c.phone)).size).toBe(state.customers.length);
  });

  it("never double-books a staff member", () => {
    const active = state.bookings.filter((b) => b.status !== "cancelled");
    for (const b of active) {
      const clash = active.find(
        (o) => o !== b && o.staffId === b.staffId && o.date === b.date && o.start < b.start + b.duration && b.start < o.start + o.duration,
      );
      expect(clash).toBeUndefined();
    }
  });

  it("is about 70% booked for the next three weeks and has six months of history", () => {
    const booked = utilisation(state, today, 21);
    expect(booked).toBeGreaterThan(0.6);
    expect(booked).toBeLessThan(0.8);
    expect(state.bookings.some((b) => b.date <= addDays(today, -175))).toBe(true);
  });

  it("includes the story items: low stock, late customers, inbox and reviews", () => {
    expect(lowStock(state).map((s) => s.id)).toEqual(["urea-cream", "massage-oil-neutral"]);
    expect(notSeenInThreeMonths(state, buildCustomerStats(state, today), today).length).toBeGreaterThan(3);
    expect(state.inbox.filter((i) => !i.read).length).toBeGreaterThan(3);
    expect(state.reviews.length).toBeGreaterThan(70);
  });

  it("finds free starts that respect lunch and existing bookings", () => {
    const date = addDays(today, 30);
    for (const start of freeStarts(state, "anna", date, { serviceId: "medical-foot-care", duration: 60 })) {
      expect(start + 60 <= 12 * 60 || start >= 13 * 60).toBe(true);
      expect(isFree(state, "anna", date, start, { serviceId: "medical-foot-care", duration: 60 })).toBe(true);
    }
    expect(freeStarts(state, "anna", "2026-11-22", { serviceId: "ingrown-nail", duration: 30 })).toEqual([]);
  });
});

describe("the demo day is never empty", () => {
  // A whole week from Monday, so Saturday and Sunday are included.
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  it.each(week)("%s is a full working day with visits to come and a free gap", (day) => {
    const demo = day === today ? state : createDemoState(day);
    expect(openingFor(demo.salon, day)).not.toBeNull();
    for (const person of demo.staff) expect(staffWorks(demo, person.id, day)).toBe(true);
    const booked = demo.bookings.filter((b) => b.date === day && b.status === "booked");
    expect(booked.length).toBeGreaterThanOrEqual(8);
    // Spread over the day: one in the first hour, and someone still to come until half past five.
    expect(Math.min(...booked.map((b) => b.start))).toBeLessThanOrEqual(10 * 60);
    expect(Math.max(...booked.map((b) => b.start + b.duration))).toBeGreaterThanOrEqual(17 * 60 + 30);
    expect(demo.staff.flatMap((person) => freeGaps(demo, person.id, day, { after: 9 * 60, min: 30 })).length).toBeGreaterThan(0);
  }, 20000);

  it("leaves a new salon's own hours alone, closed days included", () => {
    const sunday = "2026-11-22";
    const own = createSalon(sunday, salonDraft("en"));
    expect(own.salon.hours[0]).toBeNull();
    expect(openingFor(own.salon, sunday)).toBeNull();
  });
});

describe("holiday calendar", () => {
  it("computes Swedish holiday dates", () => {
    const list = upcomingHolidays(today);
    const date = (name: string) => list.find((h) => h.name === name)?.date;
    expect(date("Black Friday")).toBe("2026-11-27");
    expect(date("First Advent")).toBe("2026-11-29");
    expect(date("Easter")).toBe("2027-03-28");
    expect(date("Midsummer")).toBe("2027-06-25");
    expect(date("Mother's Day")).toBe("2027-05-30");
  });
});
