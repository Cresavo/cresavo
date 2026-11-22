import { describe, expect, it } from "vitest";
import { MAX_UPCOMING_ONLINE_PER_PHONE, reduce, type DemoAction, type OnlineGuest } from "@/concept/actions";
import { bookingMessage } from "@/concept/booking/messages";
import { acceptedTerms } from "@/concept/booking/public-terms";
import { VISIT_FOR_MAX } from "@/concept/booking/visit-for";
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
const book = (date: string, start: number, over: Partial<OnlineGuest> = {}): DemoAction =>
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

describe("online/book for someone else", () => {
  const date = "2026-11-24";
  const forElsa = () => reduce(state, book(date, startOn(date), { visitFor: "  Elsa   Berg " }));

  it("keeps the guest's name on the booking and the booker as the customer to contact", () => {
    const next = forElsa();
    const booking = next.bookings.at(-1)!;
    const customer = next.customers.find((c) => c.id === booking.customerId)!;
    expect(booking.visitFor).toBe("Elsa Berg");
    expect(`${customer.firstName} ${customer.lastName}`).toBe("Lisa Berg");
    expect(customer.phone).toBe(guest.phone);
    expect(next.customers.some((c) => c.firstName === "Elsa")).toBe(false);
  });

  it("sends the confirmation to the booker and names the guest in it", () => {
    const next = forElsa();
    const booking = next.bookings.at(-1)!;
    const sent = next.inbox.filter((item) => item.bookingId === booking.id && item.delivery?.kind === "confirmation");
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.every((item) => item.customerId === booking.customerId)).toBe(true);
    expect(bookingMessage(next, booking, "confirmation").body).toContain("Elsa Berg");
    expect(bookingMessage(next, booking, "reminder").body).toContain("Elsa Berg");
  });

  it("stores no guest for a booking for oneself, also when the booker repeats their own name", () => {
    expect(reduce(state, book(date, startOn(date))).bookings.at(-1)).not.toHaveProperty("visitFor");
    expect(reduce(state, book(date, startOn(date), { visitFor: "lisa berg" })).bookings.at(-1)).not.toHaveProperty("visitFor");
  });

  it("refuses a name that is too short or too long", () => {
    expect(reduce(state, book(date, startOn(date), { visitFor: " E " }))).toBe(state);
    expect(reduce(state, book(date, startOn(date), { visitFor: "E".repeat(VISIT_FOR_MAX + 1) }))).toBe(state);
  });

  it("is refused from a salon's public page, whose erasure does not cover the name yet", () => {
    const service = state.services.find((s) => s.id === "medical-foot-care")!;
    const fromPage = { slug: state.salon.slug, terms: acceptedTerms(state, service), publicRef: "ref-fictional" };
    const own = { ...book(date, startOn(date)), public: fromPage } as DemoAction;
    const other = { ...book(date, startOn(date), { visitFor: "Elsa Berg" }), public: fromPage } as DemoAction;
    expect(reduce(state, own)).not.toBe(state);
    expect(reduce(state, other)).toBe(state);
  });

  it("is erased with the customer who booked", () => {
    const next = forElsa();
    expect(JSON.stringify(eraseCustomer(next, next.bookings.at(-1)!.customerId))).not.toContain("Elsa Berg");
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
