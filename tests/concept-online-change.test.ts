import { describe, expect, it } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { visitTime } from "@/concept/booking/policy";
import { acceptedTerms } from "@/concept/booking/public-terms";
import { createDemoState } from "@/concept/data/generate";
import { payAtSalon } from "./helpers/pay-at-salon";
import { freeStarts, isFree } from "@/concept/data/slots";
import { balanceOf } from "@/concept/giftcards/cards";
import type { DemoState, StaffId } from "@/concept/data/types";
import { withTenantPresentation } from "@/concept/i18n/presentation";

// A customer's cancel and move from their booking link, decided by the
// reducer: before the free-cancellation deadline only, never a payment.
// 2026-11-16 is a Monday; the visit is on 2026-11-24 at the day's first free
// time, so the 24 h deadline is 2026-11-23 at that time. Fictional data only.

const today = "2026-11-16";
const base = payAtSalon(createDemoState(today));
const service = base.services.find((s) => s.id === "medical-foot-care")!;
const first = (state: DemoState, date: string, staffId: StaffId = "anna") => freeStarts(state, staffId, date, { serviceId: service.id, duration: service.duration }, { step: 30 });
const date = "2026-11-24";
const start = first(base, date)[0];
const at = (day: string, time: number) => ({ date: day, time });
const slug = base.salon.slug;

const booked = reduce(base, {
  type: "online/book", guest: { name: "Lisa Berg", phone: "073-555 01 02", email: "lisa@example.test", at: at(today, 600) },
  serviceId: service.id, staffId: "anna", date, start, public: { slug, terms: acceptedTerms(base, service), publicRef: "ref-fictional-1" },
});
const visit = booked.bookings.at(-1)!;
// The store stamps the trusted instant with the clock `at` names; tests that care about the exact moment pass their own.
const instantOf = ({ date: day, time }: { date: string; time: number }) => visitTime({ date: day, start: time }).toMillis();
const seen = { date, start, staffId: "anna" as StaffId };
const cancel = (over: Partial<Extract<DemoAction, { type: "online/cancel" }>> = {}): DemoAction => {
  const when = over.at ?? at(today, 700);
  return { type: "online/cancel", id: visit.id, at: when, instant: instantOf(when), public: { slug }, expected: seen, ...over };
};
const move = (over: Partial<Extract<DemoAction, { type: "online/move" }>> = {}): DemoAction => {
  const when = over.at ?? at(today, 700);
  return { type: "online/move", id: visit.id, at: when, instant: instantOf(when), public: { slug }, expected: seen, staffId: "anna", date: "2026-11-25", start: first(booked, "2026-11-25")[0], ...over };
};
const deadlineDay = "2026-11-23";

