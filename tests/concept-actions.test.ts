import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";

const today = "2026-11-16";
const base = createDemoState(today);
const upcoming = base.bookings.find((b) => b.status === "booked" && b.date > today)!;

describe("concept store actions", () => {
  it("moves a booking to a free slot and refuses a taken one", () => {
    let date = addDays(upcoming.date, 1);
    while (!freeStarts(base, upcoming.staffId, date, upcoming).length) date = addDays(date, 1);
    const free = freeStarts(base, upcoming.staffId, date, upcoming);
    const moved = reduce(base, { type: "booking/move", id: upcoming.id, date, start: free[0] });
    expect(moved.bookings.find((b) => b.id === upcoming.id)).toMatchObject({ date, start: free[0] });

    const other = base.bookings.find((b) => b.id !== upcoming.id && b.staffId === upcoming.staffId && b.status === "booked" && b.date === upcoming.date)!;
    expect(reduce(base, { type: "booking/move", id: upcoming.id, date: other.date, start: other.start })).toBe(base);
  });

  it("cancels a booking and can post a waiting-list notice", () => {
    const next = reduce(base, {
      type: "booking/cancel",
      id: upcoming.id,
      reason: "Ill",
      notice: { kind: "system", date: today, time: 600, title: "Offered", body: "", read: false, handled: true },
    });
    expect(next.bookings.find((b) => b.id === upcoming.id)?.status).toBe("cancelled");
    expect(next.inbox[0].title).toBe("Offered");
  });

  it("creates a booking only in a free slot", () => {
    const date = addDays(today, 31);
    const [start] = freeStarts(base, "erik", date, { serviceId: "classic-60", duration: 60 });
    const action = { type: "booking/create", customerId: "k001", serviceId: "classic-60", staffId: "erik", date, start, source: "phone" } as const;
    const next = reduce(base, action);
    expect(next.bookings).toHaveLength(base.bookings.length + 1);
    expect(reduce(next, action)).toBe(next);
  });

  it("replies to a reschedule request by moving the booking", () => {
    const item = base.inbox.find((i) => i.kind === "reschedule" && i.suggestion)!;
    const next = reduce(base, { type: "inbox/reply", id: item.id, reply: "Done", slot: item.suggestion });
    expect(next.bookings.find((b) => b.id === item.bookingId)).toMatchObject({ date: item.suggestion!.date, start: item.suggestion!.start });
    expect(next.inbox.find((i) => i.id === item.id)).toMatchObject({ handled: true, read: true, reply: "Done" });
  });

  it("turns a new customer's request into a customer and a booking", () => {
    const item = base.inbox.find((i) => i.fromName)!;
    const next = reduce(base, { type: "inbox/reply", id: item.id, reply: "Welcome", slot: item.suggestion });
    const customer = next.customers.at(-1)!;
    expect(customer.firstName).toBe("Tove");
    expect(next.bookings.at(-1)?.customerId).toBe(customer.id);
  });

  it("leaves an Inbox request and its new customer untouched if the offered slot was taken", () => {
    const item = base.inbox.find((i) => i.fromName && i.suggestion)!;
    const occupied = reduce(base, { ...item.suggestion!, type: "booking/create", customerId: "k001", source: "phone" });
    expect(occupied.bookings).toHaveLength(base.bookings.length + 1);
    expect(reduce(occupied, { type: "inbox/reply", id: item.id, reply: "Welcome", slot: item.suggestion })).toBe(occupied);
  });

  it("updates prices, modules and inbox flags", () => {
    let next = reduce(base, { type: "service/price", id: "classic-60", price: 850 });
    next = reduce(next, { type: "module/toggle", key: "stock" });
    next = reduce(next, { type: "inbox/read-all" });
    expect(next.services.find((s) => s.id === "classic-60")?.price).toBe(850);
    expect(next.modules.stock).toBe(false);
    expect(next.inbox.every((i) => i.read)).toBe(true);
  });
});

describe("first-time caller booking", () => {
  it("creates the customer with the booking and leaves state untouched when the slot is taken", () => {
    const service = base.services.find((item) => item.id === upcoming.serviceId)!;
    const action = {
      type: "booking/create" as const,
      newCustomer: { name: "QA Newcaller", phone: "070-000 99 31", email: "qa@example.test", since: today },
      serviceId: service.id,
      staffId: upcoming.staffId,
      source: "phone" as const,
      date: upcoming.date,
      start: upcoming.start,
    };
    expect(reduce(base, action)).toBe(base);
    const cancelled = reduce(base, { type: "booking/cancel", id: upcoming.id });
    const booked = reduce(cancelled, action);
    const customer = booked.customers.at(-1);
    expect(customer).toMatchObject({ firstName: "QA", lastName: "Newcaller", email: "qa@example.test" });
    expect(booked.bookings.at(-1)).toMatchObject({ customerId: customer?.id, start: upcoming.start });
  });
});
