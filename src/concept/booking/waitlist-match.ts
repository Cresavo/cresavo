import { DateTime } from "luxon";
import { freeGaps, isActive, isFree, needOf, occupied, pickResource, resourceStillFree, withSlotClock } from "../data/slots";
import type { DemoState, Interval, Service, StaffId } from "../data/types";
import { salonClock, SALON_TIMEZONE } from "../tools/clock";
import { visitTime } from "./policy";
import { MAX_REQUEST_DAYS, type WaitlistEntry, type WaitlistGap, type WaitlistOffer } from "./waitlist-types";

// Which waiting customer a freed time goes to, and when. Pure functions of the
// state and an explicit instant: preferences are salon wall time, holds and
// treatment lengths are elapsed minutes. Checkout holds and offers are judged
// at that instant (`withSlotClock`), never at the wall clock.

/** Automatic texts are not sent from 21:00 until 08:00, salon time. */
export const QUIET_HOURS = { from: 21, until: 8 } as const;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Days from today on, a real calendar date each, and a window of whole minutes inside one day. */
export function validPreferences(days: readonly string[], window: Interval, today: string): boolean {
  return days.length > 0 && days.length <= MAX_REQUEST_DAYS && new Set(days).size === days.length &&
    days.every((day) => DATE_KEY.test(day) && day >= today && DateTime.fromISO(day).isValid) &&
    Number.isInteger(window.start) && Number.isInteger(window.end) && window.start >= 0 && window.end <= 1440 && window.start < window.end;
}

/** The first moment at or after `now` when an automatic text may go out. */
export function nextSmsTime(now: number): number {
  const local = DateTime.fromMillis(now, { zone: SALON_TIMEZONE });
  if (local.hour >= QUIET_HOURS.until && local.hour < QUIET_HOURS.from) return now;
  return local.plus({ days: local.hour >= QUIET_HOURS.from ? 1 : 0 }).startOf("day").set({ hour: QUIET_HOURS.until }).toMillis();
}

/** Salon midnight after a day: when an entry whose last day it is expires. */
const endOfDay = (day: string) => DateTime.fromISO(day, { zone: SALON_TIMEZONE }).plus({ days: 1 }).toMillis();

/**
 * The next moment the queue needs attention (a hold ends, quiet hours end, a day passes), or Infinity.
 * With `now`, a gap that could be offered right away but has no offer out (its first send failed) is due now.
 */
export function nextWaitlistWake(state: DemoState, now?: number): number {
  let wake = Infinity;
  if (now !== undefined && sendableNow(state, now)) return now;
  for (const offer of state.waitlistOffers) if (offer.status === "offered") wake = Math.min(wake, offer.expiresAt);
  // A checkout that ends can give a waiting gap its time back.
  if (state.waitlistGaps.length) for (const hold of state.checkoutHolds) wake = Math.min(wake, hold.expiresAt);
  for (const entry of state.waitlistEntries) {
    const last = entry.days.at(-1);
    if (last) wake = Math.min(wake, endOfDay(last));
  }
  for (const gap of state.waitlistGaps) wake = Math.min(wake, gap.readyAt ?? Infinity, visitTime({ date: gap.date, start: gap.end }).toMillis());
  return wake;
}

/** Some gap without an offer out would be sent to someone at `now` (no quiet hours, approval given or automatic). */
function sendableNow(state: DemoState, now: number): boolean {
  const rules = state.waitlistRules;
  if (!state.modules.waitlist || rules.paused || rules.mode === "off" || nextSmsTime(now) > now) return false;
  return state.waitlistGaps.some((gap) => !gap.readyAt && (gap.approved || rules.mode === "automatic") &&
    !state.waitlistOffers.some((o) => o.gapId === gap.id && o.status === "offered") && !!nextMatch(state, gap, now));
}

/** Longest waiting first; ties go to the earliest requested day, then the entry id. */
export function queueOrder(a: WaitlistEntry, b: WaitlistEntry): number {
  return a.joinedAt - b.joinedAt || (a.days[0] ?? "").localeCompare(b.days[0] ?? "") || a.id.localeCompare(b.id);
}

/** Customers (other than `except`) with a request for this day; the owner may offer them a freed time. */
export function waitingFor(state: Pick<DemoState, "modules" | "waitlistEntries">, date: string, except?: string): number {
  if (!state.modules.waitlist) return 0;
  return new Set(state.waitlistEntries.filter((e) => e.serviceId && e.days.includes(date) && e.customerId !== except).map((e) => e.customerId)).size;
}

function customerBusy(state: DemoState, customerId: string, date: string, start: number, duration: number) {
  return state.bookings.some((b) => b.customerId === customerId && b.status === "booked" && b.date === date &&
    b.start < start + duration && b.start + b.duration > start);
}

