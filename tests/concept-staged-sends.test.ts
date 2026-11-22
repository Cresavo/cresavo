import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";

// The browser store stages every simulated send (payments, SMS, email, posts)
// and publishes it only after its save; the Inbox and Today offers to the
// waiting list are sent only when their inbox note is saved. Fictional data only.

const { showToast, showActionFailure } = vi.hoisted(() => ({ showToast: vi.fn(), showActionFailure: vi.fn() }));
vi.mock("@/concept/ui/toast", () => ({ showToast, showActionFailure }));

// A fixed Tuesday: the demo salon is closed on Sundays, when "today's free times" would be empty.
const NOW = new Date("2026-11-17T09:00:00+01:00");
const today = toKey(NOW);

/** One tab's localStorage, with a hook that runs before each save. */
function tab(initial: DemoState) {
  const items = new Map([["salong-eko-demo", JSON.stringify(initial)]]);
  const hooks = { beforeSave: undefined as (() => void) | undefined };
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { hooks.beforeSave?.(); items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  const saved = () => JSON.parse(items.get("salong-eko-demo")!) as DemoState;
  /** Another tab's write, straight to storage. */
  const write = (state: DemoState) => items.set("salong-eko-demo", JSON.stringify(state));
  return { hooks, saved, write };
}

async function modules() {
  const store = await import("@/concept/store");
  const { demoOutbox, demoSentMessages } = await import("@/concept/connections/demo");
  const offers = await import("@/concept/studio/booking/offer-waitlist");
  const { textWaitlistAboutGaps } = await import("@/concept/booking/waitlist-offer");
  const { tc } = await import("@/concept/i18n");
  const sms = () => demoSentMessages("demo").list("sms");
  return { ...store, ...offers, demoOutbox, demoSentMessages, textWaitlistAboutGaps, sms, tc };
}

function salon(): DemoState {
  const base = createDemoState(today);
  return {
    ...base,
    modules: { ...base.modules, waitlist: true },
    customers: base.customers.map((customer, i) => (i < 3 ? { ...customer, waitlist: true } : customer)),
  };
}

/** A visit ahead with no reminder sent yet. */
const upcoming = (state: DemoState) => state.bookings.find((b) => b.status === "booked" && b.date > today)!;
const remind = (state: DemoState) => ({ type: "booking-message/send" as const, bookingId: upcoming(state).id, channel: "sms" as const, kind: "reminder" as const, at: { date: today, time: 0 } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.resetModules();
  showToast.mockClear();
  showActionFailure.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("publishes a change's message exactly once, and only after the save", async () => {
  const state = salon();
  const storage = tab(state);
  const { dispatch, sms } = await modules();
  let seenAtSave = -1;
  storage.hooks.beforeSave = () => { seenAtSave = sms().length; };
  expect(dispatch(remind(state))).toBe(true);
  expect(seenAtSave).toBe(0);
  expect(sms()).toHaveLength(1);
  expect(storage.saved().inbox[0].delivery).toMatchObject({ kind: "reminder", channel: "sms" });
  // Sending the same reminder again changes nothing and sends nothing.
  expect(dispatch(remind(state))).toBe(false);
  expect(sms()).toHaveLength(1);
});

it("sends nothing from an attempt discarded because another tab saved first", async () => {
  const state = salon();
  const storage = tab(state);
  const { dispatchWithLog, sms } = await modules();
  let first = true;
  // The guard runs before each attempt; the first time, another tab renames the salon meanwhile.
  const guard = () => {
    if (first) storage.write({ ...storage.saved(), salon: { ...state.salon, name: "Salong Eko Nord" } });
    first = false;
    return true;
  };
  expect(dispatchWithLog(remind(state), undefined, guard)).not.toBe(false);
  expect(sms()).toHaveLength(1);
  expect(sms()[0].body).toContain("Salong Eko Nord");
  expect(storage.saved().salon.name).toBe("Salong Eko Nord");
});

it("sends nothing when the change is refused after its reducer ran", async () => {
  const state = salon();
  const storage = tab(state);
  const { dispatchWithLog, sms } = await modules();
  expect(dispatchWithLog(remind(state), undefined, undefined, { send: () => false })).toBe(false);
  expect(sms()).toEqual([]);
  expect(storage.saved().inbox).toEqual(state.inbox);
});

it("offers a freed slot to the waiting list only together with its saved inbox note", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerSlotToWaitlist, sms } = await modules();
  const booking = upcoming(state);
  expect(offerSlotToWaitlist(booking, { today, minutes: 600 })).toBe(true);
  expect(sms().map((record) => record.reference)).toEqual([`waitlist-${booking.id}-${booking.date}-${booking.start}`]);
  expect(storage.saved().inbox[0]).toMatchObject({ waitlistOffer: true });
});

it("sends no slot offer when the save is refused: another tab switched the waiting list off", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerSlotToWaitlist, sms } = await modules();
  storage.write({ ...state, modules: { ...state.modules, waitlist: false } });
  expect(offerSlotToWaitlist(upcoming(state), { today, minutes: 600 })).toBe(false);
  expect(sms()).toEqual([]);
  expect(storage.saved().inbox).toEqual(state.inbox);
});

