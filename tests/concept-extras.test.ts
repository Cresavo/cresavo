import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { dailySummaryTask } from "@/concept/ai/tasks/daily-summary";
import { buildStaffFeed } from "@/concept/calendar/feed";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";
import { figuresFromBookings } from "@/concept/finance/figures";
import { balanceOf, findGiftCard, giftCardCode, giftCardLiability, MAX_AMOUNT, MIN_AMOUNT, paidWithCards } from "@/concept/giftcards/cards";
import { applyAction } from "@/concept/log/capture";
import { packageFor, packageLiability, visitsLeft } from "@/concept/packages/packages";
import { dayBookings } from "@/concept/selectors";
import { DEV_ICS_SECRET, feedSecretSource, feedToken, validFeedToken } from "@/concept/server/feed-token";
import { dayFacts, summaryDue } from "@/concept/summary/day";
import { BRAND } from "@/concept/brand";

const today = "2026-11-17";
const base = createDemoState(today);
const upcoming = base.bookings.find((b) => b.status === "booked" && b.date > today)!;

const sold = (state: DemoState, amount = 500) => reduce(state, { type: "giftcard/sell", amount, recipient: "Maja", message: "Enjoy", date: today });

describe("gift cards", () => {
  it("sells a card with a readable code and a full balance", () => {
    const next = sold(base);
    const card = next.giftCards[0];
    expect(card).toMatchObject({ amount: 500, recipient: "Maja", message: "Enjoy", soldOn: today });
    expect(card.code).toMatch(/^EKO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(balanceOf(next, card)).toBe(500);
    expect(giftCardLiability(next)).toBe(500);
  });

  it("gives every card its own code", () => {
    let state = base;
    for (let i = 0; i < 30; i++) state = sold(state, 300);
    expect(new Set(state.giftCards.map((c) => c.code)).size).toBe(30);
    expect(giftCardCode("EKO", 7)).toBe(giftCardCode("EKO", 7));
  });

  it("refuses amounts outside the limits and cards with no recipient", () => {
    expect(sold(base, MIN_AMOUNT - 1)).toBe(base);
    expect(sold(base, MAX_AMOUNT + 1)).toBe(base);
    expect(reduce(base, { type: "giftcard/sell", amount: 500, recipient: "  ", message: "", date: today })).toBe(base);
  });

  it("is a liability, not revenue, when sold", () => {
    const clock = { today, minutes: 20 * 60 };
    const range = { start: today, end: "2026-11-18" };
    expect(figuresFromBookings(sold(base), range, clock).revenue).toBe(figuresFromBookings(base, range, clock).revenue);
  });

  it("redeems against a booking up to the balance and the price, and the code is forgiving", () => {
    const card = sold(base, 5000).giftCards[0];
    const withCard = sold(base, 5000);
    const lower = card.code.toLowerCase().replace(/-/g, " ");
    const paid = reduce(withCard, { type: "giftcard/redeem", code: lower, bookingId: upcoming.id, date: today });
    expect(paidWithCards(paid, upcoming.id)).toBe(upcoming.price);
    expect(balanceOf(paid, paid.giftCards[0])).toBe(5000 - upcoming.price);
    expect(giftCardLiability(paid)).toBe(5000 - upcoming.price);
    expect(findGiftCard(paid, card.code)).toBeDefined();
    // The booking is paid in full, so a second redemption does nothing.
    expect(reduce(paid, { type: "giftcard/redeem", code: card.code, bookingId: upcoming.id, date: today })).toBe(paid);
  });

  it("uses only what is left on a small card, leaving the rest of the booking unpaid", () => {
    const small = sold(base, MIN_AMOUNT);
    const paid = reduce(small, { type: "giftcard/redeem", code: small.giftCards[0].code, bookingId: upcoming.id, date: today });
    expect(paidWithCards(paid, upcoming.id)).toBe(MIN_AMOUNT);
    expect(balanceOf(paid, paid.giftCards[0])).toBe(0);
  });

  it("refuses unknown codes, unknown bookings and bookings that are not open", () => {
    const state = sold(base);
    const code = state.giftCards[0].code;
    expect(reduce(state, { type: "giftcard/redeem", code: "NOPE", bookingId: upcoming.id, date: today })).toBe(state);
    expect(reduce(state, { type: "giftcard/redeem", code, bookingId: "b-missing", date: today })).toBe(state);
    const done = reduce(state, { type: "booking/complete", id: upcoming.id });
    expect(reduce(done, { type: "giftcard/redeem", code, bookingId: upcoming.id, date: today })).toBe(done);
  });

  it("gives the money back when the booking is cancelled", () => {
    const state = sold(base, 5000);
    const paid = reduce(state, { type: "giftcard/redeem", code: state.giftCards[0].code, bookingId: upcoming.id, date: today });
    const cancelled = reduce(paid, { type: "booking/cancel", id: upcoming.id });
    expect(balanceOf(cancelled, cancelled.giftCards[0])).toBe(5000);
  });

  it("can be undone from the activity log", () => {
    const meta = { actor: "owner", source: "button", at: 1 } as const;
    const next = applyAction(base, { type: "giftcard/sell", amount: 500, recipient: "Maja", message: "", date: today }, meta);
    const entry = next.log[0];
    expect(entry.summary).toContain(next.giftCards[0].code);
    const undone = reduce(next, { type: "log/undo", id: entry.id });
    expect(undone.giftCards).toHaveLength(0);
  });
});

describe("packages", () => {
  const booking = upcoming;
  const service = base.services.find((s) => s.id === booking.serviceId)!;
  const withPackage = reduce(base, { type: "package/sell", customerId: booking.customerId, serviceId: service.id, date: today });

  it("sells five visits for the price of four, owed to the customer", () => {
    const pkg = withPackage.packages[0];
    expect(pkg).toMatchObject({ visits: 5, price: service.price * 4, customerId: booking.customerId });
    expect(visitsLeft(pkg)).toBe(5);
    expect(packageLiability(withPackage)).toBe(service.price * 4);
  });

  it("refuses unknown customers and treatments", () => {
    expect(reduce(base, { type: "package/sell", customerId: "k-missing", serviceId: service.id, date: today })).toBe(base);
    expect(reduce(base, { type: "package/sell", customerId: booking.customerId, serviceId: "nope", date: today })).toBe(base);
  });

  it("deducts a visit when the booking is marked done and counts that visit at its share of the price", () => {
    expect(packageFor(withPackage, booking)).toBeDefined();
    const done = reduce(withPackage, { type: "booking/complete", id: booking.id });
    const pkg = done.packages[0];
    expect(pkg.usedBy).toEqual([booking.id]);
    expect(visitsLeft(pkg)).toBe(4);
    expect(done.bookings.find((b) => b.id === booking.id)).toMatchObject({ status: "completed", price: Math.round(pkg.price / 5) });
    expect(packageLiability(done)).toBe(Math.round((pkg.price * 4) / 5));
  });

  it("preserves the package visit and the booking price when a gift card paid part of the visit", () => {
    const sold = reduce(withPackage, { type: "giftcard/sell", amount: 100, recipient: "Demo gift", message: "", date: today });
    const paid = reduce(sold, { type: "giftcard/redeem", code: sold.giftCards[0].code, bookingId: booking.id, date: today });
    expect(paid.giftCards[0].redemptions).toMatchObject([{ bookingId: booking.id, amount: 100 }]);
    const done = reduce(paid, { type: "booking/complete", id: booking.id });
    expect(done.packages).toEqual(withPackage.packages);
    expect(done.giftCards).toEqual(paid.giftCards);
    expect(done.bookings.find((b) => b.id === booking.id)).toMatchObject({ status: "completed", price: booking.price });
    expect(packageFor(paid, booking)).toBeUndefined();
  });

  it("leaves other treatments and other customers alone", () => {
    const other = base.services.find((s) => s.id !== service.id)!;
    const otherBooking = base.bookings.find((b) => b.status === "booked" && b.serviceId === other.id && b.customerId !== booking.customerId)!;
    const done = reduce(withPackage, { type: "booking/complete", id: otherBooking.id });
    expect(done.packages[0].usedBy).toEqual([]);
    expect(done.bookings.find((b) => b.id === otherBooking.id)!.price).toBe(otherBooking.price);
  });

  it("does nothing when the packages module is off", () => {
    const off = reduce(withPackage, { type: "module/toggle", key: "packages" });
    expect(reduce(off, { type: "booking/complete", id: booking.id }).packages[0].usedBy).toEqual([]);
  });

  it("stops at the last visit", () => {
    const used = { ...withPackage, packages: [{ ...withPackage.packages[0], usedBy: ["a", "b", "c", "d", "e"] }] };
    expect(packageFor(used, booking)).toBeUndefined();
    expect(reduce(used, { type: "booking/complete", id: booking.id }).packages[0].usedBy).toHaveLength(5);
  });

  it("undoing the visit restores the package and the price", () => {
    const meta = { actor: "owner", source: "button", at: 1 } as const;
    const done = applyAction(withPackage, { type: "booking/complete", id: booking.id }, meta);
    const undone = reduce(done, { type: "log/undo", id: done.log[0].id });
    expect(undone.packages[0].usedBy).toEqual([]);
    expect(undone.bookings.find((b) => b.id === booking.id)!.price).toBe(booking.price);
  });
});

describe("evening summary", () => {
  const lastEnd = Math.max(...dayBookings(base, today).map((b) => b.start + b.duration));

  it("is due once the last booking has ended, and not before", () => {
    expect(summaryDue(base, { today, minutes: lastEnd - 1 })).toBe(false);
    expect(summaryDue(base, { today, minutes: lastEnd })).toBe(true);
  });

  it("is not due on a day without bookings", () => {
    expect(summaryDue({ ...base, bookings: [] }, { today, minutes: 23 * 60 })).toBe(false);
  });

  it("counts the day from the bookings, using first names only", () => {
    const facts = dayFacts(base, { today, minutes: lastEnd });
    const todays = dayBookings(base, today);
    const earned = todays.filter((b) => b.status !== "noshow").reduce((sum, b) => sum + b.price, 0);
    expect(facts.visits).toBe(todays.filter((b) => b.status === "booked" || b.status === "completed").length);
    expect(facts.revenueSek).toBeGreaterThanOrEqual(earned);
    const tomorrow = dayBookings(base, "2026-11-18")[0];
    const firstName = base.customers.find((c) => c.id === tomorrow?.customerId)?.firstName ?? null;
    expect(facts.tomorrowFirstCustomer).toBe(firstName);
  });

  it("counts finished visits without a journal entry, and none while the journal is off", () => {
    const facts = dayFacts(base, { today, minutes: lastEnd });
    const off = reduce(base, { type: "module/toggle", key: "journal" });
    expect(dayFacts(off, { today, minutes: lastEnd }).missingJournals).toBe(0);
    expect(facts.missingJournals).toBeGreaterThanOrEqual(0);
  });

  it("has a rule fallback with every figure in it", () => {
    const text = dailySummaryTask.fallback({ revenueSek: 2400, visits: 4, noShows: 1, newCustomers: 2, missingJournals: 3, tomorrowFirstCustomer: "Erik" });
    expect(text.summary).toBe("Today's revenue: 2400 SEK from 4 visits.");
    expect(text.highlights).toEqual(["1 no-show", "2 new customers", "3 missing journals", "Tomorrow starts with Erik."]);
    const quiet = dailySummaryTask.fallback({ revenueSek: 0, visits: 1, noShows: 0, newCustomers: 0, missingJournals: 0, tomorrowFirstCustomer: null });
    expect(quiet.summary).toBe("Today's revenue: 0 SEK from 1 visit.");
    expect(quiet.highlights.at(-1)).toBe("No bookings tomorrow.");
  });
});

describe("calendar feed", () => {
  const now = new Date("2026-11-17T12:00:00Z");
  const feed = buildStaffFeed(base, "anna", today, now)!;
  const unfolded = feed.replace(/\r\n /g, "");
  const lines = unfolded.split("\r\n");

  it("is a valid calendar with CRLF lines, folded to 75 octets", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-2)).toBe("END:VCALENDAR");
    expect(lines.at(-1)).toBe("");
    expect(feed).not.toMatch(/[^\r]\n/);
    for (const line of feed.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(unfolded).toContain("VERSION:2.0");
    expect(unfolded).toContain(`PRODID:-//${BRAND.name}//Staff calendar//EN`);
  });

  it("has one event per booking of that person, in UTC, and none for cancelled ones", () => {
    const expected = base.bookings.filter((b) => b.staffId === "anna" && (b.status === "booked" || b.status === "completed") && b.date >= "2026-11-03" && b.date <= "2027-03-17");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(expected.length);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(expected.length);
    const first = [...expected].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0];
    // Stockholm is UTC+1 in November.
    const utc = (minutes: number) => `${first.date.replace(/-/g, "")}T${String(Math.floor(minutes / 60) - 1).padStart(2, "0")}${String(minutes % 60).padStart(2, "0")}00Z`;
    expect(lines).toContain(`DTSTART:${utc(first.start)}`);
    expect(lines).toContain(`DTEND:${utc(first.start + first.duration)}`);
    expect(lines).toContain(`UID:${first.id}@salong-eko.example`);
    expect(lines).toContain("DTSTAMP:20261117T120000Z");
    const cancelled = base.bookings.filter((b) => b.staffId === "anna" && b.status === "cancelled");
    for (const b of cancelled) expect(unfolded).not.toContain(`UID:${b.id}@`);
  });

  it("shows first names and treatments only, never contact details", () => {
    expect(feed).toContain("SUMMARY:");
    for (const customer of base.customers) {
      if (customer.phone) expect(unfolded).not.toContain(customer.phone);
      if (customer.email) expect(unfolded).not.toContain(customer.email);
      if (customer.lastName.length > 3) expect(unfolded).not.toContain(customer.lastName);
      if (customer.note) expect(unfolded).not.toContain(customer.note);
    }
    expect(unfolded).not.toMatch(/@(?!salong-eko\.example)/);
  });

  it("is null for someone who does not work there", () => {
    expect(buildStaffFeed(base, "nobody", today, now)).toBeNull();
  });

  it("keeps the salon's wall-clock time on both clock-change days", () => {
    const template = base.bookings.find((b) => b.staffId === "anna" && b.status === "booked")!;
    const on = (date: string) => {
      const state = { ...base, bookings: [{ ...template, id: `dst-${date}`, date, start: 10 * 60, duration: 60 }] };
      return buildStaffFeed(state, "anna", date, now)!.replace(/\r\n /g, "").split("\r\n");
    };
    // 28 March 2027: Stockholm moves to UTC+2 at 02:00, so 10:00 is 08:00 UTC.
    expect(on("2027-03-28")).toEqual(expect.arrayContaining(["DTSTART:20270328T080000Z", "DTEND:20270328T090000Z"]));
    // 31 October 2027: back to UTC+1 at 03:00, so 10:00 is 09:00 UTC.
    expect(on("2027-10-31")).toEqual(expect.arrayContaining(["DTSTART:20271031T090000Z", "DTEND:20271031T100000Z"]));
  });
});