const bookable = (state: DemoState, serviceId: string | undefined, staffId: StaffId): Service | undefined =>
  state.services.find((s) => s.id === serviceId && !s.hidden && s.staffIds.includes(staffId));

/** Still bookable as offered: same treatment length and buffers, and free apart from this offer and its own checkout. */
export function offerAvailable(state: DemoState, offer: WaitlistOffer, now: number): boolean {
  if (offer.status !== "offered" || offer.expiresAt <= now || customerBusy(state, offer.customerId, offer.date, offer.start, offer.duration)) return false;
  const service = bookable(state, offer.serviceId, offer.staffId);
  if (!service || service.duration !== offer.duration || (service.bufferBefore ?? 0) !== (offer.bufferBefore ?? 0) || (service.bufferAfter ?? 0) !== (offer.bufferAfter ?? 0)) return false;
  const others = { ...state, checkoutHolds: state.checkoutHolds.filter((h) => h.offerId !== offer.id) };
  // The room or chair the offer holds must still suit the treatment; another free one is not what was promised.
  return withSlotClock(now, () => isFree(others, offer.staffId, offer.date, offer.start, needOf(service), offer.id) &&
    resourceStillFree(others, needOf(service), offer.resourceId, offer.date, offer.start, offer.id));
}

function* range(from: number, to: number) {
  for (let n = from; n <= to; n++) yield n;
}

/** The wall-clock minute of an instant equals `minute` on that day (false inside a skipped or repeated hour that moved it). */
const sameWallMinute = (instant: DateTime, minute: number) => instant.hour * 60 + instant.minute === minute % 1440;

export interface WaitlistMatch {
  entry: WaitlistEntry;
  service: Service;
  start: number;
  /** Epoch milliseconds of the visit's start. */
  instant: number;
  resourceId?: string;
}

/**
 * The next customer in the queue for a gap and the earliest start that fits them, or undefined. A
 * customer holding another offer is skipped for now; `includeHeld` counts them, to tell a gap that
 * only waits for them from one nobody can take.
 */
export function nextMatch(state: DemoState, gap: WaitlistGap, now: number, { includeHeld = false } = {}): WaitlistMatch | undefined {
  const clock = salonClock(new Date(now));
  if (gap.date < clock.today) return undefined;
  const tried = new Set(state.waitlistOffers.filter((o) => o.gapId === gap.id || (!includeHeld && o.status === "offered")).map((o) => o.customerId));
  const earliest = gap.date === clock.today ? clock.minutes + 1 : 0;
  // Bookable starts in this gap depend only on the treatment: worked out once per treatment, then each customer's window applies.
  const startsByService = new Map<string, number[]>();
  const startsFor = (service: Service) => {
    const known = startsByService.get(service.id);
    if (known) return known;
    const need = needOf(service);
    const before = need.bufferBefore ?? 0;
    const after = need.bufferAfter ?? 0;
    const starts: number[] = [];
    for (const start of range(Math.max(earliest, gap.start) + before, gap.end - after - need.duration)) {
      if (gap.released && !gap.released.some((r) => start - before < r.end && start + need.duration + after > r.start)) continue;
      if (!isFree(state, gap.staffId, gap.date, start, need)) continue;
      const instant = visitTime({ date: gap.date, start });
      // Skip a visit or buffer that crosses a clock change: its wall times would not add up.
      if (instant.toMillis() <= now || !sameWallMinute(instant, start) ||
          !sameWallMinute(instant.minus({ minutes: before }), start - before) ||
          !sameWallMinute(instant.plus({ minutes: need.duration + after }), start + need.duration + after)) continue;
      starts.push(start);
    }
    startsByService.set(service.id, starts);
    return starts;
  };
  // The freed time itself first (a cancelled 10:00 is offered at 10:00), then the earliest start that uses some of it.
  const freedStart = gap.released?.length ? Math.min(...gap.released.map((r) => r.start)) : undefined;
  return withSlotClock(now, () => {
    for (const entry of [...state.waitlistEntries].sort(queueOrder)) {
      if (!entry.days.includes(gap.date) || entry.customerId === gap.excludeCustomer || tried.has(entry.customerId) ||
          (entry.staffId && entry.staffId !== gap.staffId)) continue;
      const service = bookable(state, entry.serviceId, gap.staffId);
      if (!service) continue;
      const fits = startsFor(service).filter((start) => start >= entry.window.start && start + service.duration <= entry.window.end &&
        !customerBusy(state, entry.customerId, gap.date, start, service.duration));
      if (!fits.length) continue;
      const preferred = freedStart === undefined ? undefined : fits.find((start) => start === Math.max(freedStart, fits[0]));
      const start = preferred ?? fits[0];
      return { entry, service, start, instant: visitTime({ date: gap.date, start }).toMillis(), resourceId: pickResource(state, needOf(service), gap.date, start) };
    }
    return undefined;
  });
}