it("sends no slot offer once another tab has moved the visit", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerSlotToWaitlist, sms } = await modules();
  const booking = upcoming(state);
  storage.write({ ...state, bookings: state.bookings.map((b) => (b.id === booking.id ? { ...b, start: b.start + 60 } : b)) });
  expect(offerSlotToWaitlist(booking, { today, minutes: 600 })).toBe(false);
  expect(sms()).toEqual([]);
  expect(storage.saved().inbox).toEqual(state.inbox);
});

it("sends no slot offer once another booking has taken the freed time", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerSlotToWaitlist, sms } = await modules();
  const visit = upcoming(state);
  const cancelled = { ...visit, status: "cancelled" as const };
  const other = state.customers.find((customer) => customer.id !== visit.customerId)!;
  // The Inbox shows the cancellation; another tab has booked someone into that time since.
  storage.write({ ...state, bookings: [...state.bookings.map((b) => (b.id === visit.id ? cancelled : b)), { ...visit, id: "b-taken", customerId: other.id }] });
  expect(offerSlotToWaitlist(cancelled, { today, minutes: 600 })).toBe(false);
  expect(sms()).toEqual([]);
  expect(storage.saved().inbox).toEqual(state.inbox);
  // With the time free again, the same offer goes out.
  storage.write({ ...state, bookings: state.bookings.map((b) => (b.id === visit.id ? cancelled : b)) });
  expect(offerSlotToWaitlist(cancelled, { today, minutes: 600 })).toBe(true);
  expect(sms()).toHaveLength(1);
});

it("sends no free-times text once nobody is waiting", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerGapsToWaitlist, sms } = await modules();
  storage.write({ ...state, customers: state.customers.map((customer) => ({ ...customer, waitlist: false })) });
  expect(offerGapsToWaitlist({ today, minutes: 0 })).toBe(false);
  expect(sms()).toEqual([]);
  expect(storage.saved().inbox).toEqual(state.inbox);
});

it("reports only sends the sink accepted: a repeated id within one salon is no new effect", async () => {
  const state = salon();
  tab(state);
  const { dispatchWithLog, textWaitlistAboutGaps, sms } = await modules();
  const reported: string[][] = [];
  const note = { type: "inbox/add" as const, item: { kind: "system" as const, date: today, time: 0, title: "Free times", body: "Texted", read: false, handled: true } };
  const options = { send: (current: DemoState) => textWaitlistAboutGaps(current, today), committed: (sent: { id: string }[]) => { reported.push(sent.map((entry) => entry.id)); } };
  expect(dispatchWithLog(note, undefined, undefined, options)).not.toBe(false);
  expect(dispatchWithLog(note, undefined, undefined, options)).not.toBe(false);
  expect(sms()).toHaveLength(1);
  expect(reported).toEqual([[sms()[0].id], []]);
});

it("starts a replacement sample business with fresh message records and keys", async () => {
  const state = salon();
  tab(state);
  const { dispatchWithLog, startBusiness, demoSentMessages, textWaitlistAboutGaps } = await modules();
  const reported: number[] = [];
  const note = { type: "inbox/add" as const, item: { kind: "system" as const, date: today, time: 0, title: "Free times", body: "Texted", read: false, handled: true } };
  const options = { send: (current: DemoState) => textWaitlistAboutGaps(current, today), committed: (sent: unknown[]) => { reported.push(sent.length); } };
  dispatchWithLog(note, undefined, undefined, options);
  const before = demoSentMessages("demo");
  expect(before.list("sms")).toHaveLength(1);
  await startBusiness();
  expect(demoSentMessages("demo")).not.toBe(before);
  expect(demoSentMessages("demo").list()).toEqual([]);
  dispatchWithLog(note, undefined, undefined, options);
  expect(reported).toEqual([1, 1]);
});

