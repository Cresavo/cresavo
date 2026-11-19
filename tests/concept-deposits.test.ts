import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { DEFAULT_POLICY, feeMinor, paymentBalance, quote, settleFee } from "@/concept/booking/protection";
import { changeRule, deadline, visitTime } from "@/concept/booking/policy";
import { demoOutbox } from "@/concept/connections/demo";
import { createDemoState } from "@/concept/data/generate";
import { isFree, needOf, pickResource } from "@/concept/data/slots";
import { applyAction, defaultMeta } from "@/concept/log/capture";

const today = "2026-11-17";
const now = Date.parse(today + "T08:00:00Z");
const state = createDemoState(today);
const service = state.services[0];
const policy = { ...DEFAULT_POLICY, freeHours: 48, noShowPercent: 50, latePercent: 10, deposits: { [service.id]: 20000 } };
const initial = { ...state, bookings: [], cancellationPolicy: policy };
const request = {
  type: "online/hold", serviceId: service.id, staffId: service.staffIds[0], date: "2026-11-19", start: 600,
  guest: { name: "Fictional Guest", phone: "0700009911", at: { date: today, time: 540 } },
  notice: { title: "Demo request", body: "Demo appointment" },
} as const;
function held() {
  return reduce(initial, request);
}
function paid() {
  const pending = held();
  return reduce(pending, { type: "online/pay", id: pending.checkoutHolds[0].id, method: "card" });
}

describe("quoted cancellation terms", () => {
  it.each([
    ["2026-03-29", "2026-03-28T09:00:00.000+01:00"],
    ["2026-10-25", "2026-10-24T11:00:00.000+02:00"],
  ])("allows exactly 24 elapsed hours across the clock change on %s", (date, expected) => {
    const booking = { date, start: 600, status: "booked" as const };
    const until = deadline(booking, 24);
    expect(until.toISO()).toBe(expected);
    expect(changeRule(booking, until.toISODate()!, until.hour * 60)).toBe("free");
    expect(changeRule(booking, until.toISODate()!, until.hour * 60 + 1)).toBe("late");
  });

  it("distinguishes both occurrences of 02:30 on the autumn clock change", () => {
    const booking = { date: "2026-10-26", start: 150, status: "booked" as const };
    expect(changeRule(booking, "2026-10-25", 150, Date.parse("2026-10-25T02:30:00+02:00"))).toBe("free");
    expect(changeRule(booking, "2026-10-25", 150, Date.parse("2026-10-25T02:31:00+01:00"))).toBe("late");
  });

  it("rounds once in minor units, caps deposits and applies exemptions", () => {
    const offer = { id: service.id, price: 1.01 };
    const terms = quote(policy, offer, "EUR", true);
    expect(terms).toMatchObject({ priceMinor: 101, depositMinor: 101 });
    expect(feeMinor(terms, "noshow")).toBe(51);
    expect(quote(policy, { ...offer, price: 750 }, "JPY", true).priceMinor).toBe(750);
    expect(quote(policy, offer, "KWD", true).priceMinor).toBe(1010);
    expect(quote({ ...policy, newCustomersOnly: true }, offer, "EUR", false).depositMinor).toBe(0);
    expect(quote({ ...policy, exemptServices: [service.id] }, offer, "EUR", true)).toMatchObject({ depositMinor: 0, noShowPercent: 0, latePercent: 0 });
    expect(settleFee(10000, 6500)).toEqual({ additional: 0, refund: 3500 });
    expect(settleFee(10000, 12501)).toEqual({ additional: 2501, refund: 0 });
  });
});