describe("online/cancel", () => {
  it("cancels a booked visit before the deadline, frees the time and tells the owner and the customer", () => {
    const next = withTenantPresentation(booked, () => reduce(booked, cancel()));
    expect(next.bookings.find((b) => b.id === visit.id)).toMatchObject({ status: "cancelled", cancelReason: "Cancelled by the customer online" });
    expect(first(next, date)).toContain(start);
    expect(next.inbox.find((i) => i.kind === "cancel")).toMatchObject({ bookingId: visit.id, title: "Customer cancelled online" });
    expect(next.inbox.filter((i) => i.delivery?.kind === "cancellation" && i.delivery.channel === "email")).toHaveLength(1);
  });

  it("is open up to the deadline and refused after it, however the visit is approached", () => {
    expect(reduce(booked, cancel({ at: at(deadlineDay, start) }))).not.toBe(booked);
    expect(reduce(booked, cancel({ at: at(deadlineDay, start + 1) }))).toBe(booked);
    expect(reduce(booked, cancel({ at: at(date, 0) }))).toBe(booked);
  });

  it("is open at the cutoff instant itself and closed one millisecond later", () => {
    const cutoff = visitTime({ date, start }).minus({ hours: 24 }).toMillis();
    expect(reduce(booked, cancel({ instant: cutoff }))).not.toBe(booked);
    expect(reduce(booked, cancel({ instant: cutoff + 1 }))).toBe(booked);
    expect(reduce(booked, move({ instant: cutoff + 1 }))).toBe(booked);
  });

  it("judges the cutoff in the repeated hour of the autumn clock change by the instant, not the wall clock", () => {
    // 2026-10-26 02:30 is 01:30 UTC, so its cutoff is 2026-10-25 01:30 UTC: the second 02:30 of that Sunday.
    const autumn = { ...booked, bookings: booked.bookings.map((b) => (b.id === visit.id ? { ...b, date: "2026-10-26", start: 150 } : b)) };
    const seenThen = { date: "2026-10-26", start: 150, staffId: "anna" as StaffId };
    const at0 = (instant: number): DemoAction => cancel({ at: at("2026-10-25", 150), instant, expected: seenThen });
    const secondTwoThirty = Date.UTC(2026, 9, 25, 1, 30);
    expect(reduce(autumn, at0(Date.UTC(2026, 9, 25, 0, 30)))).not.toBe(autumn); // the first 02:30, an hour earlier
    expect(reduce(autumn, at0(secondTwoThirty))).not.toBe(autumn);
    expect(reduce(autumn, at0(secondTwoThirty + 1))).toBe(autumn);
  });

  it("refuses a booking that was paid in any part with a gift card, and gives no credit back", () => {
    const sold = reduce(booked, { type: "giftcard/sell", amount: 100, recipient: "Maja", message: "", date: today });
    const paid = reduce(sold, { type: "giftcard/redeem", code: sold.giftCards[0].code, bookingId: visit.id, date: today });
    expect(paid.giftCards[0].redemptions.length).toBeGreaterThan(0);
    const spendable = balanceOf(paid, paid.giftCards[0]);
    for (const action of [cancel(), move()]) expect(reduce(paid, action)).toBe(paid);
    expect(paid.bookings.find((b) => b.id === visit.id)!.status).toBe("booked");
    expect(balanceOf(paid, paid.giftCards[0])).toBe(spendable);
  });

  it("refuses when the booking is no longer the visit the customer saw", () => {
    for (const expected of [{ ...seen, date: "2026-11-25" }, { ...seen, start: start + 30 }, { ...seen, staffId: "bo" as StaffId }]) {
      expect(reduce(booked, cancel({ expected }))).toBe(booked);
      expect(reduce(booked, move({ expected }))).toBe(booked);
    }
  });

  it("follows the terms the visit was booked under, not today's policy", () => {
    const stricter = { ...booked, cancellationPolicy: { ...booked.cancellationPolicy, version: 9, freeHours: 72 } };
    expect(reduce(stricter, cancel({ at: at(deadlineDay, start) }))).not.toBe(stricter);
  });

  it("refuses a second cancel, a completed visit, another salon's address and an unknown booking", () => {
    const once = reduce(booked, cancel());
    expect(reduce(once, cancel())).toBe(once);
    const done = reduce(booked, { type: "booking/complete", id: visit.id });
    expect(reduce(done, cancel())).toBe(done);
    expect(reduce(booked, cancel({ public: { slug: "annan-salong" } }))).toBe(booked);
    expect(reduce(booked, cancel({ id: "b-unknown" }))).toBe(booked);
  });

  it("refuses a visit the salon took a deposit or a fee for, and changes no payment", () => {
    const paid = { ...booked, bookings: booked.bookings.map((b) => (b.id === visit.id ? { ...b, protection: { ...b.protection!, deposit: { id: "pay-1", method: "card" as const } } } : b)) };
    expect(reduce(paid, cancel())).toBe(paid);
    expect(reduce(paid, move())).toBe(paid);
    const next = reduce(booked, cancel());
    expect(next.bookings.find((b) => b.id === visit.id)!.protection).toEqual(visit.protection);
  });
});

