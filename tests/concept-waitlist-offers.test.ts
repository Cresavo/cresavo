import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { manualGaps, nextMatch, nextSmsTime, nextWaitlistWake, queueOrder, validPreferences } from "@/concept/booking/waitlist-match";
import type { WaitlistGap } from "@/concept/booking/waitlist-types";
import { demoOutbox } from "@/concept/connections/demo";
import { isFree, needOf, withSlotClock } from "@/concept/data/slots";
import type { Booking, DemoState } from "@/concept/data/types";
import { applyAction, defaultMeta } from "@/concept/log/capture";
import { offeredSince, withOffersHeld } from "@/concept/booking/waitlist-offer";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { entrySummary } from "@/concept/booking/waitlist-entry";
import { deleteCustomer } from "@/concept/trash/trash";
import { createDemoState } from "@/concept/data/generate";
import { isNewCustomer } from "@/concept/booking/lookup";
import { openSlots } from "@/concept/booking/suggest";
import { quote } from "@/concept/booking/protection";
import { MAX_REQUEST_DAYS } from "@/concept/booking/waitlist-types";
import { addDays } from "@/concept/data/dates";
import { t } from "@/concept/i18n";
import { needsMoving, outsideShift } from "@/concept/ops/needs-moving";
import { MemoryStudioStore } from "@/concept/store/memory-studio-store";

// Fictional salon, fictional guests. Thursday 19 November 2026, 10:00 in Stockholm.
const day = "2026-11-19";
const now = Date.parse(`${day}T10:00:00+01:00`);
const date = "2026-11-20";
const notice = { title: "Demo request", body: "Fictional visit" };
const tick = { type: "waitlist/advance" } as const;
const cancel = { type: "booking/cancel", id: "visit" } as const;
const salon = createSalon(day, { ...salonDraft("en"), name: "Studio Demo", people: ["Alex Demo", "Sam Demo"] });
const [alex, sam] = salon.staff.map((s) => s.id);
const base: DemoState = {
  ...salon,
  services: [{ ...salon.services[0], duration: 60, staffIds: [alex, sam] }],
  modules: { ...salon.modules, waitlist: true },
};
const serviceId = base.services[0].id;
const gap: WaitlistGap = { id: "gap", date, staffId: alex, start: 600, end: 660 };

function join(state: DemoState, n: number, at = now, days = [date], extra: Partial<Extract<DemoAction, { type: "online/waitlist" }>> = {}) {
  return reduce(state, {
    type: "online/waitlist", serviceId, days, notice, ...extra,
    guest: { name: `Demo Guest ${n}`, phone: `070123456${n}`, at: { date: day, time: 600 } },
  }, at);
}

/** Two guests wait for Friday; Alex has a visit at 10:00 that will be cancelled. */
function setup(mode: "automatic" | "ask" | "off" = "automatic", state: DemoState = base) {
  const visit: Booking = { id: "visit", date, start: 600, duration: 60, staffId: alex, serviceId, customerId: "original", source: "phone", status: "booked", price: 550 };
  const ready = { ...state, bookings: [visit], waitlistRules: { ...state.waitlistRules, mode } };
  return join(join(ready, 1), 2, now + 1);
}

/** The price and policy the offer page shows its customer. */
function shownTerms(state: DemoState, id: string) {
  const offer = state.waitlistOffers.find((o) => o.id === id) ?? state.waitlistOffers[0];
  const service = state.services.find((s) => s.id === offer.serviceId)!;
  return quote(state.cancellationPolicy, service, state.localization.currency, isNewCustomer(state, state.customers.find((c) => c.id === offer.customerId)));
}

function claim(state: DemoState, id: string, at = now) {
  return reduce(state, { type: "online/claim", id, notice, terms: shownTerms(state, id) }, at);
}

beforeEach(() => demoOutbox.clear());

describe("matching a freed time", () => {
  it("fits the treatment and both buffers inside the gap, and the visit inside the customer's window", () => {
    const state = { ...setup(), bookings: [] };
    state.services = [{ ...state.services[0], bufferBefore: 5, bufferAfter: 10 }];
    const entry = { ...state.waitlistEntries[0], window: { start: 605, end: 665 } };
    state.waitlistEntries = [entry];
    expect(nextMatch(state, { ...gap, end: 675 }, now)?.start).toBe(605);
    expect(nextMatch(state, { ...gap, end: 674 }, now)).toBeUndefined();
    expect(nextMatch({ ...state, waitlistEntries: [{ ...entry, window: { start: 605, end: 664 } }] }, { ...gap, end: 675 }, now)).toBeUndefined();
    expect(nextMatch({ ...state, waitlistEntries: [{ ...entry, staffId: sam }] }, gap, now)).toBeUndefined();
    expect(nextMatch(state, { ...gap, date: "2026-11-18" }, now)).toBeUndefined();
  });

  it("accepts only real days from today on and a window inside one day", () => {
    expect(validPreferences([date], { start: 0, end: 1440 }, day)).toBe(true);
    expect(validPreferences(["2026-11-31"], { start: 0, end: 1440 }, day)).toBe(false);
    expect(validPreferences(["2026-11-18"], { start: 0, end: 1440 }, day)).toBe(false);
    expect(validPreferences([date, date], { start: 0, end: 1440 }, day)).toBe(false);
    expect(validPreferences([date], { start: 600, end: 600 }, day)).toBe(false);
    expect(validPreferences([], { start: 0, end: 1440 }, day)).toBe(false);
  });

  it("serves the longest waiting first, then the earliest requested day, then the entry", () => {
    const state = { ...setup(), bookings: [] };
    const [a, b] = state.waitlistEntries;
    state.waitlistEntries = [a, { ...b, joinedAt: a.joinedAt, days: [day, date] }];
    expect(nextMatch(state, gap, now)?.entry.id).toBe(b.id);
    state.waitlistEntries = [a, { ...b, joinedAt: a.joinedAt + 1, days: [day, date] }];
    expect(nextMatch(state, gap, now)?.entry.id).toBe(a.id);
    expect([b, a].sort(queueOrder).map((e) => e.id)).toEqual([a.id, b.id]);
  });

  it("skips a missing spring hour, uses the first autumn occurrence and ends quiet hours at 08:00 local time", () => {
    const state = setup();
    const night = { open: 0, close: 360 };
    state.salon = { ...state.salon, hours: { 0: night } };
    state.staff = [{ ...state.staff[0], week: { 0: { start: 0, end: 360 } } }];
    state.services = [{ ...state.services[0], duration: 15 }];
    const spring = "2027-03-28", autumn = "2027-10-31";
    state.waitlistEntries = [{ ...state.waitlistEntries[0], days: [spring, autumn] }];
    state.bookings = [];
    expect(nextMatch(state, { ...gap, date: spring, start: 120, end: 180 }, now)).toBeUndefined();
    expect(nextMatch(state, { ...gap, date: autumn, start: 135, end: 150 }, now)?.instant).toBe(Date.parse(`${autumn}T02:15:00+02:00`));
    expect(nextSmsTime(Date.parse("2027-03-27T21:00:00+01:00"))).toBe(Date.parse(`${spring}T08:00:00+02:00`));
    expect(nextSmsTime(Date.parse("2027-10-30T21:00:00+02:00"))).toBe(Date.parse(`${autumn}T08:00:00+01:00`));
    expect(nextSmsTime(now)).toBe(now);
  });
});