/**
 * Whether someone could take the gap once temporary reservations end: checkouts, other gaps' offers and
 * customers holding another offer. A gap that only waits for those is kept, not dropped.
 */
export function couldMatch(state: DemoState, gap: WaitlistGap, now: number): WaitlistMatch | undefined {
  const waiting = {
    ...state,
    checkoutHolds: [],
    waitlistOffers: state.waitlistOffers.map((o) => (o.gapId !== gap.id && o.status === "offered" ? { ...o, expiresAt: 0 } : o)),
  };
  return nextMatch(waiting, gap, now, { includeHeld: true });
}

/** The parts of `span` that `previous` did not already leave free. */
function difference(span: Interval, previous: readonly Interval[]): Interval[] {
  let cursor = span.start;
  const result: Interval[] = [];
  for (const old of [...previous].sort((a, b) => a.start - b.start)) {
    if (old.end <= cursor || old.start >= span.end) continue;
    if (old.start > cursor) result.push({ start: cursor, end: old.start });
    cursor = Math.max(cursor, old.end);
  }
  if (cursor < span.end) result.push({ start: cursor, end: span.end });
  return result;
}

/**
 * Time a change made available on a day someone waits for: a cancelled or
 * moved visit, or longer working or opening hours. Only gaps with a matching
 * customer are kept.
 */
export function releasedGaps(prev: DemoState, state: DemoState, now: number): WaitlistGap[] {
  if (!state.modules.waitlist || !state.waitlistEntries.some((e) => e.days.length)) return [];
  const dates = new Set(state.waitlistEntries.flatMap((e) => e.days));
  const found: WaitlistGap[] = [];
  // The opening is the whole free stretch around the freed time: a cancelled half hour next to a free half hour makes an hour.
  const add = (staffId: StaffId, date: string, span: Interval, excludeCustomer?: string) => {
    if (!dates.has(date) || span.end <= span.start) return;
    const opening = withSlotClock(now, () => freeGaps(state, staffId, date, { min: 1 }))
      .find((free) => free.start <= span.start && free.end >= span.end) ?? span;
    const same = found.find((g) => g.staffId === staffId && g.date === date && g.start === opening.start && g.end === opening.end);
    if (same) {
      // Two freed parts of one stretch stay two: the time between them was free before.
      same.released = [...same.released!, { ...span }];
      return;
    }
    found.push({ start: opening.start, end: opening.end, released: [{ ...span }], staffId, date, excludeCustomer, id: `gap-${state.seq}-${found.length}` });
  };
  if (prev.bookings !== state.bookings) {
    const current = new Map(state.bookings.map((b) => [b.id, b]));
    for (const old of prev.bookings) {
      const updated = current.get(old.id);
      if (old.status !== "booked" || !dates.has(old.date) || old === updated) continue;
      const kept = updated && isActive(updated) && updated.date === old.date && updated.staffId === old.staffId ? [occupied(updated)] : [];
      for (const span of difference(occupied(old), kept)) add(old.staffId, old.date, span, old.customerId);
    }
  }
  if (prev.salon !== state.salon || prev.staff !== state.staff || prev.exceptions !== state.exceptions) {
    withSlotClock(now, () => {
      for (const date of dates) for (const { id } of state.staff) {
        const before = freeGaps(prev, id, date, { min: 1 });
        for (const gap of freeGaps(state, id, date, { min: 1 })) for (const span of difference(gap, before)) add(id, date, span);
      }
    });
  }
  return found.filter((gap) => couldMatch(state, gap, now)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

/** Open time on a day that no queue covers yet, with its first match: an owner can offer existing gaps too. */
export function manualGaps(state: DemoState, date: string, staffId: StaffId, now: number): { gap: WaitlistGap; match: WaitlistMatch }[] {
  const spans = withSlotClock(now, () => freeGaps(state, staffId, date, { min: 1 }));
  return spans.flatMap((span) => {
    // Time a queue already covers stays with that queue: its freed parts, or all of an opening the owner chose.
    // The rest of the stretch can still be offered by hand.
    const queued = state.waitlistGaps.filter((g) => g.date === date && g.staffId === staffId).flatMap((g) => g.released ?? [g]);
    return difference(span, queued).flatMap((part) => {
      const gap: WaitlistGap = { ...part, staffId, date, id: `open-${date}-${staffId}-${part.start}-${part.end}` };
      const match = nextMatch(state, gap, now);
      return match ? [{ gap, match }] : [];
    });
  });
}
