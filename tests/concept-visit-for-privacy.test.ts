import { afterEach, describe, expect, it, vi } from "vitest";
import { reduce, type DemoAction, type OnlineGuest } from "@/concept/actions";
import { replyRequest } from "@/concept/assistant/engine";
import type { CheckoutHold } from "@/concept/booking/protection";
import { eraseCustomer } from "@/concept/customers/erase";
import { customerExport } from "@/concept/customers/export";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";
import { packageFor, visitsLeft } from "@/concept/packages/packages";

// A visit booked for someone else names a second person. Where the studio
// treats the booker as the one in the chair (punch cards), and where it keeps
// or sends personal data (erasure, export, the assistant, the sent messages),
// that person is handled apart. 2026-11-16 is a Monday. Fictional data only.

const today = "2026-11-16";
const date = "2026-11-24";
const state = createDemoState(today);
const guest = { name: "Lisa Berg", phone: "073-555 01 02", at: { date: today, time: 600 } };
const notice = { title: "New online booking", body: "Fictional" };
const need = { serviceId: "medical-foot-care", duration: 60 };
const start = (from: DemoState, nth = 0) => freeStarts(from, "anna", date, need, { step: 30 })[nth];
const book = (from: DemoState, over: Partial<OnlineGuest> = {}): DemoState =>
  reduce(from, { type: "online/book", guest: { ...guest, ...over }, notice, serviceId: "medical-foot-care", staffId: "anna", date, start: start(from) });

/** Lisa books a visit for Elsa Berg; `booking` is that visit and `lisa` her card's id. */
function forElsa(from: DemoState = state) {
  const next = book(from, { visitFor: "Elsa Berg" });
  const booking = next.bookings.at(-1)!;
  return { next, booking, lisa: booking.customerId };
}

/** A checkout in progress, as `online/hold` stores one. */
const hold = (id: string, over: Partial<OnlineGuest>): CheckoutHold => ({
  id, expiresAt: Date.parse("2026-11-16T12:00:00Z"), serviceId: "medical-foot-care", staffId: "anna", date, start: 600, duration: 60,
  terms: { version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 0, depositMinor: 10000 },
  guest: { ...guest, ...over }, notice,
} as CheckoutHold);

describe("a punch card and a visit for someone else", () => {
  it("is not used when the visitor's treatment is marked done", () => {
    const { next, booking, lisa } = forElsa();
    const sold = reduce(next, { type: "package/sell", customerId: lisa, serviceId: booking.serviceId, date: today });
    const card = sold.packages.at(-1)!;
    expect(packageFor(sold, booking)).toBeUndefined();
    const done = reduce(sold, { type: "booking/complete", id: booking.id });
    expect(done.bookings.find((b) => b.id === booking.id)!.status).toBe("completed");
    expect(visitsLeft(done.packages.find((p) => p.id === card.id)!)).toBe(visitsLeft(card));
    expect(done.bookings.find((b) => b.id === booking.id)!.price).toBe(booking.price);
  });

  it("is still used for the booker's own visit", () => {
    const own = book(state);
    const booking = own.bookings.at(-1)!;
    const sold = reduce(own, { type: "package/sell", customerId: booking.customerId, serviceId: booking.serviceId, date: today });
    expect(packageFor(sold, booking)?.id).toBe(sold.packages.at(-1)!.id);
  });
});

describe("erasing a customer who is the visitor on someone else's booking", () => {
  /** Elsa Berg has a card of her own; Lisa has booked for her, live, in a checkout and on a visit now in the trash. */
  function salon() {
    const { next, booking, lisa } = forElsa();
    const elsa = { ...next.customers[0], id: "c-elsa", firstName: "Elsa", lastName: "Berg", phone: "073-555 09 09", email: "elsa.berg@example.test", note: undefined };
    const second = book({ ...next, customers: [...next.customers, elsa] }, { visitFor: "Elsa Berg" });
    const withHold: DemoState = { ...second, checkoutHolds: [hold("hold-elsa", { visitFor: "Elsa Berg" })] };
    return { withHold, booking, lisa };
  }

  it("removes their name from the live booking and the checkout, and keeps the other person's appointment", () => {
    const { withHold, booking, lisa } = salon();
    const erased = eraseCustomer(withHold, "c-elsa");
    expect(JSON.stringify(erased)).not.toContain("Elsa Berg");
    const kept = erased.bookings.find((b) => b.id === booking.id)!;
    expect(kept).toMatchObject({ customerId: lisa, date: booking.date, start: booking.start, status: "booked" });
    expect(kept.visitFor).toBeTruthy();
    expect(erased.checkoutHolds.map((h) => h.id)).toEqual(["hold-elsa"]);
    expect(erased.customers.some((c) => c.id === lisa)).toBe(true);
  });

  it("removes their name from a booking that waits in the booker's trash bundle", () => {
    const { withHold, lisa } = salon();
    const trashed = reduce(withHold, { type: "customer/delete", id: lisa });
    expect(JSON.stringify(trashed.trash)).toContain("Elsa Berg");
    const erased = eraseCustomer(trashed, "c-elsa");
    expect(JSON.stringify(erased)).not.toContain("Elsa Berg");
    expect(erased.trash.some((entry) => entry.kind === "customer" && entry.customer.id === lisa && entry.bookings.length > 0)).toBe(true);
  });
});

