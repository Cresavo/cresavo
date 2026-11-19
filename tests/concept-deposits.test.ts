import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { DEFAULT_POLICY, feeMinor, paymentBalance, quote, settleFee } from "@/concept/booking/protection";
import { changeRule, deadline, visitTime } from "@/concept/booking/policy";
import { salonCancellationOnly } from "@/concept/booking/settlement";
import { checkoutReference, resumeCheckout } from "@/concept/booking/deposit-checkout";
import { recallGuest, rememberHeldGuest } from "@/concept/booking/guest";
import { depositMethods } from "@/concept/connections/ports/payments";
import { balanceOf } from "@/concept/giftcards/cards";
import { migrateState } from "@/concept/data/migrate";
import { purgeExpired } from "@/concept/trash/trash";
import { readSalonNow, subscribeSalonClock } from "@/concept/use-now";
import { t } from "@/concept/i18n";
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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  it("refunds a paid visit once when restoring a customer whose slot was taken", () => {
    const booked = paid();
    const visit = booked.bookings[0];
    const deleted = reduce(booked, { type: "customer/delete", id: visit.customerId });
    const taken = reduce(deleted, { type: "booking/create", date: visit.date, start: visit.start,
      serviceId: visit.serviceId, staffId: visit.staffId, customerId: deleted.customers[0].id, source: "phone" });
    const action = { type: "trash/restore", id: taken.trash[0].id } as const;
    const restored = applyAction(taken, action, defaultMeta(action, now));
    expect(restored.bookings.find(b => b.id === visit.id)).toMatchObject({
      status: "cancelled", protection: { refund: { amountMinor: visit.protection!.terms.depositMinor } },
    });
    expect(restored.log[0].patch).toBeUndefined();
    expect(reduce(restored, action)).toBe(restored);
    expect(demoOutbox.list("payments").map(p => p.action)).toEqual(["checkout", "refund"]);
  });

  it("allows a customer reason and full refund through the free-cancellation deadline", () => {
    const booked = paid();
    const visit = booked.bookings[0];
    const cutoff = deadline(visit, policy.freeHours).toMillis();
    expect(salonCancellationOnly(visit, cutoff)).toBe(false);
    expect(salonCancellationOnly(visit, cutoff + 1)).toBe(true);
    const reason = t("cancel.reason.customer");
    const cancelled = reduce(booked, { type: "booking/cancel", id: visit.id, reason }, cutoff);
    expect(cancelled.bookings[0]).toMatchObject({ cancelReason: reason, protection: { refund: { amountMinor: 20000 } } });
  });

  it("keeps returned credit spent on a second visit intact through deletion, migration and purge", () => {
    const booked = paid();
    const first = booked.bookings[0];
    const second = { ...first, id: "other-visit", customerId: booked.customers[0].id };
    const sold = reduce({ ...booked, bookings: [first, second] }, {
      type: "giftcard/sell", recipient: "Demo Guest", message: "", date: today, amount: 100,
    });
    const card = sold.giftCards[0];
    const redeem = { type: "giftcard/redeem", code: card.code, bookingId: first.id, date: today } as const;
    const used = reduce(sold, redeem);
    const decided = reduce(used, { type: "booking/fee", id: first.id, incident: "noshow", outcome: "charge" }, visitTime(first).toMillis());
    expect(balanceOf(decided, decided.giftCards[0])).toBe(100);
    const spent = reduce(decided, { ...redeem, bookingId: second.id });
    const deleted = reduce(spent, { type: "customer/delete", id: first.customerId });
    expect(deleted.giftCards[0].redemptions[0].returned).toBe(true);
    expect(balanceOf(deleted, deleted.giftCards[0])).toBe(0);
    const legacy = { ...deleted, version: 21, giftCards: [{ ...card, redemptions: deleted.giftCards[0].redemptions.map(r =>
      ({ date: r.date, amount: r.amount, bookingId: r.bookingId })) }] };
    for (const snapshot of [deleted, migrateState(legacy)!]) {
      const purged = purgeExpired(snapshot, "2027-01-01");
      expect(purged.trash).toHaveLength(0);
      expect(purged.giftCards[0].redemptions[0].returned).toBe(true);
      expect(balanceOf(purged, purged.giftCards[0])).toBe(0);
    }
  });

  it("refreshes free cancellation at the exact cutoff and again when it has passed", () => {
    const visit = paid().bookings[0];
    const cutoff = deadline(visit, policy.freeHours).toMillis();
    vi.setSystemTime(cutoff - 15_000);
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const displayed = () => {
      const clock = readSalonNow();
      return changeRule(visit, clock.today, clock.minutes, clock.instant);
    };
    const refresh = vi.fn(displayed);
    const stop = subscribeSalonClock(refresh);
    expect(displayed()).toBe("free");
    vi.advanceTimersByTime(15_000);
    expect(refresh).toHaveLastReturnedWith("free");
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveLastReturnedWith("late");
    vi.advanceTimersByTime(14_999);
    expect(displayed()).toBe(changeRule(visit, today, 600, Date.now()));
    stop();
  });

  it.each([[100, false], [299, false], [300, true], [15_000_000, true], [15_000_001, false]] as const)(
    "offers and accepts Swish consistently for a SEK deposit of %i minor units", (depositMinor, eligible) => {
      const pending = reduce({ ...initial, services: [{ ...service, price: 200000 }],
        cancellationPolicy: { ...policy, deposits: { [service.id]: depositMinor } } }, request);
      const hold = pending.checkoutHolds[0];
      expect(depositMethods(depositMinor, "SEK").includes("swish")).toBe(eligible);
      const result = reduce(pending, { type: "online/pay", id: hold.id, method: "swish" });
      expect(result !== pending).toBe(eligible);
      expect(demoOutbox.list("payments")).toHaveLength(eligible ? 1 : 0);
    },
  );

  it.each([false, true])("restores only the held guest's contact choice (%s) after reload", optedIn => {
    const storage = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => storage.get(key), removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    } });
    const pending = held();
    const hold = pending.checkoutHolds[0];
    const reference = checkoutReference(hold, optedIn);
    expect(reference).not.toContain(hold.guest.phone);
    expect(resumeCheckout([], reference)).toEqual({ hold: undefined, remember: false });
    expect(resumeCheckout([hold], `${hold.id}/${hold.expiresAt}`).remember).toBe(false);
    const resumed = resumeCheckout(pending.checkoutHolds, reference);
    const booked = reduce(pending, { type: "online/pay", id: resumed.hold!.id, method: "card" });
    const { customerId } = booked.bookings[0];
    if (resumed.remember) rememberHeldGuest(initial.salon.slug, resumed.hold!, customerId);
    expect(recallGuest(initial.salon.slug)).toEqual(optedIn ? { name: hold.guest.name, phone: hold.guest.phone, customerId } : undefined);
  });
});
