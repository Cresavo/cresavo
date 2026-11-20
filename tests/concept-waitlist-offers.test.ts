import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reduce, type DemoAction } from "@/concept/actions";
import { manualGaps, nextMatch, nextSmsTime, nextWaitlistWake, queueOrder, validPreferences } from "@/concept/booking/waitlist-match";
import type { WaitlistGap } from "@/concept/booking/waitlist-types";
import { demoOutbox } from "@/concept/connections/demo";
import { isFree, needOf, withSlotClock } from "@/concept/data/slots";
import type { Booking, DemoState } from "@/concept/data/types";
import { applyAction, defaultMeta } from "@/concept/log/capture";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { createDemoState } from "@/concept/data/generate";
import { isNewBookingCustomer } from "@/concept/booking/lookup";
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
  const phone = state.customers.find((c) => c.id === offer.customerId)!.phone;
  return quote(state.cancellationPolicy, service, state.localization.currency, isNewBookingCustomer(state, phone));
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
    expect(moved.waitlistGaps).toMatchObject([{ date, start: 600, end: 660 }]);
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

  it("lapses an offer when its room or chair no longer suits the treatment", () => {
    const initial = setup();
    initial.resources = [{ id: "room-a", name: "Room A", kind: "room" }, { id: "room-b", name: "Room B", kind: "room" }];
    initial.services = [{ ...initial.services[0], resourceIds: ["room-a"] }];
    const offered = reduce(initial, cancel, now);
    expect(offered.waitlistOffers[0]).toMatchObject({ status: "offered", resourceId: "room-a" });
    const moved = reduce(offered, { type: "service/resources", id: serviceId, resourceIds: ["room-b"] }, now + 1);
    expect(moved.waitlistOffers[0].status).toBe("lapsed");
  });

  it("keeps a gap held by quiet hours when part of it still starts after 08:00", () => {
    const early = setup();
    early.salon = { ...early.salon, hours: { ...early.salon.hours, 5: { open: 420, close: 1020 } } };
    early.staff = early.staff.map((s) => ({ ...s, week: { ...s.week, 5: { start: 420, end: 1020 } } }));
    early.bookings = [{ ...early.bookings[0], start: 420, duration: 150 }];
    const evening = Date.parse(`${day}T21:00:00+01:00`);
    const queued = reduce(early, cancel, evening);
    expect(queued.waitlistGaps).toMatchObject([{ start: 420, end: 570, readyAt: Date.parse(`${date}T08:00:00+01:00`) }]);
    const morning = reduce(queued, tick, Date.parse(`${date}T08:00:00+01:00`));
    expect(morning.waitlistOffers[0].start).toBeGreaterThan(480);
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

  /** A fresh copy of the store module over one shared, fictional localStorage. */
  async function openTab(storage: { raw: string; full?: boolean; race?: { afterReads: number; write: () => void } }) {
    const others = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => {
        if (key !== KEY) return others.get(key) ?? null;
        if (storage.race && storage.race.afterReads-- === 0) {
          storage.race.write();
          storage.race = undefined;
        }
        return storage.raw;
      },
      setItem: (key: string, value: string) => {
        if (key !== KEY) return void others.set(key, value);
        if (storage.full) throw new Error("quota");
        storage.raw = value;
      },
      removeItem: (key: string) => void others.delete(key),
    };
    vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage: localStorage }));
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
    expect(tab.dispatch(cancel)).toBe(true);
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
    const live = { ...sample, waitlistOffers: [offer] };
    const kept = (await openTab({ raw: JSON.stringify(live) })).currentState()!;
    expect(kept.waitlistOffers).toHaveLength(1);
    expect(kept.bookings).toEqual(sample.bookings);
  });

  it("sends no personal offer that it cannot save", async () => {
    const state = setup();
    const storage = { raw: JSON.stringify(state), full: true };
    const tab = await openTab(storage);
    const { demoOutbox: outbox } = await import("@/concept/connections/demo");
    outbox.clear();
    expect(tab.dispatch(cancel)).toBe(false);
    expect(outbox.list()).toEqual([]);
    expect(tab.currentState()?.waitlistOffers).toEqual([]);
    expect(tab.currentState()?.bookings).toEqual(state.bookings);
  });

  it("refuses a claim it cannot save, and books a contested offer once", async () => {
    const offered = reduce(setup(), cancel, now);
    const action = { type: "online/claim", id: offered.waitlistOffers[0].id, terms: shownTerms(offered, offered.waitlistOffers[0].id), notice } as const;
    const storage = { raw: JSON.stringify(offered), full: true };
    const first = await openTab(storage);
    expect(first.dispatch(action)).toBe(false);
    expect(first.currentState()?.bookings).toEqual(offered.bookings);
    storage.full = false;
    const second = await openTab(storage);
    expect([first.dispatch(action), second.dispatch(action)]).toEqual([true, false]);
    expect((JSON.parse(storage.raw) as DemoState).bookings.filter((b) => b.status === "booked")).toHaveLength(1);
  });
});