describe("the booker's data export", () => {
  it("holds a visit for someone else, its messages and its checkout for the owner's review", () => {
    const { next, booking, lisa } = forElsa();
    const own = book(next);
    const ownVisit = own.bookings.at(-1)!;
    const withHolds: DemoState = { ...own, checkoutHolds: [hold("hold-own", {}), hold("hold-elsa", { visitFor: "Elsa Berg" })] };
    const data = customerExport(withHolds, lisa, "2026-11-16T10:00:00.000Z")!;
    const { reviewBeforeSending: review, ...main } = data;
    expect(JSON.stringify(main)).not.toContain("Elsa Berg");
    expect(main.bookings.map((b) => b.id)).toEqual([ownVisit.id]);
    expect(main.checkoutHolds.map((h) => h.id)).toEqual(["hold-own"]);
    expect(review.bookings.map((b) => b.id)).toEqual([booking.id]);
    expect(review.checkoutHolds.map((h) => h.id)).toEqual(["hold-elsa"]);
    const linked = withHolds.inbox.filter((item) => item.bookingId === booking.id);
    expect(linked.length).toBeGreaterThan(0);
    expect(review.messages.map((m) => m.id).sort()).toEqual(linked.map((m) => m.id).sort());
    expect(main.messages.some((m) => m.bookingId === booking.id)).toBe(false);
  });
});

describe("the assistant's provider-bound text", () => {
  it("leaves out a visitor who has no customer card, in a follow-up turn too", () => {
    const { next } = forElsa();
    expect(next.customers.some((c) => c.firstName === "Elsa" && c.lastName === "Berg")).toBe(false);
    const thread = [
      { id: "m1", from: "owner" as const, text: "Is Elsa Berg coming on Tuesday?", at: 0 },
      { id: "m2", from: "assistant" as const, text: "Yes, Elsa Berg is booked with Anna.", at: 1 },
      { id: "m3", from: "owner" as const, text: "Give me a daily brief, and mention Elsa's visit.", at: 2 },
    ];
    const request = replyRequest(next, thread, "Daily brief with Elsa Berg's visit", { source: "rules", text: "Elsa Berg comes on Tuesday." });
    expect(request.thread).toHaveLength(3);
    expect(JSON.stringify(request)).not.toMatch(/Elsa|Berg/);
  });

  it("leaves out a visitor named in a checkout in progress", () => {
    const withHold: DemoState = { ...state, checkoutHolds: [hold("hold-nova", { visitFor: "Nova Lindqvist" })] };
    const request = replyRequest(withHold, [{ id: "m1", from: "owner", text: "Has Nova Lindqvist paid?", at: 0 }], "Has Nova Lindqvist paid?", { source: "rules", text: "Not yet." });
    expect(JSON.stringify(request)).not.toMatch(/Nova|Lindqvist/);
  });
});

describe("the browser's sent messages after an erasure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetModules();
  });

  /** One tab on the demo salon, with the store and its sent messages. */
  async function tab(initial: DemoState) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 16, 10, 0));
    vi.resetModules();
    const items = new Map([["salong-eko-demo", JSON.stringify(initial)]]);
    const localStorage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { items.set(key, value); },
      removeItem: (key: string) => { items.delete(key); },
    };
    vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
    const { dispatch } = await import("@/concept/store");
    const { demoSentMessages } = await import("@/concept/connections/demo");
    const saved = () => JSON.parse(items.get("salong-eko-demo")!) as DemoState;
    const sent = () => demoSentMessages("demo").list().filter((entry) => entry.port !== "payments");
    return { dispatch, saved, sent };
  }
  const online = (from: DemoState, over: Partial<OnlineGuest>): DemoAction =>
    ({ type: "online/book", guest: { ...guest, ...over }, notice, serviceId: "medical-foot-care", staffId: "anna", date, start: start(from) });

  it("holds no visitor name once the booker is erased", async () => {
    const { dispatch, saved, sent } = await tab(state);
    expect(dispatch(online(state, { visitFor: "Elsa Berg" }))).toBe(true);
    const lisa = saved().bookings.at(-1)!.customerId;
    expect(sent().length).toBeGreaterThan(0);
    expect(JSON.stringify(sent())).toContain("Elsa Berg");
    const count = sent().length;
    expect(dispatch({ type: "customer/erase", id: lisa })).toBe(true);
    expect(JSON.stringify(saved())).not.toContain("Elsa Berg");
    expect(JSON.stringify(sent())).not.toContain("Elsa Berg");
    expect(sent()).toHaveLength(count);
    expect(sent().every((entry) => entry.to !== `customer:${lisa}` || entry.body === "[redacted]")).toBe(true);
  });

  it("holds no name of an erased visitor in a message sent to the booker", async () => {
    const elsa = { ...state.customers[0], id: "c-elsa", firstName: "Elsa", lastName: "Berg", phone: "073-555 09 09", email: "elsa.berg@example.test", note: undefined };
    const initial: DemoState = { ...state, customers: [...state.customers, elsa] };
    const { dispatch, saved, sent } = await tab(initial);
    expect(dispatch(online(initial, { visitFor: "Elsa Berg" }))).toBe(true);
    const booking = saved().bookings.at(-1)!;
    expect(JSON.stringify(sent())).toContain("Elsa Berg");
    expect(dispatch({ type: "customer/erase", id: "c-elsa" })).toBe(true);
    expect(JSON.stringify(sent())).not.toContain("Elsa Berg");
    expect(JSON.stringify(saved())).not.toContain("Elsa Berg");
    // The booker's messages are still theirs: only the erased person's name is gone.
    const toBooker = sent().filter((entry) => entry.to === `customer:${booking.customerId}`);
    expect(toBooker.length).toBeGreaterThan(0);
    expect(toBooker.every((entry) => entry.body !== "[redacted]" && entry.body.includes("Salong Eko"))).toBe(true);
    expect(saved().bookings.find((b) => b.id === booking.id)).toMatchObject({ status: "booked", date: booking.date, start: booking.start });
  });
});