describe("booking protection actions", () => {
  let run = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now + run++ * 1000);
    demoOutbox.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("logs and undoes a policy change while preserving a booking's agreed terms", () => {
    const booked = paid();
    const change: DemoAction = { type: "salon/policy", policy: { ...policy, freeHours: 6 } };
    expect(applyAction(booked, change, { actor: "staff", source: "button", at: now })).toBe(booked);
    const edited = applyAction(booked, change, defaultMeta(change, now));
    expect(edited.cancellationPolicy.version).toBeGreaterThan(policy.version);
    expect(edited.bookings[0].protection?.terms.freeHours).toBe(48);
    expect(edited.log[0]).toMatchObject({ actor: "owner", at: now, type: "salon/policy" });
    expect(reduce(edited, change)).toBe(edited);
    expect(reduce(edited, { type: "log/undo", id: edited.log[0].id }).cancellationPolicy).toEqual(policy);
    expect(reduce(initial, { ...change, policy: { ...policy, latePercent: 101 } })).toBe(initial);
  });

  it("reserves the staff and room, confirms just once and honours the held price", () => {
    const pending = held();
    const hold = pending.checkoutHolds[0];
    expect(pending.bookings).toHaveLength(0);
    expect(pending.customers).toBe(initial.customers);
    expect(pending.inbox).toBe(initial.inbox);
    expect(isFree(pending, request.staffId, request.date, request.start, needOf(service))).toBe(false);
    expect(hold.resourceId).toBeDefined();
    expect(pickResource(pending, needOf(service), hold.date, hold.start)).not.toBe(hold.resourceId);
    expect(reduce(pending, request)).toBe(pending);
    expect(reduce(initial, { ...request, type: "online/book" })).toBe(initial);
    const edited = reduce(pending, { type: "service/price", id: service.id, price: 1 });
    const action = { type: "online/pay", id: hold.id, method: "swish" } as const;
    const booked = reduce(edited, action);
    expect(booked.checkoutHolds).toHaveLength(0);
    const b = booked.bookings[0];
    expect(b.price).toBe(service.price);
    expect(b.status).toBe("booked");
    expect(b.protection?.deposit?.method).toBe("swish");
    expect(paymentBalance(b.protection!, false)).toMatchObject({ deposit: 20000, paid: 20000, remaining: service.price * 100 - 20000 });
    expect(reduce(booked, action)).toBe(booked);
    expect(demoOutbox.list("payments")).toHaveLength(1);
    expect(booked.inbox.filter(i => i.bookingId === b.id && i.delivery)).toHaveLength(2);
  });

  it("enforces deposit eligibility and offers card checkout in the business currency", () => {
    const euro = { ...initial, localization: { ...initial.localization, currency: "EUR" }, cancellationPolicy: { ...policy, newCustomersOnly: true } };
    const existing = { ...request, guest: { ...request.guest, phone: euro.customers[0].phone } };
    expect(reduce(euro, existing)).toBe(euro);
    expect(reduce(euro, { ...existing, type: "online/book" }).bookings[0].protection?.terms.depositMinor).toBe(0);
    const pending = reduce(euro, request);
    const id = pending.checkoutHolds[0].id;
    expect(reduce(pending, { type: "online/pay", id, method: "swish" })).toBe(pending);
    const booked = reduce(pending, { type: "online/pay", id, method: "card" });
    expect(booked.bookings[0].protection?.terms.currency).toBe("EUR");
    expect(demoOutbox.list("payments")[0].cost).toEqual({ currency: "EUR", amountMinor: 20000 });
  });

  it("releases abandoned holds and rejects a stale or expired checkout", () => {
    const pending = held();
    const hold = pending.checkoutHolds[0];
    const action = { type: "online/pay", id: hold.id, method: "card" } as const;
    const closed = reduce(pending, { type: "salon/close", date: request.date, name: "Demo closure" });
    expect(reduce(closed, action)).toBe(closed);
    const released = reduce(pending, { type: "online/release", id: hold.id });
    expect(reduce(released, action)).toBe(released);
    vi.setSystemTime(hold.expiresAt);
    expect(isFree(pending, request.staffId, request.date, request.start, needOf(service))).toBe(true);
    expect(reduce(pending, action)).toBe(pending);
    expect(demoOutbox.list("payments")).toHaveLength(0);
  });

  it("records a no-show decision at the visit and collects only the shortfall", () => {
    const booked = paid();
    const b = booked.bookings[0];
    const action = { type: "booking/fee", incident: "noshow", outcome: "charge", id: b.id } as const;
    expect(reduce(booked, action)).toBe(booked);
    const at = visitTime(b).toMillis();
    const result = applyAction(booked, action, defaultMeta(action, at));
    const protection = result.bookings[0].protection!;
    expect(result.bookings[0].status).toBe("noshow");
    expect(protection.decision).toMatchObject({ actor: "owner", at, proposedMinor: service.price * 50, outcome: "charge" });
    expect(paymentBalance(protection, true)).toMatchObject({ paid: service.price * 50, remaining: 0 });
    expect(result.log[0].patch).toBeUndefined();
    expect(reduce(result, action, at)).toBe(result);
  });

  it("requires a waiver reason and refunds the deposit when the owner waives the late fee", () => {
    const booked = paid();
    const b = booked.bookings[0];
    const cutoff = deadline(b, policy.freeHours).toMillis();
    const action = { type: "booking/fee", id: b.id, incident: "late", outcome: "waive", reason: "Courtesy" } as const;
    expect(reduce(booked, action, cutoff)).toBe(booked);
    expect(reduce(booked, { ...action, reason: " " }, cutoff + 1)).toBe(booked);
    const result = reduce(booked, action, cutoff + 1);
    expect(result.bookings[0]).toMatchObject({ status: "cancelled", protection: { decision: { reason: "Courtesy" }, refund: { amountMinor: 20000 } } });
    expect(paymentBalance(result.bookings[0].protection!, true).paid).toBe(0);
  });

  it("refunds the portion of the deposit above a late fee", () => {
    vi.setSystemTime(now + 60_000);
    const booked = paid();
    const b = booked.bookings[0];
    const result = reduce(booked, { type: "booking/fee", id: b.id, incident: "late", outcome: "charge" }, deadline(b, 48).toMillis() + 1);
    expect(result.bookings[0].protection?.refund?.amountMinor).toBe(20000 - service.price * 10);
    expect(paymentBalance(result.bookings[0].protection!, true).paid).toBe(service.price * 10);
  });

  it("refunds the full deposit once when the salon cancels", () => {
    const booked = paid();
    const b = booked.bookings[0];
    const action = { type: "booking/cancel", id: b.id, reason: "Salon closed" } as const;
    const cancelled = applyAction(booked, action, defaultMeta(action, now));
    expect(cancelled.bookings[0].protection?.refund?.amountMinor).toBe(20000);
    expect(cancelled.log[0].patch).toBeUndefined();
    expect(reduce(cancelled, action)).toBe(cancelled);
    expect(demoOutbox.list("payments").filter(p => p.action === "refund")).toHaveLength(1);
  });
});
