import { describe, expect, it } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { visitTime } from "@/concept/booking/policy";
import { acceptedTerms } from "@/concept/booking/public-terms";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";
import { bookingNotices, noticeHref } from "@/concept/studio/notices/booking-notices";
import { payAtSalon } from "./helpers/pay-at-salon";

// "New since last time": the inbox items for what customers did on the booking page, read from the
// booking and customer they point at. Fictional data only; 2026-11-16 is a Monday.

const today = "2026-11-16";
const fresh = createDemoState(today);
const service = fresh.services.find((s) => s.id === "medical-foot-care")!;
const date = "2026-11-24";
const slot = (state: DemoState, day = date) => freeStarts(state, "anna", day, { serviceId: service.id, duration: service.duration }, { step: 30 })[0];
const guest = { name: "Lisa Berg", phone: "073-555 01 02", at: { date: today, time: 600 } };
const notice = { title: "New online booking", body: "Demo visit" };

describe("booking notices", () => {
  it("start empty on a fresh demo: its own inbox examples are not online events", () => {
    expect(bookingNotices(fresh)).toEqual([]);
  });

  it("list a paid online booking with the first name, the service, the time and what was paid, and leave once read", () => {
    const held = reduce(fresh, { type: "online/hold", serviceId: service.id, staffId: "anna", date, start: slot(fresh), guest, notice });
    const paid = reduce(held, { type: "online/pay", id: held.checkoutHolds[0].id, method: "card" });
    const visit = paid.bookings.at(-1)!;
    const [first, ...rest] = bookingNotices(paid);
    expect(rest).toEqual([]);
    expect(first).toMatchObject({ event: "booked", bookingId: visit.id, name: "Lisa", service: service.name, date, start: visit.start, paidMinor: service.price * 100 });
    expect(paid.inbox.find((item) => item.id === first.id)).toMatchObject({ kind: "request", event: "booked", read: false });
    expect(bookingNotices(reduce(paid, { type: "inbox/read", id: first.id }))).toEqual([]);
    expect(noticeHref(visit.id)).toBe(`/studio/calendar?booking=${visit.id}`);
  });

  it("list a booking paid at the salon with nothing paid, then its move and its cancellation, newest first", () => {
    const base = payAtSalon(fresh);
    const booked = reduce(base, { type: "online/book", serviceId: service.id, staffId: "anna", date, start: slot(base), guest, public: { slug: base.salon.slug, terms: acceptedTerms(base, service), publicRef: "ref-fictional-n1" } });
    const visit = booked.bookings.at(-1)!;
    expect(bookingNotices(booked)).toMatchObject([{ event: "booked", paidMinor: 0 }]);
    const instant = (time: number) => visitTime({ date: today, start: time }).toMillis();
    const to = slot(booked, "2026-11-25");
    const moved = reduce(booked, { type: "online/move", id: visit.id, at: { date: today, time: 700 }, instant: instant(700), public: { slug: base.salon.slug }, expected: { date, start: visit.start, staffId: "anna" }, staffId: "anna", date: "2026-11-25", start: to } as DemoAction);
    const cancelled = reduce(moved, { type: "online/cancel", id: visit.id, at: { date: today, time: 720 }, instant: instant(720), public: { slug: base.salon.slug }, expected: { date: "2026-11-25", start: to, staffId: "anna" } } as DemoAction);
    expect(bookingNotices(cancelled).map((n) => [n.event, n.date, n.start])).toEqual([["cancelled", "2026-11-25", to], ["moved", "2026-11-25", to], ["booked", "2026-11-25", to]]);
  });

  it("leave out an item whose visit is gone, and an owner's own notes about a booking", () => {
    const base = payAtSalon(fresh);
    const booked = reduce(base, { type: "online/book", serviceId: service.id, staffId: "anna", date, start: slot(base), guest, notice });
    expect(bookingNotices({ ...booked, bookings: booked.bookings.slice(0, -1) })).toEqual([]);
    const visit = fresh.bookings.find((b) => b.status === "booked")!;
    const owner = reduce(fresh, { type: "inbox/add", item: { kind: "request", bookingId: visit.id, date: today, time: 600, title: "Note", body: "", read: false, handled: true } });
    expect(bookingNotices(owner)).toEqual([]);
  });
});
