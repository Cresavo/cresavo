import { describe, expect, it } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { acceptedTerms } from "@/concept/booking/public-terms";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import type { DemoState, StaffId } from "@/concept/data/types";
import { withTenantPresentation } from "@/concept/i18n/presentation";

// A customer's cancel and move from their booking link, decided by the
// reducer: before the free-cancellation deadline only, never a payment.
// 2026-11-16 is a Monday; the visit is on 2026-11-24 at the day's first free
// time, so the 24 h deadline is 2026-11-23 at that time. Fictional data only.

const today = "2026-11-16";
const base = createDemoState(today);
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
const cancel = (over: Partial<Extract<DemoAction, { type: "online/cancel" }>> = {}): DemoAction => ({ type: "online/cancel", id: visit.id, at: at(today, 700), public: { slug }, ...over });
const move = (over: Partial<Extract<DemoAction, { type: "online/move" }>> = {}): DemoAction => ({
  type: "online/move", id: visit.id, at: at(today, 700), public: { slug }, staffId: "anna", date: "2026-11-25", start: first(booked, "2026-11-25")[0], ...over,
});
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