it("sends no free-times text once no free time is left today", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerGapsToWaitlist, todayGaps, sms } = await modules();
  const late = { today, minutes: 24 * 60 - 1 };
  expect(todayGaps(state, late)).toEqual([]);
  expect(todayGaps(state, { today, minutes: 0 }).length).toBeGreaterThan(0);
  expect(offerGapsToWaitlist(late)).toBe(false);
  expect(sms()).toEqual([]);
  expect(storage.saved().inbox).toEqual(state.inbox);
});

it("texts the waiting list about today's free times only together with its saved inbox note", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerGapsToWaitlist, sms } = await modules();
  expect(offerGapsToWaitlist({ today, minutes: 0 })).toBe(true);
  expect(sms().map((record) => record.reference)).toEqual([`waitlist-gaps-${today}`]);
  expect(storage.saved().inbox[0]).toMatchObject({ waitlistOffer: true });
});

it("sends no free-times text when the save is refused", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerGapsToWaitlist, sms } = await modules();
  storage.write({ ...state, modules: { ...state.modules, waitlist: false } });
  expect(offerGapsToWaitlist({ today, minutes: 600 })).toBe(false);
  expect(sms()).toEqual([]);
  expect(storage.saved().inbox).toEqual(state.inbox);
});

it("counts the customers in the slot offer's note and toast from the saved state, not the render", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerSlotToWaitlist, tc } = await modules();
  const booking = upcoming(state);
  // Rendered with three waiting; another tab has since left one.
  const fewer = { ...state, customers: state.customers.map((customer, i) => (i < 3 ? { ...customer, waitlist: i === 2 } : customer)) };
  storage.write(fewer);
  expect(offerSlotToWaitlist(booking, { today, minutes: 600 })).toBe(true);
  const { waitlistCount, waitlistNotice } = await import("@/concept/studio/booking/waitlist-notice");
  const count = waitlistCount(fewer, booking);
  expect(count).toBeLessThan(waitlistCount(state, booking));
  expect(storage.saved().inbox[0].body).toBe(waitlistNotice(booking, count, { today, minutes: 600 }).body);
  expect(showToast.mock.calls.at(-1)?.[0]).toBe(tc("suggest.gaps.toast", count));
});

it("counts the customers in the free-times note and toast from the saved state, not the render", async () => {
  const state = salon();
  const storage = tab(state);
  const { offerGapsToWaitlist, tc } = await modules();
  const fewer = { ...state, customers: state.customers.map((customer, i) => ({ ...customer, waitlist: i === 0 })) };
  storage.write(fewer);
  expect(offerGapsToWaitlist({ today, minutes: 0 })).toBe(true);
  expect(storage.saved().inbox[0].body).toBe(tc("suggest.gaps.sentBody", 1));
  expect(showToast.mock.calls.at(-1)?.[0]).toBe(tc("suggest.gaps.toast", 1));
});

it("keeps the sample salon's deposits working: a staged payment is published after the save", async () => {
  const base = salon();
  const [deposit] = base.services.filter((service) => !service.hidden);
  const state: DemoState = { ...base, cancellationPolicy: { ...base.cancellationPolicy, deposits: { [deposit.id]: 20_000 } } };
  tab(state);
  const { dispatch, currentState, demoOutbox } = await modules();
  const { freeStarts, needOf } = await import("@/concept/data/slots");
  const staffId = deposit.staffIds[0];
  const date = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1)).find((day) => freeStarts(state, staffId, day, needOf(deposit)).length)!;
  const start = freeStarts(state, staffId, date, needOf(deposit))[0];
  expect(dispatch({ type: "online/hold", guest: { name: "Alva Berg", phone: "0700000001", at: { date: today, time: 0 } }, serviceId: deposit.id, staffId, date, start, notice: { title: "Hold", body: "Hold" } })).toBe(true);
  const hold = currentState()!.checkoutHolds.at(-1)!;
  expect(dispatch({ type: "online/pay", id: hold.id, method: "card" })).toBe(true);
  expect(demoOutbox.list("payments")).toHaveLength(1);
});
