import { stableHash } from "../connections/core";
import { sendDemoMessage } from "../connections/demo";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { customerText } from "../i18n/customer-text";
import { formatDayLong, formatTime } from "../i18n/format";
import { salonClock } from "../tools/clock";
import { bookingHome } from "./links";
import { nextMatch, nextSmsTime, offerAvailable, releasedGaps, type WaitlistMatch } from "./waitlist-match";
import type { WaitlistGap, WaitlistOffer } from "./waitlist-types";

// The queue itself: one personal offer per freed time at a time, handed on
// when it is declined, lapses or can no longer be booked. Runs inside the
// reducer, so the simulated SMS goes through whatever channels the store
// staged (`withDemoChannels`): a refused or retried apply sends nothing.

/** The personal link in an offer text: the salon's own booking page. */
export const offerLink = (slug: string, id: string) => `${bookingHome(slug)}?offer=${encodeURIComponent(id)}`;

/** Removes one entry and keeps the customer's waiting-list flag in step with what is left. */
export function removeEntry(state: DemoState, id: string): DemoState {
  const entry = state.waitlistEntries.find((e) => e.id === id);
  if (!entry) return state;
  const waitlistEntries = state.waitlistEntries.filter((e) => e !== entry);
  const waiting = waitlistEntries.some((e) => e.customerId === entry.customerId);
  return { ...state, waitlistEntries, customers: state.customers.map((c) => (c.id === entry.customerId && c.waitlist !== waiting ? { ...c, waitlist: waiting } : c)) };
}

/** Ends an offer. A claim also closes its gap and the entry it answered. */
export function finishOffer(state: DemoState, offer: WaitlistOffer, status: Exclude<WaitlistOffer["status"], "offered">, at: number, bookingId?: string): DemoState {
  const next = {
    ...state,
    waitlistOffers: state.waitlistOffers.map((o) => (o.id === offer.id ? { ...o, status, endedAt: at, ...(bookingId ? { bookingId } : {}) } : o)),
    checkoutHolds: state.checkoutHolds.filter((h) => h.offerId !== offer.id),
  };
  if (status !== "claimed") return next;
  return removeEntry({ ...next, waitlistGaps: next.waitlistGaps.filter((g) => g.id !== offer.gapId) }, offer.entryId);
}

/** Sends the simulated text and records the offer. Unchanged when the SMS port refuses the message. */
function sendOffer(state: DemoState, gap: WaitlistGap, match: WaitlistMatch, now: number, offeredBy: WaitlistOffer["offeredBy"]): DemoState {
  const { entry, service, start, resourceId } = match;
  const id = `offer-${state.seq}-${stableHash(`${state.salon.slug}|${gap.id}|${entry.id}|${now}`)}`;
  const expiresAt = Math.min(match.instant, now + state.waitlistRules.minutes * 60_000);
  const language = state.localization.language;
  const body = customerText(state, "offers.sms", {
    salon: state.salon.name, day: formatDayLong(gap.date, language), time: formatTime(start, language),
    until: formatTime(salonClock(new Date(expiresAt)).minutes, language), link: offerLink(state.salon.slug, id),
  });
  const sent = sendDemoMessage({ channel: "sms", to: { customerId: entry.customerId }, body, reference: id });
  if (!sent) return state;
  const offer: WaitlistOffer = {
    id, gapId: gap.id, entryId: entry.id, customerId: entry.customerId, serviceId: service.id, staffId: gap.staffId,
    date: gap.date, start, duration: service.duration, bufferBefore: service.bufferBefore, bufferAfter: service.bufferAfter,
    resourceId, offeredBy, offeredAt: now, expiresAt, status: "offered",
  };
  const clock = salonClock(new Date(now));
  const customer = state.customers.find((c) => c.id === entry.customerId);
  return {
    ...state,
    seq: state.seq + 1,
    waitlistOffers: [...state.waitlistOffers, offer],
    inbox: [{
      id: `i-${state.seq}`, kind: "system", waitlistOffer: true, customerId: entry.customerId, offerId: id,
      date: clock.today, time: clock.minutes, title: t("offers.sentTitle", { name: customer?.firstName ?? "" }),
      body: sent.body, read: false, handled: true,
    }, ...state.inbox],
  };
}

/**
 * Brings the queue up to date at `now` after a change from `prev` to `current`:
 * drops passed and orphaned entries, lapses offers that ended or can no longer
 * be booked, records newly freed time and sends the next offer where the rules
 * allow. `approve` is a gap the owner just approved, or "released" for every
 * gap the change itself freed (an owner's "offer to the waiting list").
 */
export function advanceWaitlist(prev: DemoState, current: DemoState, now: number, approve?: string): DemoState {
  let state = current;
  const today = salonClock(new Date(now)).today;
  for (const entry of state.waitlistEntries) {
    const last = entry.days.at(-1);
    if ((last && last < today) || !state.customers.some((c) => c.id === entry.customerId)) state = removeEntry(state, entry.id);
  }
  for (const offer of state.waitlistOffers) {
    if (offer.status !== "offered") continue;
    if (!state.waitlistEntries.some((e) => e.id === offer.entryId) || !offerAvailable(state, offer, now)) state = finishOffer(state, offer, "lapsed", now);
  }
  const added = releasedGaps(prev, state, now).map((gap) => (approve === "released" ? { ...gap, approved: true } : gap));
  if (added.length) state = { ...state, seq: state.seq + 1, waitlistGaps: [...state.waitlistGaps, ...added] };

  const rules = state.waitlistRules;
  const enabled = state.modules.waitlist && !rules.paused && rules.mode !== "off";
  const sendable = nextSmsTime(now);
  for (const gap of state.waitlistGaps) {
    if (state.waitlistOffers.some((o) => o.gapId === gap.id && o.status === "offered")) continue;
    const match = nextMatch(state, gap, now);
    const byOwner = approve === gap.id;
    const automatic = enabled && !byOwner && (gap.approved || rules.mode === "automatic");
    // Nobody left to ask, or quiet hours would last until the visit has started: the gap is done.
    if (!match || (automatic && sendable > now && match.instant <= sendable)) {
      state = { ...state, waitlistGaps: state.waitlistGaps.filter((g) => g.id !== gap.id) };
      continue;
    }
    const readyAt = automatic && sendable > now ? sendable : undefined;
    if (gap.readyAt !== readyAt) state = { ...state, waitlistGaps: state.waitlistGaps.map((g) => (g.id === gap.id ? { ...g, readyAt } : g)) };
    if (enabled && (byOwner || (automatic && readyAt === undefined))) state = sendOffer(state, gap, match, now, byOwner ? "owner" : "automatic");
  }
  return state;
}