describe("offers one customer at a time", () => {
  it("asks first, holds the person and the room, then books once from the personal link", () => {
    const initial = setup("ask");
    initial.resources = [{ id: "chair", name: "Chair", kind: "chair" }];
    initial.services = [{ ...initial.services[0], resourceIds: ["chair"] }];
    const freed = reduce(initial, cancel, now);
    expect(freed.waitlistOffers).toHaveLength(0);
    expect(freed.waitlistGaps).toHaveLength(1);
    expect(demoOutbox.list("sms")).toHaveLength(0);
    const offered = reduce(freed, { type: "waitlist/offer", gapId: freed.waitlistGaps[0].id }, now);
    const offer = offered.waitlistOffers[0];
    expect(offer).toMatchObject({ status: "offered", offeredBy: "owner", customerId: initial.waitlistEntries[0].customerId, expiresAt: now + 15 * 60_000 });
    expect(demoOutbox.list("sms")).toEqual([expect.objectContaining({ to: `customer:${offer.customerId}`, body: expect.stringContaining(offer.id) })]);
    expect(offered.inbox[0]).toMatchObject({ offerId: offer.id, waitlistOffer: true });
    // The hold blocks the person and the chair for everyone else while it lasts.
    for (const person of offered.staff) expect(withSlotClock(now, () => isFree(offered, person.id, date, 600, needOf(offered.services[0])))).toBe(false);
    expect(withSlotClock(offer.expiresAt, () => isFree(offered, sam, date, 600, needOf(offered.services[0])))).toBe(true);
    expect(claim(offered, "another-offer")).toBe(offered);
    const booked = claim(offered, offer.id);
    expect(booked.bookings.at(-1)).toMatchObject({ customerId: offer.customerId, start: 600, resourceId: "chair", status: "booked" });
    expect(booked.waitlistOffers[0]).toMatchObject({ status: "claimed", bookingId: booked.bookings.at(-1)!.id });
    expect(booked.waitlistEntries.some((e) => e.customerId === offer.customerId)).toBe(false);
    expect(booked.customers.find((c) => c.id === offer.customerId)?.waitlist).toBe(false);
    expect(claim(booked, offer.id)).toBe(booked);
    expect(claim({ ...offered, bookings: initial.bookings }, offer.id).bookings).toEqual(initial.bookings);
  });

  it("books a claim for the offered customer even when another contact shares the phone number", () => {
    const offered = reduce(setup(), cancel, now);
    const offer = offered.waitlistOffers[0];
    const owner = offered.customers.find((c) => c.id === offer.customerId)!;
    const twin = { ...owner, id: "k-twin", firstName: "Other", waitlist: false, waitlistProspect: undefined };
    const shared = { ...offered, customers: [twin, ...offered.customers] };
    const booked = claim(shared, offer.id);
    expect(booked.bookings.at(-1)?.customerId).toBe(owner.id);
    const deposit = { ...shared, cancellationPolicy: { ...shared.cancellationPolicy, deposits: { [serviceId]: 15000 } } };
    const held = claim(deposit, offer.id);
    expect(held.checkoutHolds[0].customerId).toBe(owner.id);
    const paid = reduce(held, { type: "online/pay", id: held.checkoutHolds[0].id, method: "card" }, now);
    expect(paid.bookings.at(-1)?.customerId).toBe(owner.id);
    expect(paid.inbox.find((i) => i.bookingId === paid.bookings.at(-1)?.id)?.customerId).toBe(owner.id);
  });

  it("refuses a claim when the price changed after the customer saw the offer", () => {
    const offered = reduce(setup(), cancel, now);
    const offer = offered.waitlistOffers[0];
    const shown = shownTerms(offered, offer.id);
    const repriced = reduce(offered, { type: "service/price", id: serviceId, price: offered.services[0].price + 100 }, now);
    const action = { type: "online/claim", id: offer.id, notice, terms: shown } as const;
    expect(reduce(repriced, action, now)).toBe(repriced);
    const booked = reduce(repriced, { ...action, terms: shownTerms(repriced, offer.id) }, now);
    expect(booked.bookings.at(-1)).toMatchObject({ customerId: offer.customerId, price: offered.services[0].price + 100 });
  });

  it.each(["online/decline", "online/leave", "waitlist/advance"] as const)("hands the time on exactly once after %s", (type) => {
    const offered = reduce(setup(), cancel, now);
    const first = offered.waitlistOffers[0];
    const at = type === "waitlist/advance" ? first.expiresAt : now + 1;
    const next = reduce(offered, type === "waitlist/advance" ? tick : { type, id: type === "online/leave" ? first.entryId : first.id }, at);
    expect(next.waitlistOffers.map((o) => o.status)).toEqual([type === "waitlist/advance" ? "lapsed" : "declined", "offered"]);
    expect(next.waitlistOffers[1].customerId).toBe(next.waitlistEntries.at(-1)!.customerId);
    expect(reduce(next, tick, at)).toBe(next);
    expect(claim(next, first.id, at)).toBe(next);
    expect(next.inbox.filter((i) => i.offerId)).toHaveLength(2);
  });

  it("never texts a customer who withdraws in the first action after a hold ran out", () => {
    const offered = reduce(setup(), cancel, now);
    const [first, next] = offered.waitlistEntries;
    demoOutbox.clear();
    const at = offered.waitlistOffers[0].expiresAt;
    const left = reduce(offered, { type: "online/leave", id: next.id }, at);
    expect(left.waitlistOffers.map((o) => o.status)).toEqual(["lapsed"]);
    expect(left.waitlistEntries.map((e) => e.id)).toEqual([first.id]);
    expect(demoOutbox.list("sms")).toEqual([]);
    // The same withdrawal through a store publishes nothing either.
    const store = new MemoryStudioStore({ tenants: { demo: offered }, now: () => at });
    return store.apply("demo", { type: "online/leave", id: next.id }).then((result) => {
      expect(result.ok).toBe(true);
      expect(store.published("demo")).toEqual([]);
    });
  });

  it("keeps a freed time for a customer who holds another offer, and offers it once that ends", () => {
    const monday = "2026-11-23";
    const state = setup();
    // One customer waits for Friday and Monday; Alex has visits on both days.
    state.waitlistEntries = [{ ...state.waitlistEntries[0], days: [date, monday] }];
    state.bookings = [...state.bookings, { ...state.bookings[0], id: "monday", date: monday }];
    const friday = reduce(state, cancel, now);
    expect(friday.waitlistOffers).toHaveLength(1);
    const both = reduce(friday, { type: "booking/cancel", id: "monday" }, now + 1);
    expect(both.waitlistGaps.map((g) => g.date).sort()).toEqual([date, monday]);
    expect(both.waitlistOffers.filter((o) => o.status === "offered")).toHaveLength(1);
    const declined = reduce(both, { type: "online/decline", id: friday.waitlistOffers[0].id }, now + 2);
    expect(declined.waitlistOffers.find((o) => o.status === "offered")).toMatchObject({ date: monday, customerId: state.waitlistEntries[0].customerId });
  });

  it("keeps a freed time while a checkout holds it, and offers it once the checkout ends", () => {
    const state = setup("ask");
    state.cancellationPolicy = { ...state.cancellationPolicy, deposits: { [serviceId]: 15000 } };
    const freed = reduce(state, cancel, now);
    expect(freed.waitlistGaps).toHaveLength(1);
    // Another customer starts a deposit checkout for the freed time before the owner approves.
    const held = reduce(freed, { type: "online/hold", serviceId, staffId: alex, date, start: 600, notice,
      guest: { name: "Demo Guest 8", phone: "0701234568", at: { date: day, time: 600 } } }, now + 1);
    expect(held.checkoutHolds).toHaveLength(1);
    expect(held.waitlistGaps).toHaveLength(1);
    const released = reduce(held, { type: "online/release", id: held.checkoutHolds[0].id }, now + 2);
    const offered = reduce(released, { type: "waitlist/offer", gapId: released.waitlistGaps[0].id }, now + 3);
    expect(offered.waitlistOffers[0]).toMatchObject({ start: 600, status: "offered" });
  });

  it("does not stay due for a checkout that already ended", () => {
    const state = setup("ask");
    state.cancellationPolicy = { ...state.cancellationPolicy, deposits: { [serviceId]: 15000 } };
    const freed = reduce(state, cancel, now);
    const held = reduce(freed, { type: "online/hold", serviceId, staffId: sam, date, start: 900, notice,
      guest: { name: "Demo Guest 8", phone: "0701234568", at: { date: day, time: 600 } } }, now);
    const hold = held.checkoutHolds[0];
    expect(nextWaitlistWake(held, now)).toBe(hold.expiresAt);
    expect(nextWaitlistWake(held, hold.expiresAt + 1)).toBeGreaterThan(hold.expiresAt + 1);
  });

  it("measures a freed time without a checkout beside it, and offers it once the checkout ends", () => {
    const state = setup();
    state.cancellationPolicy = { ...state.cancellationPolicy, deposits: { [serviceId]: 15000 } };
    // 10:00–10:30 is cancelled; a checkout holds 10:30–11:00 and everything after is booked. Customers want an hour.
    state.services = [{ ...state.services[0], duration: 30 }];
    const hourly = { ...state.services[0], id: "hour", duration: 60 };
    state.bookings = [{ ...state.bookings[0], duration: 30 }, { ...state.bookings[0], id: "after", start: 660, duration: 360, customerId: "other" },
      { ...state.bookings[0], id: "before", start: 540, duration: 60, customerId: "other" }];
    const held = reduce(state, { type: "online/hold", serviceId, staffId: alex, date, start: 630, notice,
      guest: { name: "Demo Guest 8", phone: "0701234568", at: { date: day, time: 600 } } }, now);
    expect(held.checkoutHolds).toHaveLength(1);
    const waiting = { ...held, services: [...held.services, hourly], waitlistEntries: held.waitlistEntries.map((e) => ({ ...e, serviceId: "hour" })) };
    const freed = reduce(waiting, cancel, now);
    expect(freed.waitlistGaps).toMatchObject([{ start: 600, end: 660, released: [{ start: 600, end: 630 }] }]);
    expect(freed.waitlistOffers).toEqual([]);
    const released = reduce(freed, { type: "online/release", id: held.checkoutHolds[0].id }, now + 1);
    expect(released.waitlistOffers[0]).toMatchObject({ start: 600, serviceId: "hour", status: "offered" });
  });

  it("ends the queue when nobody else fits", () => {
    const offered = reduce(setup(), cancel, now);
    const second = reduce(offered, { type: "online/decline", id: offered.waitlistOffers[0].id }, now);
    const done = reduce(second, { type: "online/decline", id: second.waitlistOffers[1].id }, now);
    expect(done.waitlistOffers.map((o) => o.status)).toEqual(["declined", "declined"]);
    expect(done.waitlistGaps).toEqual([]);
  });

  it("leaves every request from an older text, including a second treatment window", () => {
    const added = join(setup(), 1, now + 5, [day, date], { window: { start: 540, end: 1020 } });
    const offered = reduce(added, cancel, now + 10);
    const first = offered.waitlistOffers[0];
    const lapsed = reduce(offered, tick, first.expiresAt);
    expect(lapsed.waitlistEntries.filter((e) => e.customerId === first.customerId)).toHaveLength(2);
    const gone = reduce(lapsed, { type: "online/leave", id: first.id, all: true }, first.expiresAt + 1);
    expect(gone.waitlistEntries.filter((e) => e.customerId === first.customerId)).toEqual([]);
    expect(gone.customers.find((c) => c.id === first.customerId)?.waitlist).toBe(false);
    expect(gone.waitlistOffers.at(-1)?.status).toBe("offered");
  });

  it("keeps the offer's deadline through deposit checkout: release, payment and expiry", () => {
    const state = setup();
    state.cancellationPolicy = { ...state.cancellationPolicy, deposits: { [serviceId]: 15000 }, newCustomersOnly: true };
    const offered = reduce(state, cancel, now);
    const offer = offered.waitlistOffers[0];
    const held = claim(offered, offer.id);
    const hold = held.checkoutHolds[0];
    expect(hold).toMatchObject({ expiresAt: offer.expiresAt, offerId: offer.id });
    expect(held.bookings).toEqual(offered.bookings);
    expect(claim(held, offer.id)).toBe(held);
    const pay = { type: "online/pay", id: hold.id, method: "card" } as const;
    expect(reduce(held, pay, hold.expiresAt)).toBe(held);
    expect(reduce(held, tick, hold.expiresAt).waitlistOffers.map((o) => o.status)).toEqual(["lapsed", "offered"]);
    expect(reduce(held, { type: "online/release", id: hold.id }, now).waitlistOffers.map((o) => o.status)).toEqual(["declined", "offered"]);
    const paid = reduce(held, pay, now);
    expect(paid.bookings.at(-1)?.protection?.deposit?.method).toBe("card");
    expect(paid.waitlistOffers[0].status).toBe("claimed");
    expect(paid.checkoutHolds).toEqual([]);
    expect(reduce(paid, pay, now)).toBe(paid);
  });

  it("holds automatic texts until 08:00, drops times that would have started, and ends requests after their last day", () => {
    const evening = Date.parse(`${day}T21:00:00+01:00`);
    const morning = Date.parse(`${date}T08:00:00+01:00`);
    const state = setup();
    const queued = reduce(state, cancel, evening);
    expect(queued.waitlistOffers).toEqual([]);
    expect(queued.waitlistGaps[0].readyAt).toBe(morning);
    expect(nextWaitlistWake(queued)).toBe(morning);
    expect(reduce(queued, tick, morning - 1)).toBe(queued);
    expect(reduce(queued, tick, morning).waitlistOffers).toHaveLength(1);
    const early = { ...state, salon: { ...state.salon, hours: { ...state.salon.hours, 5: { open: 420, close: 1020 } } } };
    early.staff = early.staff.map((s) => ({ ...s, week: { ...s.week, 5: { start: 420, end: 1020 } } }));
    const missed = reduce({ ...early, bookings: [{ ...early.bookings[0], start: 420 }] }, cancel, evening);
    expect(missed.waitlistGaps).toEqual([]);
    const expired = reduce(queued, tick, Date.parse("2026-11-21T00:00:00+01:00"));
    expect(expired.waitlistEntries).toEqual([]);
    expect(expired.customers.every((c) => !c.waitlist)).toBe(true);
  });

  it("lets the owner start a fair queue for a time that was already free", () => {
    const state = { ...setup("ask"), bookings: [] };
    const [{ gap: open }] = manualGaps(state, date, alex, now);
    const action = { type: "waitlist/offer", gapId: open.id, opening: { date, staffId: alex } } as const;
    const offered = reduce(state, action, now);
    expect(offered.waitlistOffers[0].customerId).toBe(state.waitlistEntries[0].customerId);
    expect(reduce(offered, action, now)).toBe(offered);
  });

  it("sends nothing when off or paused, and only the owner changes the rules or approves", () => {
    const freed = reduce(setup("off"), cancel, now);
    expect(freed.waitlistOffers).toEqual([]);
    const rules = { type: "waitlist/rules", rules: { mode: "automatic", paused: true, minutes: 10 } } as const;
    expect(applyAction(freed, rules, { actor: "customer", source: "customer-page", at: now })).toBe(freed);
    expect(reduce(freed, { type: "waitlist/rules", rules: { minutes: 7 } }, now)).toBe(freed);
    const paused = reduce(freed, rules, now);
    expect(paused.waitlistOffers).toEqual([]);
    const resumed = reduce(paused, { type: "waitlist/rules", rules: { paused: false } }, now);
    expect(resumed.waitlistOffers[0].expiresAt).toBe(now + 10 * 60_000);
    const approve = { type: "waitlist/offer", gapId: "gap" } as const;
    expect(applyAction(resumed, approve, { actor: "customer", source: "customer-page", at: now })).toBe(resumed);
  });

  it("is off for a new salon and leaves the queue alone while the add-on is off", () => {
    expect(salon.modules.waitlist).toBe(false);
    expect(salon.waitlistRules.mode).toBe("ask");
    const off = setup("automatic", { ...base, modules: { ...base.modules, waitlist: false } });
    expect(off.waitlistEntries).toEqual([]);
    const waiting = { ...setup(), modules: { ...base.modules, waitlist: false } };
    expect(reduce(waiting, cancel, now).waitlistGaps).toEqual([]);
  });

  it("finds time freed by a move, the owner's offer while cancelling and longer opening hours", () => {
    const state = setup("ask");
    const moved = reduce(state, { type: "booking/move", id: "visit", date, start: 840 }, now);
    // The opening is the whole free stretch before the moved visit; the freed hour is what a match must use.
    expect(moved.waitlistGaps).toMatchObject([{ date, start: 540, end: 840, released: [{ start: 600, end: 660 }] }]);
    const approved = reduce(state, { ...cancel, offerWaitingList: true }, now);
    expect(approved.waitlistOffers[0]).toMatchObject({ start: 600, status: "offered", offeredBy: "automatic" });
    const auto = { ...setup(), bookings: [] };
    const closed = reduce(auto, { type: "salon/close", date, name: "Closed" }, now);
    const open = reduce(closed, { type: "salon/reopen", id: closed.salon.closures[0].id }, now);
    expect(open.waitlistOffers[0]).toMatchObject({ date, status: "offered" });
  });

  it("logs who acted at each step, including the automatic handover after a customer's decision", () => {
    const offered = applyAction(setup(), cancel, defaultMeta(cancel, now));
    const decline = { type: "online/decline", id: offered.waitlistOffers[0].id } as const;
    const after = applyAction(offered, decline, defaultMeta(decline, now));
    expect(after.log.filter((e) => e.type === "waitlist/event").map((e) => e.actor)).toEqual(["automatic", "customer", "automatic"]);
    expect(after.log.find((e) => e.type === "booking/cancel")).toMatchObject({ actor: "owner", patch: undefined });
    expect(defaultMeta(tick, now)).toMatchObject({ actor: "automatic", source: "waitlist" });
  });

  it("keeps first-visit deposit terms for a customer who only joined the waiting list", () => {
    const state = setup();
    const guest = state.customers.find((c) => c.id === state.waitlistEntries[0].customerId)!;
    expect(guest.waitlistProspect).toBe(true);
  });
});

