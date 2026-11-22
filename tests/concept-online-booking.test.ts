import { describe, expect, it } from "vitest";
import { MAX_UPCOMING_ONLINE_PER_PHONE, reduce, type DemoAction } from "@/concept/actions";
import { PUBLIC_WINDOW_DAYS } from "@/concept/booking/public-projection";
import { eraseCustomer } from "@/concept/customers/erase";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";

// The rules the public booking page relies on, in the reducer: the contact
// e-mail, the per-phone cap, an existing customer's record and the horizon.
// 2026-11-16 is a Monday. Fictional data only.

const today = "2026-11-16";
const state = createDemoState(today);
const guest = { name: "Lisa Berg", phone: "073-555 01 02", email: "lisa.berg@example.test", at: { date: today, time: 600 } };
const notice = { title: "New online booking", body: "Fictional" };
const need = { serviceId: "medical-foot-care", duration: 60 };
const book = (date: string, start: number, over: Partial<typeof guest> = {}): DemoAction =>
  ({ type: "online/book", guest: { ...guest, ...over }, notice, serviceId: "medical-foot-care", staffId: "anna", date, start });
const startOn = (date: string, nth = 0) => freeStarts(state, "anna", date, need, { step: 30 })[nth];

describe("online/book contact e-mail", () => {
  it("is kept on the booking, and a new customer gets it too", () => {
    const next = reduce(state, book("2026-11-24", startOn("2026-11-24")));
    const booking = next.bookings.at(-1)!;
    expect(booking.contactEmail).toBe("lisa.berg@example.test");
    expect(next.customers.find((c) => c.id === booking.customerId)?.email).toBe("lisa.berg@example.test");
  });

  it("is absent when no address was given", () => {
    const next = reduce(state, book("2026-11-24", startOn("2026-11-24"), { email: undefined }));
    expect(next.bookings.at(-1)).not.toHaveProperty("contactEmail");
  });

  it("is erased with the customer, and scrubbed from another visit that holds the same address", () => {
    const booked = reduce(state, book("2026-11-24", startOn("2026-11-24")));
    const customerId = booked.bookings.at(-1)!.customerId;
    const other = { ...booked.bookings[0], contactEmail: "lisa.berg@example.test" };
    const erased = eraseCustomer({ ...booked, bookings: [other, ...booked.bookings.slice(1)] }, customerId);
    expect(JSON.stringify(erased)).not.toContain("lisa.berg@example.test");
  });
});

describe("online/book for a customer who already exists", () => {
  it("never changes their name or e-mail, whatever the booking page was given", () => {
    const known = { ...state.customers[0], email: "known@example.test" };
    const withKnown = { ...state, customers: [known, ...state.customers.slice(1)] };
    const next = reduce(withKnown, book("2026-11-24", startOn("2026-11-24"), { name: "Someone Else", phone: known.phone, email: "attacker@example.test" }));
    expect(next.customers).toEqual(withKnown.customers);
    expect(next.bookings.at(-1)).toMatchObject({ customerId: known.id, contactEmail: "attacker@example.test" });
  });
});

describe("online/book per-phone cap", () => {
  const dates = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"];

  it("allows three upcoming online bookings for one number, in any format, and refuses the fourth", () => {
    let next = state;
    dates.slice(0, MAX_UPCOMING_ONLINE_PER_PHONE).forEach((date, i) => {
      next = reduce(next, book(date, startOn(date), { phone: ["073-555 01 02", "+46 73 555 01 02", "0735550102"][i] }));
    });
    expect(next.bookings.filter((b) => b.source === "online" && b.contactEmail).length).toBe(3);
    expect(reduce(next, book(dates[3], startOn(dates[3]), { phone: "0735550102" }))).toBe(next);
    expect(reduce(next, book(dates[3], startOn(dates[3]), { phone: "073-412 34 56" })).bookings).toHaveLength(next.bookings.length + 1);
  });

  it("does not count cancelled or past visits", () => {
    let next = state;
    for (const date of dates.slice(0, 3)) next = reduce(next, book(date, startOn(date)));
    const [first] = next.bookings.filter((b) => b.contactEmail);
    next = reduce(next, { type: "booking/cancel", id: first.id });
    expect(reduce(next, book(dates[3], startOn(dates[3]))).bookings).toHaveLength(next.bookings.length + 1);
  });
});

describe("online/book horizon", () => {
  it("offers the public window and no further, judged from the guest's own today", () => {
    const last = addDays(today, PUBLIC_WINDOW_DAYS);
    const wide = { ...state, exceptions: [], salon: { ...state.salon, closures: [] } };
    const open = (date: string) => freeStarts(wide, "anna", date, need, { step: 30 })[0];
    // Pick the nearest open day at or before the last day, and one just past it.
    const lastOpen = [0, 1, 2, 3, 4, 5, 6].map((back) => addDays(last, -back)).find((date) => open(date) !== undefined)!;
    expect(reduce(wide, book(lastOpen, open(lastOpen))).bookings.length).toBe(wide.bookings.length + 1);
    const beyond = [1, 2, 3, 4, 5, 6, 7].map((ahead) => addDays(last, ahead)).find((date) => open(date) !== undefined)!;
    expect(reduce(wide, book(beyond, open(beyond)))).toBe(wide);
  });
});