describe("online/move", () => {
  const target = first(booked, "2026-11-25")[0];

  it("moves to a free time, keeping the terms, the reference and the price, and tells the owner and the customer", () => {
    const next = withTenantPresentation(booked, () => reduce(booked, move()));
    const moved = next.bookings.find((b) => b.id === visit.id)!;
    expect(moved).toMatchObject({ date: "2026-11-25", start: target, status: "booked", publicRef: "ref-fictional-1", price: visit.price, protection: visit.protection, duration: visit.duration });
    expect(first(next, date)).toContain(start);
    expect(next.inbox.find((i) => i.kind === "reschedule")).toMatchObject({ bookingId: visit.id, title: "Customer rescheduled online" });
    expect(next.inbox.filter((i) => i.delivery?.kind === "moved")).toHaveLength(1);
  });

  it("tells the customer of every move, also one back to a time the visit had before (A to B to A to B is three messages)", () => {
    const there = move();
    const back = move({ date, start, expected: { date: "2026-11-25", start: target, staffId: "anna" } });
    const thereAgain = move({ expected: seen });
    const state = [there, back, thereAgain].reduce((current, action) => reduce(current, action), booked);
    expect(state.bookings.find((b) => b.id === visit.id)).toMatchObject({ date: "2026-11-25", start: target });
    const sent = state.inbox.filter((i) => i.delivery?.kind === "moved");
    expect(sent).toHaveLength(3);
    expect(new Set(sent.map((i) => i.delivery!.slot)).size).toBe(3);
  });

  it("moves within its own overlapping time, since its own slot is not in the way", () => {
    const next = reduce(booked, move({ date, start: start + 30 }));
    expect(next.bookings.find((b) => b.id === visit.id)?.start).toBe(start + 30);
  });

  it("refuses a time that is taken, the same time, and a time outside the hours", () => {
    const other = reduce(booked, { type: "booking/create", serviceId: service.id, staffId: "anna", date: "2026-11-25", start: target, source: "phone", newCustomer: { name: "Per Exempel", phone: "073-555 03 04", since: today } });
    expect(other.bookings).toHaveLength(booked.bookings.length + 1);
    expect(reduce(other, move())).toBe(other);
    expect(reduce(booked, move({ date, start }))).toBe(booked);
    expect(reduce(booked, move({ start: 3 * 60 }))).toBe(booked);
  });

  it("refuses beyond the 28-day horizon (the last day is 2026-12-14), in the past and inside the lead time", () => {
    expect(reduce(booked, move({ date: "2026-12-15", start: first(booked, "2026-12-15")[0] ?? 600 }))).toBe(booked);
    expect(reduce(booked, move({ date: "2026-11-15", start: 600 }))).toBe(booked);
    expect(reduce(booked, move({ date: today, start: 700 + 30, at: at(today, 700) }))).toBe(booked);
  });

  it("refuses a staff member who does not perform the treatment", () => {
    const stranger = booked.staff.find((s) => !service.staffIds.includes(s.id))!;
    expect(reduce(booked, move({ staffId: stranger.id }))).toBe(booked);
  });

  it("is refused after the deadline, once cancelled and for another address", () => {
    expect(reduce(booked, move({ at: at(deadlineDay, start + 1) }))).toBe(booked);
    const once = reduce(booked, cancel());
    expect(reduce(once, move())).toBe(once);
    expect(reduce(booked, move({ public: { slug: "annan-salong" } }))).toBe(booked);
  });

  it("changes no payment and charges no fee", () => {
    const next = reduce(booked, move());
    expect(next.bookings.find((b) => b.id === visit.id)!.protection).toEqual(visit.protection);
    expect(next.sales).toEqual(booked.sales);
  });
});

describe("a start in the hour the spring clock change skips", () => {
  const night = {
    ...base,
    salon: { ...base.salon, lunch: null, hours: { ...base.salon.hours, 0: { open: 0, close: 1440 } } },
    staff: base.staff.map((s) => ({ ...s, week: { ...s.week, 0: { start: 0, end: 1440 } } })),
  };
  const need = { serviceId: service.id, duration: 30 };

  it("is never free, since 02:30 does not exist on 2027-03-28 in Stockholm, while the times around it are", () => {
    expect(isFree(night, "anna", "2027-03-28", 150, need)).toBe(false);
    expect(isFree(night, "anna", "2027-03-28", 90, need)).toBe(true);
    expect(isFree(night, "anna", "2027-03-28", 210, need)).toBe(true);
  });
});