describe("edge cases", () => {
  it("books a public request for whoever has the phone number, whatever customer id it carries", () => {
    const state = setup("ask");
    const waiting = state.customers.find((c) => c.firstName === "Demo" && c.phone === "0701234561")!;
    const stranger = { name: "Demo Stranger", phone: "0709876543", at: { date: day, time: 600 } };
    // A forged public request names a waiting customer and asks for a room of its own choosing.
    const forged = { type: "online/book", serviceId, staffId: sam, date, start: 900, notice, guest: stranger,
      customerId: waiting.id, resourceId: "forged-room" };
    const booked = reduce(state, forged as DemoAction, now);
    const visit = booked.bookings.at(-1)!;
    expect(visit.start).toBe(900);
    expect(visit.customerId).not.toBe(waiting.id);
    expect(booked.customers.find((c) => c.id === visit.customerId)?.phone).toBe(stranger.phone);
    expect(visit.resourceId).toBeUndefined();

    // The deposit rule for new customers applies to the stranger, not to the returning customer the request names.
    const regular = { ...state.customers[0], id: "regular", phone: "0705550000", waitlistProspect: undefined };
    const policy = { ...state.cancellationPolicy, deposits: { [serviceId]: 15000 }, newCustomersOnly: true };
    const strict = { ...state, customers: [...state.customers, regular], cancellationPolicy: policy };
    expect(reduce(strict, { ...forged, customerId: "regular" } as unknown as DemoAction, now)).toBe(strict);
    const held = reduce(strict, { ...forged, type: "online/hold", customerId: "regular" } as unknown as DemoAction, now);
    expect(held.checkoutHolds.at(-1)).toMatchObject({ terms: { depositMinor: 15000 } });
    expect(held.checkoutHolds.at(-1)?.customerId).toBeUndefined();
    expect(held.checkoutHolds.at(-1)?.resourceId).not.toBe("forged-room");
  });

  it("opens the deposit checkout for a claim in a salon with no other bookings, and logs it as held", () => {
    const state = { ...setup("ask"), bookings: [] };
    state.cancellationPolicy = { ...state.cancellationPolicy, deposits: { [serviceId]: 15000 } };
    const [{ gap: open }] = manualGaps(state, date, alex, now);
    const offered = applyAction(state, { type: "waitlist/offer", gapId: open.id, opening: { date, staffId: alex } }, { actor: "owner", source: "button", at: now });
    const offer = offered.waitlistOffers[0];
    const action = { type: "online/claim", id: offer.id, notice, terms: shownTerms(offered, offer.id) } as const;
    const held = applyAction(offered, action, defaultMeta(action, now));
    expect(held.checkoutHolds[0]).toMatchObject({ offerId: offer.id });
    expect(held.log[0]).toMatchObject({ type: "online/claim", summary: t("protection.held") });
  });

  it("keeps the chair an offer reserved through checkout and the booking", () => {
    const initial = setup();
    initial.resources = [{ id: "chair-a", name: "Chair A", kind: "chair" }, { id: "chair-b", name: "Chair B", kind: "chair" }];
    initial.services = [{ ...initial.services[0], resourceIds: ["chair-a", "chair-b"] }];
    initial.bookings = [{ ...initial.bookings[0], resourceId: "chair-b" }, { ...initial.bookings[0], id: "sam-a", staffId: sam, resourceId: "chair-a", customerId: "other" }];
    const offered = reduce(initial, cancel, now);
    expect(offered.waitlistOffers[0].resourceId).toBe("chair-b");
    // Chair A frees up before the customer answers; the offer still stands for chair B.
    const freed = { ...offered, bookings: offered.bookings.filter((b) => b.id !== "sam-a") };
    const id = offered.waitlistOffers[0].id;
    expect(claim(freed, id).bookings.at(-1)?.resourceId).toBe("chair-b");
    const deposit = { ...freed, cancellationPolicy: { ...freed.cancellationPolicy, deposits: { [serviceId]: 15000 } } };
    const held = claim(deposit, id);
    expect(held.checkoutHolds[0].resourceId).toBe("chair-b");
    const paid = reduce(held, { type: "online/pay", id: held.checkoutHolds[0].id, method: "card" }, now);
    expect(paid.bookings.at(-1)?.resourceId).toBe("chair-b");
  });

  it("ends the hold when preparation would have to start", () => {
    const soon = setup();
    soon.services = [{ ...soon.services[0], bufferBefore: 10 }];
    soon.waitlistEntries = soon.waitlistEntries.map((e) => ({ ...e, days: [day] }));
    soon.bookings = [{ ...soon.bookings[0], date: day, start: 620 }];
    const offered = reduce(soon, cancel, now);
    expect(offered.waitlistOffers[0]).toMatchObject({ start: 620, expiresAt: Date.parse(`${day}T10:10:00+01:00`) });
  });

  it("books online only when the preparation has not started yet", () => {
    const prep = { ...base, services: [{ ...base.services[0], bufferBefore: 120 }], bookings: [] };
    const book = (start: number) => reduce(prep, { type: "online/book", serviceId, staffId: alex, date: day, start, notice,
      guest: { name: "Demo Guest 9", phone: "0701234569", at: { date: day, time: 600 } } }, now);
    expect(book(660)).toBe(prep);
    expect(book(720).bookings).toHaveLength(1);
    // Half a minute later preparation for noon has begun, though the guest's clock still says 10:00.
    expect(reduce(prep, { type: "online/book", serviceId, staffId: alex, date: day, start: 720, notice,
      guest: { name: "Demo Guest 9", phone: "0701234569", at: { date: day, time: 600 } } }, now + 30_000)).toBe(prep);
    expect(openSlots(prep, serviceId, day, { today: day, minutes: 600 })[0].start).toBe(720);
    // Half a minute after 10:00, noon's preparation has begun: offered starts follow the exact moment too.
    expect(openSlots(prep, serviceId, day, { today: day, minutes: 600, instant: now + 30_000 })[0].start).toBeGreaterThan(720);
    expect(openSlots(prep, serviceId, day, { today: day, minutes: 600, instant: now })[0].start).toBe(720);
    // A visit booked with two hours of preparation keeps them when it is moved, after the treatment lost them.
    const booked = book(720);
    const visit = booked.bookings[0];
    const lighter = { ...booked, services: [{ ...booked.services[0], bufferBefore: undefined }] };
    const moves = openSlots(lighter, serviceId, day, { today: day, minutes: 600 }, { ignoreId: visit.id });
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((slot) => slot.start - 120 >= 600)).toBe(true);
    expect(openSlots(lighter, serviceId, day, { today: day, minutes: 600 })[0].start).toBe(660);
  });

  it("ends an ordinary deposit checkout when preparation must begin", () => {
    const prep = { ...base, services: [{ ...base.services[0], bufferBefore: 120 }], bookings: [] };
    prep.cancellationPolicy = { ...prep.cancellationPolicy, deposits: { [serviceId]: 15000 } };
    const at = Date.parse(`${day}T09:58:00+01:00`);
    const held = reduce(prep, { type: "online/hold", serviceId, staffId: alex, date: day, start: 720, notice,
      guest: { name: "Demo Guest 9", phone: "0701234569", at: { date: day, time: 598 } } }, at);
    expect(held.checkoutHolds[0].expiresAt).toBe(Date.parse(`${day}T10:00:00+01:00`));
  });

  it("lapses an offer when its room or chair no longer suits the treatment", () => {
    const initial = setup();
    initial.resources = [{ id: "room-a", name: "Room A", kind: "room" }, { id: "room-b", name: "Room B", kind: "room" }];
    initial.services = [{ ...initial.services[0], resourceIds: ["room-a"] }];
    const offered = reduce(initial, cancel, now);
    expect(offered.waitlistOffers[0]).toMatchObject({ status: "offered", resourceId: "room-a" });
    const moved = reduce(offered, { type: "service/resources", id: serviceId, resourceIds: ["room-b"] }, now + 1);
    expect(moved.waitlistOffers[0].status).toBe("lapsed");
    // Removing the last room or clearing the treatment's rooms ends the reservation too.
    expect(reduce(offered, { type: "service/resources", id: serviceId, resourceIds: [] }, now + 1).waitlistOffers[0].status).toBe("lapsed");
    const single = { ...offered, resources: offered.resources.filter((r) => r.id === "room-a"), services: [{ ...offered.services[0], resourceIds: ["room-a"] }] };
    expect(reduce(single, { type: "resource/remove", id: "room-a" }, now + 1).waitlistOffers[0].status).toBe("lapsed");
  });

  it("keeps a gap held by quiet hours when part of it still starts after 08:00", () => {
    const early = setup();
    early.salon = { ...early.salon, hours: { ...early.salon.hours, 5: { open: 420, close: 1020 } } };
    early.staff = early.staff.map((s) => ({ ...s, week: { ...s.week, 5: { start: 420, end: 1020 } } }));
    early.bookings = [{ ...early.bookings[0], start: 420, duration: 150 }];
    const evening = Date.parse(`${day}T21:00:00+01:00`);
    const queued = reduce(early, cancel, evening);
    expect(queued.waitlistGaps).toMatchObject([{ start: 420, end: 1020, released: [{ start: 420, end: 570 }], readyAt: Date.parse(`${date}T08:00:00+01:00`) }]);
    const morning = reduce(queued, tick, Date.parse(`${date}T08:00:00+01:00`));
    expect(morning.waitlistOffers[0].start).toBeGreaterThan(480);
    expect(morning.waitlistOffers[0].start).toBeLessThan(570);
  });

  it("lets a customer leave from an offer whose treatment was taken off the price list", () => {
    const offered = reduce(setup(), cancel, now);
    const offer = offered.waitlistOffers[0];
    const hidden = reduce(offered, { type: "service/visibility", id: serviceId, hidden: true }, now + 1);
    expect(hidden.waitlistOffers[0].status).toBe("lapsed");
    const gone = reduce(hidden, { type: "online/leave", id: offer.id, all: true }, now + 2);
    expect(gone.waitlistEntries.some((e) => e.customerId === offer.customerId)).toBe(false);
  });

  it("empties waiting-list activity that names an erased customer", () => {
    const offered = applyAction(setup(), cancel, defaultMeta(cancel, now));
    const offer = offered.waitlistOffers[0];
    const erased = applyAction(offered, { type: "customer/erase", id: offer.customerId }, { actor: "owner", source: "button", at: now });
    const events = erased.log.filter((e) => e.type === "waitlist/event" && e.customerId === offer.customerId);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event.summary).toBe(t("log.erasedEntry"));
      expect(event.after).toBeUndefined();
    }
    // The time went on to the next customer in the same change, and the log says so.
    const next = erased.waitlistOffers.find((o) => o.status === "offered")!;
    expect(next.customerId).not.toBe(offer.customerId);
    expect(erased.log.filter((e) => e.type === "waitlist/event" && e.customerId === next.customerId).map((e) => e.summary)).toEqual([t("offers.status.offered")]);
  });

  it("empties the entry for joining under a nickname when that customer is erased", () => {
    const known = { ...base, customers: [...base.customers, { id: "k-known", firstName: "Alexandra", lastName: "Fictional", phone: "0701234560", email: "", category: base.services[0].category, preferredStaff: alex, since: day, isRegular: false, tags: [], waitlist: false }] };
    const action: DemoAction = { type: "online/waitlist", serviceId, days: [date], notice, guest: { name: "Sasha", phone: "0701234560", at: { date: day, time: 600 } } };
    const joined = applyAction(known, action, defaultMeta(action, now));
    expect(joined.log[0]).toMatchObject({ type: "online/waitlist", customerId: "k-known" });
    const erased = applyAction(joined, { type: "customer/erase", id: "k-known" }, { actor: "owner", source: "button", at: now });
    expect(JSON.stringify(erased.log)).not.toContain("Sasha");
  });

  it("tells the owner a customer was offered the time only when one was", () => {
    const state = setup("ask");
    const visit = state.bookings[0];
    expect(offeredSince(state, reduce(state, { ...cancel, offerWaitingList: true }, now), visit)).toBe(true);
    // Everyone waiting wants Sam, so the freed time with Alex goes to nobody.
    const elsewhere = { ...state, waitlistEntries: state.waitlistEntries.map((e) => ({ ...e, staffId: sam })) };
    expect(offeredSince(elsewhere, reduce(elsewhere, { ...cancel, offerWaitingList: true }, now), visit)).toBe(false);
    // An unrelated offer for another time sent in the same change does not make the toast say this one was offered.
    const other = { ...elsewhere.waitlistOffers[0] ?? {}, id: "o-other", gapId: "g-other", entryId: "e", customerId: "c", serviceId, staffId: sam, date, start: 900, duration: 60, offeredAt: now, offeredBy: "automatic" as const, expiresAt: now + 1, status: "offered" as const };
    expect(offeredSince(elsewhere, { ...elsewhere, waitlistOffers: [other] }, visit)).toBe(false);
  });

  it("keeps a deleted treatment's name for the waiting-list requests that name it", () => {
    const ready = setup();
    // A second treatment, so the waited-for one may be deleted.
    const state = { ...ready, bookings: [], services: [...ready.services, { ...ready.services[0], id: "other-treatment", name: "Other" }] };
    const name = state.services[0].name;
    const deleted = reduce(state, { type: "service/delete", id: serviceId }, now);
    expect(deleted.services.map((s) => s.id)).toEqual(["other-treatment"]);
    expect(deleted.retiredServices.map((s) => s.id)).toContain(serviceId);
    expect(entrySummary(deleted, deleted.waitlistEntries[0] ?? state.waitlistEntries[0])).toContain(name);
  });

  it("gives an open offer back its gap, so a restored offer still hands the time on", () => {
    const offered = reduce(setup(), cancel, now);
    const restored = reduce({ ...offered, waitlistGaps: [] }, tick, now + 1);
    expect(restored.waitlistGaps.map((g) => g.id)).toEqual([offered.waitlistOffers[0].gapId]);
    const declined = reduce(restored, { type: "online/decline", id: offered.waitlistOffers[0].id }, now + 2);
    expect(declined.waitlistOffers.map((o) => o.status)).toEqual(["declined", "offered"]);
  });

  it("warns about a visit whose cleanup no longer fits the shift", () => {
    const state = setup();
    state.bookings = [{ ...state.bookings[0], start: 945, bufferAfter: 15 }];
    expect(needsMoving(state, day, 600)).toHaveLength(0);
    // The visit itself still ends by 16:55; its cleanup does not.
    const tight = { ...state, exceptions: [{ id: "x", staffId: alex, date, kind: "shift" as const, start: 540, end: 1015 }] };
    expect(needsMoving(tight, day, 600).map((m) => m.reason)).toEqual(["hours"]);
    expect(outsideShift(state.bookings[0], { start: 540, end: 1020 })).toBe(false);
  });

  it("offers the whole opening a short cancellation completes, using the freed time", () => {
    const state = setup();
    // 10:00–10:30 is cancelled next to a free 10:30–11:00; the waiting customers want an hour.
    state.bookings = [
      { ...state.bookings[0], duration: 30 },
      { ...state.bookings[0], id: "before", start: 540, duration: 60, customerId: "other" },
      { ...state.bookings[0], id: "after", start: 660, duration: 360, customerId: "other" },
    ];
    const offered = reduce(state, cancel, now);
    expect(offered.waitlistGaps[0]).toMatchObject({ start: 600, end: 660, released: [{ start: 600, end: 630 }] });
    expect(offered.waitlistOffers[0]).toMatchObject({ start: 600, duration: 60, status: "offered" });
    // Time that was free already is not a new opening on its own.
    expect(nextMatch(state, { ...gap, start: 630, end: 660 }, now)).toBeUndefined();
  });

  it("keeps two freed parts of one stretch apart, so time free before is not offered as new", () => {
    const state = { ...setup(), bookings: [] };
    // A customer who wants only noon; Alex's hours grow from 10:00–14:00 to 09:00–15:00.
    state.waitlistEntries = [{ ...state.waitlistEntries[0], window: { start: 720, end: 780 } }];
    state.staff = state.staff.map((s) => (s.id === alex ? { ...s, week: { ...s.week, 5: { start: 600, end: 840 } } } : s));
    const longer = reduce(state, { type: "staff/week", staffId: alex, week: { ...state.staff[0].week, 5: { start: 540, end: 900 } } }, now);
    expect(longer.waitlistGaps).toEqual([]);
    expect(longer.waitlistOffers).toEqual([]);
    const gapWithTwo: WaitlistGap = { ...gap, start: 540, end: 900, released: [{ start: 540, end: 600 }, { start: 840, end: 900 }] };
    const anyTime = { ...longer, waitlistEntries: [{ ...state.waitlistEntries[0], window: { start: 0, end: 1440 } }] };
    expect(nextMatch(anyTime, gapWithTwo, now)?.start).toBe(540);
    expect(nextMatch(anyTime, { ...gapWithTwo, start: 600, end: 840, released: [{ start: 540, end: 600 }, { start: 840, end: 900 }] }, now)).toBeUndefined();
  });

  it("leaves free time outside a cancellation's freed hour to manual offers", () => {
    const state = setup("ask");
    const freed = reduce(state, cancel, now);
    expect(freed.waitlistGaps[0]).toMatchObject({ start: 540, end: 1020, released: [{ start: 600, end: 660 }] });
    const parts = manualGaps(freed, date, alex, now).map(({ gap: part }) => [part.start, part.end]);
    expect(parts).toEqual([[540, 600], [660, 1020]]);
  });

  it("finds the opening when part of the freed visit is blocked and the rest joins free time", () => {
    const state = setup();
    // 10:00–10:30 is moved away; a block covers 10:00–10:15 and 10:30–11:00 was free. A 45-minute treatment fits at 10:15.
    state.services = [{ ...state.services[0], duration: 45 }];
    state.bookings = [
      { ...state.bookings[0], duration: 30 },
      { ...state.bookings[0], id: "before", start: 540, duration: 60, customerId: "other" },
      { ...state.bookings[0], id: "after", start: 660, duration: 360, customerId: "other" },
    ];
    state.blocks = [{ id: "block", staffId: alex, date, start: 600, end: 615, reason: "admin" }];
    const moved = reduce(state, { type: "booking/move", id: "visit", date, start: 900, staffId: sam }, now);
    expect(moved.waitlistGaps[0]).toMatchObject({ start: 615, end: 660, released: [{ start: 615, end: 630 }] });
    expect(moved.waitlistOffers[0]).toMatchObject({ start: 615, status: "offered" });
  });

  it("can still offer the free time around a queued gap", () => {
    const state = { ...setup("ask"), bookings: [], waitlistGaps: [{ ...gap, id: "queued" }] };
    const parts = manualGaps(state, date, alex, now).map(({ gap: part }) => [part.start, part.end]);
    expect(parts).toEqual([[540, 600], [660, 1020]]);
  });

  it("logs a handover that happens while the owner only reads a message", () => {
    const offered = reduce(setup(), cancel, now);
    const read = { type: "inbox/read", id: offered.inbox[0].id } as const;
    const after = applyAction(offered, read, { actor: "owner", source: "button", at: offered.waitlistOffers[0].expiresAt });
    expect(after.waitlistOffers.map((o) => o.status)).toEqual(["lapsed", "offered"]);
    expect(after.log.filter((e) => e.type === "waitlist/event").map((e) => e.summary)).toEqual([t("offers.status.offered"), t("offers.status.lapsed")]);
  });

  it("accepts at most seven days in one request", () => {
    const week = Array.from({ length: 8 }, (_, i) => addDays(date, i));
    expect(validPreferences(week.slice(0, MAX_REQUEST_DAYS), { start: 0, end: 1440 }, day)).toBe(true);
    expect(validPreferences(week, { start: 0, end: 1440 }, day)).toBe(false);
    expect(join(base, 1, now, week)).toBe(base);
  });
});