describe("calendar feed token", () => {
  const dev = { NODE_ENV: "development" };
  const production = { NODE_ENV: "production" };

  it("uses the development secret outside production when none is set", () => {
    expect(feedSecretSource(dev)).toBe("dev-default");
    expect(feedToken("anna", dev)).toBeTruthy();
    expect(DEV_ICS_SECRET.length).toBeGreaterThanOrEqual(16);
  });

  it("closes the feed in production until a secret of at least 16 characters is set", () => {
    expect(feedSecretSource(production)).toBe("missing");
    expect(feedToken("anna", production)).toBeNull();
    expect(validFeedToken("anna", feedToken("anna", dev), production)).toBe(false);
    expect(feedSecretSource({ ...production, CONCEPT_ICS_SECRET: "short" })).toBe("missing");
    expect(feedSecretSource({ ...production, CONCEPT_ICS_SECRET: "a-long-enough-secret" })).toBe("env");
  });

  it("gives each person their own token, different per secret", () => {
    const env = { ...production, CONCEPT_ICS_SECRET: "a-long-enough-secret" };
    const anna = feedToken("anna", env)!;
    expect(anna).not.toBe(feedToken("erik", env));
    expect(anna).not.toBe(feedToken("anna", { ...production, CONCEPT_ICS_SECRET: "another-long-secret!" }));
    expect(validFeedToken("anna", anna, env)).toBe(true);
    expect(validFeedToken("erik", anna, env)).toBe(false);
    expect(validFeedToken("anna", "", env)).toBe(false);
    expect(validFeedToken("anna", null, env)).toBe(false);
    expect(validFeedToken("anna", `${anna}x`, env)).toBe(false);
  });
});