describe("through a store", () => {
  it("publishes the personal text only when the change commits, and nothing for a refused claim", async () => {
    const store = new MemoryStudioStore({ tenants: { demo: setup() }, now: () => now });
    const cancelled = await store.apply("demo", cancel);
    expect(cancelled.ok).toBe(true);
    const texts = store.published("demo").filter((e) => e.port === "sms");
    expect(texts).toHaveLength(1);
    expect(texts[0].to).toMatch(/^customer:/);
    expect(demoOutbox.list()).toEqual([]);
    const offer = (await store.load("demo"))!.state.waitlistOffers[0];
    const refused = await store.apply("demo", { type: "online/claim", id: offer.id, notice, terms: { ...shownTerms((await store.load("demo"))!.state, offer.id), version: 999 } });
    expect(refused).toMatchObject({ ok: false, reason: "rejected" });
    expect(store.published("demo").filter((e) => e.port === "sms")).toHaveLength(1);
  });
});

describe("in the browser store", () => {
  const KEY = "salong-eko-demo";

  /** Web Locks shared by every tab of one test: callbacks run one after another. */
  function sharedLocks() {
    let queue: Promise<unknown> = Promise.resolve();
    const lock = {
      /** True while some tab's callback holds the lock, and the name it was requested under. */
      busy: false,
      held: undefined as string | undefined,
      request: (name: string, run: () => unknown) => {
        const next = queue.then(async () => {
          lock.busy = true;
          lock.held = name;
          try {
            return await run();
          } finally {
            lock.busy = false;
            lock.held = undefined;
          }
        });
        queue = next.catch(() => undefined);
        return next;
      },
    };
    return lock;
  }
  let locks = sharedLocks();
  beforeEach(() => { locks = sharedLocks(); });

  /** A fresh copy of the store module over one shared, fictional localStorage. `withLocks: false` is a browser without Web Locks. */
  async function openTab(storage: { raw: string; full?: boolean; onFull?: () => void; beforeWrite?: () => void; race?: { afterReads: number; write: () => void };
    others?: Map<string, string>; writes?: { key: string; lock?: string }[] }, withLocks = true, session?: Map<string, string>) {
    const others = storage.others ?? new Map<string, string>();
    const localStorage = {
      get length() { return others.size + 1; },
      key: (index: number) => [KEY, ...others.keys()][index] ?? null,
      getItem: (key: string) => {
        if (key !== KEY) return others.get(key) ?? null;
        if (storage.race && storage.race.afterReads-- === 0) {
          storage.race.write();
          storage.race = undefined;
        }
        return storage.raw;
      },
      setItem: (key: string, value: string) => {
        storage.writes?.push({ key, lock: locks.held });
        if (key !== KEY) return void others.set(key, value);
        if (storage.full) {
          storage.onFull?.();
          throw new Error("quota");
        }
        storage.beforeWrite?.();
        storage.raw = value;
      },
      removeItem: (key: string) => {
        if (key === KEY) storage.raw = null as unknown as string;
        else others.delete(key);
      },
    };
    // `session`: a browser tab of its own (sessionStorage); by default every page shares one tab.
    const sessionStorage = session ? {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => void session.set(key, value),
      removeItem: (key: string) => void session.delete(key),
    } : localStorage;
    vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage, location: { origin: "http://localhost" } }));
    vi.stubGlobal("navigator", withLocks ? { locks } : {});
    vi.resetModules();
    return import("@/concept/store");
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends the personal text once, after the save, when another tab wrote first", async () => {
    const state = setup();
    const storage: { raw: string; race?: { afterReads: number; write: () => void } } = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    const { demoOutbox: outbox } = await import("@/concept/connections/demo");
    tab.currentState();
    // Another tab saves while this one prepares the change: the first attempt is discarded and run again.
    const other = { ...state, seq: state.seq + 5, inbox: [{ ...state.inbox[0], id: "i-other" }, ...state.inbox] };
    storage.race = { afterReads: 1, write: () => { storage.raw = JSON.stringify(other); } };
    outbox.clear();
    expect(await tab.withBookingLock(() => tab.dispatch(cancel))).toBe(true);
    expect(storage.race).toBeUndefined();
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.inbox.some((i) => i.id === "i-other")).toBe(true);
    expect(saved.waitlistOffers).toHaveLength(1);
    expect(outbox.list("sms")).toEqual([expect.objectContaining({ to: `customer:${saved.waitlistOffers[0].customerId}`, body: expect.stringContaining(saved.waitlistOffers[0].id) })]);
  });

  it("starts the sample salon's new day unless an offer is still out", async () => {
    const yesterday = "2026-11-18";
    const sample = createDemoState(yesterday);
    const offer = { ...reduce(setup(), cancel, now).waitlistOffers[0], date: day };
    const ended = { ...sample, waitlistOffers: [{ ...offer, status: "lapsed" as const }] };
    expect((await openTab({ raw: JSON.stringify(ended) })).currentState()).toMatchObject({ generatedFor: day, waitlistOffers: [] });
    // An offer still marked open whose hold ended while every tab was closed, and a gap long past, do not count either.
    const stale = { ...sample, waitlistOffers: [{ ...offer, expiresAt: now - 1 }], waitlistGaps: [{ ...gap, date: yesterday }] };
    expect((await openTab({ raw: JSON.stringify(stale) })).currentState()).toMatchObject({ generatedFor: day, waitlistOffers: [] });
    const live = { ...sample, waitlistOffers: [{ ...offer, expiresAt: now + 60_000 }] };
    const kept = (await openTab({ raw: JSON.stringify(live) })).currentState()!;
    expect(kept.waitlistOffers).toHaveLength(1);
    expect(kept.bookings).toEqual(sample.bookings);
  });

  it("shows a change made outside the lock at once, and saves and sends it only under the lock", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    const { demoOutbox: outbox } = await import("@/concept/connections/demo");
    outbox.clear();
    expect(tab.dispatch(cancel)).toBe(true);
    // The page sees the cancellation straight away; nothing is saved or texted until the lock is held.
    expect(tab.currentState()?.bookings[0].status).toBe("cancelled");
    expect(JSON.parse(storage.raw)).toEqual(JSON.parse(JSON.stringify(state)));
    expect(outbox.list("sms")).toEqual([]);
    await tab.withBookingLock(() => true);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.bookings[0].status).toBe("cancelled");
    expect(saved.waitlistOffers).toHaveLength(1);
    expect(outbox.list("sms")).toHaveLength(1);
  });

  it("never lets a write made outside the lock overwrite the first offer another tab committed", async () => {
    const state = setup();
    const storage: { raw: string; beforeWrite?: () => void } = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    tab.currentState();
    // The other tab commits the first offer under the lock, on whatever is saved when it gets the lock.
    let otherCommitted = false;
    const otherTab = () => {
      storage.raw = JSON.stringify(reduce(JSON.parse(storage.raw) as DemoState, cancel, now));
      otherCommitted = true;
    };
    // It gets the lock whenever nobody holds it, even between this tab's last read and its save.
    storage.beforeWrite = () => {
      if (!otherCommitted && !locks.busy) otherTab();
    };
    expect(tab.dispatch({ type: "inbox/read", id: state.inbox[0].id })).toBe(true);
    await tab.withBookingLock(() => true);
    if (!otherCommitted) await locks.request("other", otherTab);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.waitlistOffers).toHaveLength(1);
    expect(saved.inbox.find((i) => i.id === state.inbox[0].id)?.read).toBe(true);
  });

  it("shows a gift card sold outside the lock at once, and reports the one its commit saved", async () => {
    const offered = reduce(setup(), cancel, now);
    const storage = { raw: JSON.stringify(offered) };
    const tab = await openTab(storage);
    const sale = { type: "giftcard/sell", amount: 500, recipient: "Fictional Friend", message: "", date: day } as const;
    // A page reading the new card right after a plain dispatch sees it, even while an offer is out.
    expect(tab.dispatch(sale)).toBe(true);
    expect(tab.currentState()?.giftCards.at(-1)?.recipient).toBe("Fictional Friend");
    await tab.withBookingLock(() => true);
    // Another tab sells a card first; the committed result names this sale's card, not theirs.
    const other = reduce(JSON.parse(storage.raw) as DemoState, { ...sale, recipient: "Other Tab" }, now);
    storage.raw = JSON.stringify(other);
    const result = await tab.dispatchCommitted({ ...sale, recipient: "Second Friend" });
    if (!result.ok) throw new Error("expected the sale to commit");
    expect(result.state.giftCards.at(-1)?.recipient).toBe("Second Friend");
    expect(result.state.giftCards.map((c) => c.recipient)).toEqual(["Fictional Friend", "Other Tab", "Second Friend"]);
    expect(new Set(result.state.giftCards.map((c) => c.code)).size).toBe(3);
  });

  it("undoes this tab's own change even when another tab's commit took the preview's entry id", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    const price = state.services[0].price;
    const op = tab.dispatchWithLog({ type: "service/price", id: serviceId, price: price + 100 });
    expect(op).toMatch(/^op-/);
    // Before this tab gets the lock, another tab commits an unrelated logged change from the same starting point.
    const other = applyAction(state, { type: "cost/add", kind: "rent", label: "Fictional rent", amount: 1000 }, { actor: "owner", source: "button", at: now });
    storage.raw = JSON.stringify(other);
    await tab.withBookingLock(() => true);
    expect(await tab.withBookingLock(() => tab.dispatch({ type: "log/undo", id: op as string }))).toBe(true);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.services[0].price).toBe(price);
    expect(saved.costs.some((c) => c.label === "Fictional rent")).toBe(true);
  });

  it("tells the server an assistant's proposal was approved only once it is saved here", async () => {
    const state = setup();
    const storage: { raw: string; race?: { afterReads: number; write: () => void } } = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    const { decideProposal } = await import("@/concept/studio/inbox/agent-proposals");
    tab.currentState();
    const posted: string[] = [];
    const post = (async (_url: string, init?: RequestInit) => { posted.push(JSON.parse(String(init?.body)).decision); return new Response(null); }) as typeof fetch;
    const proposal = { id: "p-1", tool: "propose_move", client: "agent", createdAt: now, status: "pending", title: "Move", rows: [], toast: "Moved",
      action: { type: "booking/move", id: "visit", date, start: 840 } } as unknown as import("@/concept/tools/agent-proposal").AgentProposal;
    // While it is being saved, another tab books 14:00 for someone else: the move cannot be made after all.
    storage.race = { afterReads: 1, write: () => {
      storage.raw = JSON.stringify({ ...state, seq: state.seq + 1, bookings: [...state.bookings, { ...state.bookings[0], id: "other", customerId: "other", start: 840 }] });
    } };
    expect(await decideProposal(proposal, true, post)).toBe(false);
    expect(posted).toEqual(["failed"]);
    expect(tab.currentState()?.bookings.find((b) => b.id === "visit")?.start).toBe(600);
    const fine = { ...proposal, id: "p-2", action: { type: "booking/move", id: "visit", date, start: 900 } } as typeof proposal;
    expect(await decideProposal(fine, true, post)).toBeTruthy();
    expect(posted).toEqual(["failed", "approved"]);
  });

  it("writes back an erasure of the other salon under that salon's own lock", async () => {
    // The own salon (stored beside the demo) has a customer whose 30 days in the trash are over.
    const own = { ...salon, customers: [{ id: "k-gone", firstName: "Fictional", lastName: "Gone", phone: "0701234500", email: "", category: salon.services[0].category, preferredStaff: alex, since: day, isRegular: false, tags: [], waitlist: false }] };
    const trashed = { ...own, ...deleteCustomer({ ...own, generatedFor: "2026-10-01" }, "k-gone"), generatedFor: "2026-10-01" };
    const ownKey = `${KEY}-own`;
    const others = new Map([[ownKey, JSON.stringify(trashed)]]);
    const writes: { key: string; lock?: string }[] = [];
    const tab = await openTab({ raw: JSON.stringify(createDemoState(day)), others, writes });
    const stop = tab.subscribeStore(() => undefined);
    try {
      // Another tab changed the own salon: this tab reads it while the demo salon is open.
      const changed = { ...trashed, seq: trashed.seq + 1 };
      others.set(ownKey, JSON.stringify(changed));
      window.dispatchEvent(Object.assign(new Event("storage"), { storageArea: window.localStorage, key: ownKey }));
      await tab.withBookingLock(() => true);
      await locks.request("flush", () => undefined);
      const erased = JSON.parse(others.get(ownKey)!) as DemoState;
      expect(erased.trash.some((entry) => entry.kind === "customer")).toBe(false);
      expect(writes.filter((w) => w.key === ownKey).map((w) => w.lock)).toEqual([ownKey]);
    } finally {
      stop();
    }
  });

  it("gives a record the same id in the preview and its commit, so a follow-up edit finds only this tab's record", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    const draft = (name: string) => ({ name, category: state.categories[0].id, duration: 60, price: 500, description: "", staffIds: [alex] });
    expect(tab.dispatch({ type: "service/add", service: draft("Ours") })).toBe(true);
    const previewed = tab.currentState()!.services.at(-1)!;
    expect(previewed.name).toBe("Ours");
    // Another tab adds a treatment first, from the same starting point.
    storage.raw = JSON.stringify(applyAction(state, { type: "service/add", service: draft("Theirs") }, { actor: "owner", source: "button", at: now }));
    // The owner edits the treatment they just added, before its commit.
    expect(tab.dispatch({ type: "service/price", id: previewed.id, price: 999 })).toBe(true);
    await tab.withBookingLock(() => true);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.services.find((s) => s.name === "Ours")).toMatchObject({ id: previewed.id, price: 999 });
    expect(saved.services.find((s) => s.name === "Theirs")?.price).toBe(500);
    // The activity list's entry id works for Undo too: it is the same in the preview and the commit.
    expect(saved.log.some((e) => e.type === "service/add" && tab.currentState()!.log.some((shown) => shown.id === e.id))).toBe(true);
  });

  it("marks an assistant card approved only once its change is saved", async () => {
    const state = setup();
    const storage: { raw: string; race?: { afterReads: number; write: () => void } } = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    const thread = await import("@/concept/studio/assistant/thread-store");
    const actions = await import("@/concept/studio/assistant/reply-actions");
    tab.currentState();
    const card = { kind: "change" as const, title: "Move", rows: [], toast: "Moved", action: { type: "booking/move" as const, id: "visit", date, start: 840 } };
    thread.addMessages([
      { id: "q-1", from: "owner", text: "move the visit", at: 1 },
      { id: "r-1", from: "assistant", text: "Move", reply: { source: "rules", text: "Move", card, request: "move the visit", input: "typed" }, at: 1 },
    ], { customerIds: [], date: day });
    // While it is being saved, another tab books 14:00 for someone else.
    storage.race = { afterReads: 1, write: () => {
      storage.raw = JSON.stringify({ ...state, seq: state.seq + 1, bookings: [...state.bookings, { ...state.bookings[0], id: "other", customerId: "other", start: 840 }] });
    } };
    expect(await actions.approveReply("r-1", card.action)).toBe(false);
    expect(thread.replyOf("r-1")).toMatchObject({ status: "failed" });
  });

  it("keeps a change shown just before the page went away, and commits it on the next page in the tab", async () => {
    const state = setup();
    const others = new Map<string, string>();
    const storage = { raw: JSON.stringify(state), others };
    // The first page never gets the lock: it is gone before its commit runs.
    locks = { request: () => new Promise(() => undefined) } as unknown as ReturnType<typeof sharedLocks>;
    const leaving = await openTab(storage);
    expect(leaving.dispatch({ type: "service/price", id: serviceId, price: 777 })).toBe(true);
    expect((JSON.parse(storage.raw) as DemoState).services[0].price).toBe(state.services[0].price);
    expect([...others.keys()].some((key) => key.includes("-journal-"))).toBe(true);
    locks = sharedLocks();
    const next = await openTab(storage);
    next.currentState();
    await Promise.resolve();
    expect(next.currentState()?.services[0].price).toBe(777);
    await next.withBookingLock(() => true);
    expect((JSON.parse(storage.raw) as DemoState).services[0].price).toBe(777);
    expect([...others.keys()].some((key) => key.includes("-journal-"))).toBe(false);
  });

  it("does not apply a journaled change twice when its commit was already saved", async () => {
    const state = setup();
    const others = new Map<string, string>();
    const storage = { raw: JSON.stringify(state), others };
    const tab = await openTab(storage);
    const draft = { name: "Journaled", category: state.categories[0].id, duration: 60, price: 500, description: "", staffIds: [alex] };
    expect(tab.dispatch({ type: "service/add", service: draft })).toBe(true);
    const journal = [...others.entries()].find(([key]) => key.includes("-journal-"))!;
    await tab.withBookingLock(() => true);
    // The page went away after the save but before the journal was cleared.
    others.set(journal[0], journal[1]);
    const next = await openTab(storage);
    await next.withBookingLock(() => true);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.services.filter((s) => s.name === "Journaled")).toHaveLength(1);
    expect(next.currentState()?.services.filter((s) => s.name === "Journaled")).toHaveLength(1);
    expect(others.has(journal[0])).toBe(false);
  });

  /** A page that shows a change and is gone before its commit gets the lock. */
  async function leaveWithChange(storage: { raw: string; others: Map<string, string> }, action: DemoAction) {
    locks = { request: () => new Promise(() => undefined) } as unknown as ReturnType<typeof sharedLocks>;
    const leaving = await openTab(storage);
    expect(leaving.dispatch(action)).toBe(true);
    locks = sharedLocks();
    return [...storage.others.keys()].find((key) => key.includes("-journal-"))!;
  }

  /** The next page in the same tab, after its journal recovery and commits have run. */
  async function nextPage(storage: { raw: string; others: Map<string, string> }) {
    const next = await openTab(storage);
    let failures = 0;
    (window as unknown as EventTarget).addEventListener("concept-deferred-write-failed", () => failures++);
    next.currentState();
    await Promise.resolve();
    await next.withBookingLock(() => true);
    await Promise.resolve();
    return { next, failures: () => failures };
  }

  it("never replays a change shown in a salon that was replaced before the next page", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state), others: new Map<string, string>() };
    const journal = await leaveWithChange(storage, { type: "service/price", id: serviceId, price: 777 });
    // Another tab replaced the sample business (a fictional new one with the same records) before this tab came back.
    const replaced = { ...state, seq: state.seq + 1, generation: "replaced" };
    storage.raw = JSON.stringify(replaced);
    const { next, failures } = await nextPage(storage);
    expect(next.currentState()?.services[0].price).toBe(state.services[0].price);
    // Not even tried: that salon is gone, so there is nothing to report as unsaved.
    expect(failures()).toBe(0);
    expect(JSON.parse(storage.raw)).toEqual(JSON.parse(JSON.stringify(replaced)));
    expect(storage.others.has(journal)).toBe(false);
  });

  it("refuses the commit of a change whose salon was replaced while it waited for the lock", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    expect(tab.dispatch({ type: "service/price", id: serviceId, price: 777 })).toBe(true);
    const replaced = { ...state, seq: state.seq + 1, generation: "replaced" };
    storage.raw = JSON.stringify(replaced);
    await tab.withBookingLock(() => true);
    expect(JSON.parse(storage.raw)).toEqual(JSON.parse(JSON.stringify(replaced)));
  });

  it("takes every tab's unsaved changes along when the sample business is replaced", async () => {
    // The sample salon (no industry of its own) is the one a new sample business replaces.
    const storage = { raw: JSON.stringify({ ...setup(), industry: null }), others: new Map<string, string>() };
    const journal = await leaveWithChange(storage, { type: "service/price", id: serviceId, price: 777 });
    // Another browser tab (its own session) chooses a new sample business.
    const other = await openTab(storage, true, new Map());
    await other.startBusiness();
    expect(storage.others.has(journal)).toBe(false);
    const { next } = await nextPage(storage);
    expect(next.currentState()?.services.some((s) => s.price === 777)).toBe(false);
  });

  it("takes the trial salon's unsaved changes along when it is deleted, and starts a new trial without them", async () => {
    // The trial salon is the first one this browser saved, so its key is the original one.
    const others = new Map<string, string>([[`${KEY}-journal-gone`, JSON.stringify([{ op: "op-gone-1", action: { type: "service/price", id: serviceId, price: 777 }, meta: {}, generation: "trial-1", at: now }])]]);
    const tab = await openTab({ raw: JSON.stringify(setup()), others });
    tab.deleteTrialSalon();
    expect(others.has(`${KEY}-journal-gone`)).toBe(false);
    others.set(`${KEY}-journal-gone`, "[]");
    expect(await tab.switchSalon("own", { ...salonDraft("en"), name: "Studio Trial", people: ["Alex Demo"] })).toBe(true);
    expect(others.has(`${KEY}-journal-gone`)).toBe(false);
    expect(tab.currentState()?.generation).toMatch(/.+/);
    expect(tab.currentState()?.generation).not.toBe("trial-1");
  });

  it("retires a left-behind change that can no longer be made, and reports it once", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state), others: new Map<string, string>() };
    const journal = await leaveWithChange(storage, { type: "booking/move", id: "visit", date, start: 840 });
    // Before the next page, another tab deleted the visit.
    storage.raw = JSON.stringify({ ...state, seq: state.seq + 1, bookings: [] });
    const { next, failures } = await nextPage(storage);
    expect(failures()).toBe(1);
    expect(storage.others.has(journal)).toBe(false);
    expect(next.currentState()?.bookings).toEqual([]);
  });

  it("keeps a receipt with the saved change, so a change the log does not record is never applied twice", async () => {
    const state = setup();
    state.inbox = state.inbox.map((item) => ({ ...item, read: false }));
    const others = new Map<string, string>();
    const storage = { raw: JSON.stringify(state), others };
    const tab = await openTab(storage);
    expect(tab.dispatch({ type: "inbox/read-all" })).toBe(true);
    const journal = [...others.entries()].find(([key]) => key.includes("-journal-"))!;
    await tab.withBookingLock(() => true);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.receipts?.map((r) => r.op)).toEqual([JSON.parse(journal[1])[0].op]);
    // The page went away after the save but before the journal was cleared; then a new message arrived.
    others.set(journal[0], journal[1]);
    const message = { ...state.inbox[0], id: "fresh", read: false };
    storage.raw = JSON.stringify({ ...saved, seq: saved.seq + 1, inbox: [message, ...saved.inbox] });
    const { next } = await nextPage(storage);
    expect(next.currentState()?.inbox.find((item) => item.id === "fresh")?.read).toBe(false);
    expect(others.has(journal[0])).toBe(false);
    // Once no journal holds it, the next save lets the receipt go.
    expect(next.dispatch({ type: "service/price", id: serviceId, price: 777 })).toBe(true);
    await next.withBookingLock(() => true);
    expect((JSON.parse(storage.raw) as DemoState).receipts?.map((r) => r.op)).not.toContain(JSON.parse(journal[1])[0].op);
  });

  it("never replays a change left behind more than a week ago", async () => {
    const storage = { raw: JSON.stringify(setup()), others: new Map<string, string>() };
    const journal = await leaveWithChange(storage, { type: "service/price", id: serviceId, price: 777 });
    const later = now + 8 * 24 * 60 * 60_000;
    vi.setSystemTime(later);
    // The trial salon was in use meanwhile, in another browser tab.
    storage.others.set(`${KEY}-last-used`, String(later));
    await nextPage(storage);
    expect(storage.raw).not.toBeNull();
    expect(storage.others.has(journal)).toBe(false);
    expect((JSON.parse(storage.raw) as DemoState).services[0].price).not.toBe(777);
  });

  it("neither sends nor books personal offers in a browser without a cross-tab lock", async () => {
    const storage = { raw: JSON.stringify(setup()) };
    const tab = await openTab(storage, false);
    const { demoOutbox: outbox } = await import("@/concept/connections/demo");
    outbox.clear();
    expect(tab.hasCrossTabLock()).toBe(false);
    expect(await tab.withBookingLock(() => tab.dispatch(cancel))).toBe(true);
    expect(await tab.withBookingLock(() => tab.dispatch(tick))).toBe(false);
    expect((JSON.parse(storage.raw) as DemoState).waitlistOffers).toEqual([]);
    expect(outbox.list("sms")).toEqual([]);
    const offered = reduce(setup(), cancel, now);
    const other = await openTab({ raw: JSON.stringify(offered) }, false);
    const claimAction = { type: "online/claim", id: offered.waitlistOffers[0].id, terms: shownTerms(offered, offered.waitlistOffers[0].id), notice } as const;
    expect(await other.withBookingLock(() => other.dispatch(claimAction))).toBe(false);
    expect(other.currentState()?.waitlistOffers[0].status).toBe("offered");
  });

  it("never writes an older snapshot over a claim another tab saved meanwhile", async () => {
    const offered = reduce(setup(), cancel, now);
    const claimed = claim(offered, offered.waitlistOffers[0].id);
    const storage: { raw: string; race?: { afterReads: number; write: () => void } } = { raw: JSON.stringify(offered) };
    const tab = await openTab(storage);
    tab.currentState();
    // The other tab books the offer while this one prepares an unrelated change outside the lock.
    storage.race = { afterReads: 1, write: () => { storage.raw = JSON.stringify(claimed); } };
    // With an offer out, a write outside the lock waits for it rather than racing the other tab.
    expect(tab.dispatch({ type: "inbox/read", id: offered.inbox.at(-1)!.id })).toBe(true);
    expect((JSON.parse(storage.raw) as DemoState).inbox.at(-1)!.read).toBe(offered.inbox.at(-1)!.read);
    await tab.withBookingLock(() => true);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.inbox.find((i) => i.id === offered.inbox.at(-1)!.id)!.read).toBe(true);
    expect(saved.waitlistOffers[0].status).toBe("claimed");
    expect(saved.bookings).toEqual(claimed.bookings);
  });

  it("confirms a customer's waiting-list request only once it is saved, also while another offer is out", async () => {
    const offered = reduce(setup(), cancel, now);
    const request: DemoAction = { type: "online/waitlist", serviceId, days: [date], notice,
      guest: { name: "Demo Guest 7", phone: "0701234567", at: { date: day, time: 600 } } };
    const storage = { raw: JSON.stringify(offered), full: true };
    const tab = await openTab(storage);
    // A plain dispatch only queues the request behind the lock; the confirmed form waits for the save.
    expect(await tab.dispatchConfirmed(request)).toBe(false);
    expect((JSON.parse(storage.raw) as DemoState).waitlistEntries).toHaveLength(offered.waitlistEntries.length);
    storage.full = false;
    expect(await tab.dispatchConfirmed(request)).toBe(true);
    const saved = JSON.parse(storage.raw) as DemoState;
    expect(saved.waitlistEntries).toHaveLength(offered.waitlistEntries.length + 1);
    expect(saved.customers.some((c) => c.phone === "0701234567")).toBe(true);
  });

  it("reports a write that waited for the lock and was then refused, and shows what was saved again", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state) };
    const tab = await openTab(storage);
    let failures = 0;
    (window as unknown as EventTarget).addEventListener("concept-deferred-write-failed", () => failures++);
    expect(tab.dispatch({ type: "booking/move", id: "visit", date, start: 840 })).toBe(true);
    expect(tab.currentState()?.bookings[0].start).toBe(840);
    // Before the lock comes round, another tab books 14:00 for someone else: the move can no longer be made.
    const taken = { ...state, seq: state.seq + 1, bookings: [...state.bookings, { ...state.bookings[0], id: "other", customerId: "other", start: 840 }] };
    storage.raw = JSON.stringify(taken);
    await tab.withBookingLock(() => true);
    await Promise.resolve();
    expect(failures).toBe(1);
    expect(tab.currentState()?.bookings.find((b) => b.id === "visit")?.start).toBe(600);
    expect(JSON.parse(storage.raw)).toEqual(JSON.parse(JSON.stringify(taken)));
  });

  it("does not report the add-on switched off unless that is saved", async () => {
    const storage = { raw: JSON.stringify(setup()), full: true };
    const tab = await openTab(storage);
    expect(await tab.withBookingLock(() => tab.dispatch({ type: "module/toggle", key: "waitlist" }))).toBe(false);
    expect(tab.currentState()?.modules.waitlist).toBe(true);
  });

  it("refuses queue decisions it cannot save", async () => {
    const state = setup();
    state.cancellationPolicy = { ...state.cancellationPolicy, deposits: { [serviceId]: 15000 } };
    const held = claim(reduce(state, cancel, now), reduce(state, cancel, now).waitlistOffers[0].id);
    const storage = { raw: JSON.stringify(held), full: true };
    const tab = await openTab(storage);
    const release = { type: "online/release", id: held.checkoutHolds[0].id } as const;
    expect(await tab.withBookingLock(() => tab.dispatch(release))).toBe(false);
    expect(await tab.withBookingLock(() => tab.dispatch({ type: "waitlist/rules", rules: { paused: true } }))).toBe(false);
    expect(tab.currentState()?.waitlistRules.paused).toBe(false);
    expect(tab.currentState()?.checkoutHolds).toHaveLength(1);
  });

  it("confirms a withdrawal only once it is saved", async () => {
    const offered = reduce(setup(), cancel, now);
    const entry = offered.waitlistEntries.at(-1)!;
    const storage = { raw: JSON.stringify(offered), full: true };
    const tab = await openTab(storage);
    expect(await tab.withBookingLock(() => tab.dispatch({ type: "online/leave", id: entry.id }))).toBe(false);
    expect(tab.currentState()?.waitlistEntries.map((e) => e.id)).toContain(entry.id);
    storage.full = false;
    expect(await tab.withBookingLock(() => tab.dispatch({ type: "online/leave", id: entry.id }))).toBe(true);
    expect((JSON.parse(storage.raw) as DemoState).waitlistEntries.map((e) => e.id)).not.toContain(entry.id);
  });

  it("backs off instead of retrying a failed handover at once", async () => {
    const offered = reduce(setup(), cancel, now);
    let attempts = 0;
    const storage = { raw: JSON.stringify(offered), full: true, onFull: () => attempts++ };
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(offered.waitlistOffers[0].expiresAt + 1);
    const tab = await openTab(storage);
    const stop = tab.subscribeStore(() => undefined);
    try {
      for (let i = 0; i < 50; i++) await vi.advanceTimersByTimeAsync(100);
      expect(attempts).toBeGreaterThan(0);
      expect(attempts).toBeLessThanOrEqual(2);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(attempts).toBeLessThanOrEqual(4);
    } finally {
      stop();
    }
  });

  it("keeps a visitor's request for the salon's current day when the browser is already on the next day", async () => {
    const zone = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
    try {
      // 01:30 on Friday in Tokyo is still 17:30 on Thursday in Stockholm.
      vi.setSystemTime(Date.parse(`${day}T17:30:00+01:00`));
      const sample = createDemoState(day);
      const request = { id: "wait-visitor", customerId: sample.customers[0].id, serviceId: sample.services[0].id, days: [day], window: { start: 0, end: 1440 }, joinedAt: now };
      const kept = (await openTab({ raw: JSON.stringify({ ...sample, waitlistEntries: [request] }) })).currentState()!;
      expect(kept.waitlistEntries.map((e) => e.id)).toContain("wait-visitor");
    } finally {
      process.env.TZ = zone;
    }
  });

  it("retries a first offer that could not be saved, soon after storage recovers", async () => {
    const freed = withOffersHeld(true, () => reduce(setup(), cancel, now));
    expect(freed.waitlistGaps).toHaveLength(1);
    expect(freed.waitlistOffers).toEqual([]);
    const storage = { raw: JSON.stringify(freed), full: true };
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(now);
    const tab = await openTab(storage);
    const stop = tab.subscribeStore(() => undefined);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect((JSON.parse(storage.raw) as DemoState).waitlistOffers).toEqual([]);
      storage.full = false;
      await vi.advanceTimersByTimeAsync(60_000);
      expect((JSON.parse(storage.raw) as DemoState).waitlistOffers).toHaveLength(1);
    } finally {
      stop();
    }
  });

  it("backs off when the lock itself is refused", async () => {
    const offered = reduce(setup(), cancel, now);
    let requests = 0;
    locks = { request: () => { requests++; return Promise.reject(new Error("denied")); } } as unknown as ReturnType<typeof sharedLocks>;
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(offered.waitlistOffers[0].expiresAt + 1);
    const tab = await openTab({ raw: JSON.stringify(offered) });
    const stop = tab.subscribeStore(() => undefined);
    try {
      for (let i = 0; i < 50; i++) await vi.advanceTimersByTimeAsync(100);
      expect(requests).toBeGreaterThan(0);
      expect(requests).toBeLessThanOrEqual(2);
    } finally {
      stop();
    }
  });

  it("sends no personal offer that it cannot save", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state), full: true };
    const tab = await openTab(storage);
    const { demoOutbox: outbox } = await import("@/concept/connections/demo");
    outbox.clear();
    expect(await tab.withBookingLock(() => tab.dispatch(cancel))).toBe(false);
    expect(outbox.list()).toEqual([]);
    expect(tab.currentState()?.waitlistOffers).toEqual([]);
    expect(tab.currentState()?.bookings).toEqual(state.bookings);
  });

  it("refuses a claim it cannot save, and books a contested offer once", async () => {
    const offered = reduce(setup(), cancel, now);
    const action = { type: "online/claim", id: offered.waitlistOffers[0].id, terms: shownTerms(offered, offered.waitlistOffers[0].id), notice } as const;
    const storage = { raw: JSON.stringify(offered), full: true };
    const first = await openTab(storage);
    expect(await first.withBookingLock(() => first.dispatch(action))).toBe(false);
    expect(first.currentState()?.bookings).toEqual(offered.bookings);
    storage.full = false;
    const second = await openTab(storage);
    const both = await Promise.all([first, second].map((tab) => tab.withBookingLock(() => tab.dispatch(action))));
    expect(both).toEqual([true, false]);
    expect((JSON.parse(storage.raw) as DemoState).bookings.filter((b) => b.status === "booked")).toHaveLength(1);
  });
});
