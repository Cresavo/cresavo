import type { CheckoutHold } from "../booking/protection";
import type { WaitlistOffer } from "../booking/waitlist-types";
import { weekday } from "./dates";
import type { Booking, DateKey, Interval, Resource, Salon, Service, Staff, StaffBlock, StaffException, StaffId } from "./types";

// The one place that knows when something can be booked: opening hours,
// closed days, lunch, each person's weekly template and exceptions, existing
// bookings and the rooms or chairs a treatment needs. The studio calendar, the
// customer page, the command box, the phone sheet and the MCP tools all call
// these functions, so they can never disagree.

export interface SlotContext {
  salon: Salon;
  staff: Staff[];
  services: Service[];
  /** Deleted treatments whose bookings may still be moved; they keep their room or chair. */
  retiredServices?: Service[];
  resources: Resource[];
  exceptions: StaffException[];
  bookings: Booking[];
  checkoutHolds?: CheckoutHold[];
  /** Personal waitlist offers hold their time like a checkout until they end. */
  waitlistOffers?: WaitlistOffer[];
  blocks?: StaffBlock[];
}

/** What a booking needs: a treatment (for its room or chair) and how long it takes. */
export interface Need {
  serviceId: string;
  duration: number;
  /** Preparation and cleanup: the person and the room or chair are busy, the customer is not there. */
  bufferBefore?: number;
  bufferAfter?: number;
}

export const needOf = (service: Pick<Service, "id" | "duration" | "bufferBefore" | "bufferAfter">): Need =>
  ({ serviceId: service.id, duration: service.duration, bufferBefore: service.bufferBefore, bufferAfter: service.bufferAfter });

/** The minutes a visit occupies, preparation and cleanup included. */
export function occupied(visit: Pick<Need, "duration" | "bufferBefore" | "bufferAfter"> & { start: number }): Interval {
  return { start: visit.start - (visit.bufferBefore ?? 0), end: visit.start + visit.duration + (visit.bufferAfter ?? 0) };
}

/** Opening hours of a day; null when the weekday is closed or the day is a closure. */
export function openingFor(salon: Salon, date: DateKey) {
  if (salon.closures.some((c) => c.date === date)) return null;
  return salon.hours[weekday(date)] ?? null;
}

/** Lunch only applies to long days (not the short Saturday shift). */
export function lunchFor(salon: Salon, date: DateKey): Interval | null {
  const hours = openingFor(salon, date);
  if (!salon.lunch || !hours || hours.close - hours.open <= 6 * 60) return null;
  return { ...salon.lunch };
}

/** The exception that applies to a person on a day, if any. */
export function exceptionFor(exceptions: StaffException[], staffId: StaffId, date: DateKey): StaffException | undefined {
  return exceptions.find((e) => e.staffId === staffId && e.date === date);
}

/** The hours a person works on a day: their template or exception, kept within opening hours. Null = not working. */
export function workWindow(ctx: Pick<SlotContext, "salon" | "staff" | "exceptions">, staffId: StaffId, date: DateKey): Interval | null {
  const hours = openingFor(ctx.salon, date);
  const staff = ctx.staff.find((s) => s.id === staffId);
  if (!hours || !staff) return null;
  const exception = exceptionFor(ctx.exceptions, staffId, date);
  const shift = exception ? (exception.kind === "off" ? null : { start: exception.start, end: exception.end }) : staff.week[weekday(date)];
  if (!shift) return null;
  const start = Math.max(shift.start, hours.open);
  const end = Math.min(shift.end, hours.close);
  return end > start ? { start, end } : null;
}

export function staffWorks(ctx: Pick<SlotContext, "salon" | "staff" | "exceptions">, staffId: StaffId, date: DateKey): boolean {
  return workWindow(ctx, staffId, date) !== null;
}

/** Bookable minutes in a person's day: their working hours minus lunch. */
export function workMinutes(ctx: Pick<SlotContext, "salon" | "staff" | "exceptions">, staffId: StaffId, date: DateKey): number {
  const window = workWindow(ctx, staffId, date);
  if (!window) return 0;
  const lunch = lunchFor(ctx.salon, date);
  const lunchMinutes = lunch ? Math.max(0, Math.min(lunch.end, window.end) - Math.max(lunch.start, window.start)) : 0;
  return window.end - window.start - lunchMinutes;
}

export function isActive(b: Booking) {
  return b.status !== "cancelled";
}

let fixedNow: number | undefined;

/**
 * Runs a synchronous check or reducer call with checkout holds judged at `now`
 * instead of the wall clock, for stores with their own clock.
 */
export function withSlotClock<T>(now: number, run: () => T): T {
  const previous = fixedNow;
  fixedNow = now;
  try {
    return run();
  } finally {
    fixedNow = previous;
  }
}

function activeHolds(ctx: SlotContext, date: DateKey): (CheckoutHold | WaitlistOffer)[] {
  const offers = ctx.waitlistOffers?.filter(o => o.status === "offered") ?? [];
  if (!ctx.checkoutHolds?.length && !offers.length) return [];
  // eslint-disable-next-line no-restricted-syntax -- Direct browser slot reads use the wall clock outside a store operation.
  const now = fixedNow ?? Date.now();
  return [...(ctx.checkoutHolds ?? []), ...offers].filter(h => h.date === date && h.expiresAt > now);
}

export function busyIntervals(ctx: SlotContext, staffId: StaffId, date: DateKey, ignoreId?: string): Interval[] {
  const visits = ctx.bookings.filter(b => b.staffId === staffId && b.date === date && isActive(b) && b.id !== ignoreId);
  const holds = activeHolds(ctx, date).filter(h => h.staffId === staffId && h.id !== ignoreId);
  const list = [...visits, ...holds].map(occupied);
  const lunch = lunchFor(ctx.salon, date);
  if (lunch) list.push(lunch);
  for (const block of ctx.blocks ?? []) if (block.staffId === staffId && block.date === date) list.push(block);
  return list.sort((a, b) => a.start - b.start);
}

/** The room or chair a booking would use: the first one of the treatment's resources that is free. Undefined when none is free or none is needed. */
export function pickResource(ctx: SlotContext, need: Need, date: DateKey, start: number, ignoreId?: string): string | undefined {
  const span = occupied({ ...need, start });
  const holds = activeHolds(ctx, date);
  const overlaps = (b: Booking | CheckoutHold | WaitlistOffer, id: string) => {
    if (b.resourceId !== id || b.id === ignoreId) return false;
    const other = occupied(b);
    return span.start < other.end && span.end > other.start;
  };
  return usableResources(ctx, need.serviceId).find(id =>
    !ctx.bookings.some(b => b.date === date && isActive(b) && overlaps(b, id)) && !holds.some(h => overlaps(h, id)),
  );
}

/** True when the treatment needs no room or chair, or can still use this one and nothing else holds it then. */
export function resourceStillFree(ctx: SlotContext, need: Need, resourceId: string | undefined, date: DateKey, start: number, ignoreId?: string): boolean {
  const usable = usableResources(ctx, need.serviceId);
  if (!usable.length) return true;
  if (!resourceId || !usable.includes(resourceId)) return false;
  return pickResource({ ...ctx, resources: ctx.resources.filter((r) => r.id === resourceId) }, need, date, start, ignoreId) === resourceId;
}

function usableResources(ctx: SlotContext, serviceId: string): string[] {
  const wanted = [...ctx.services, ...(ctx.retiredServices ?? [])].find((s) => s.id === serviceId)?.resourceIds ?? [];
  return wanted.filter((id) => ctx.resources.some((r) => r.id === id));
}

function resourceFree(ctx: SlotContext, need: Need, date: DateKey, start: number, ignoreId?: string): boolean {
  return usableResources(ctx, need.serviceId).length === 0 || pickResource(ctx, need, date, start, ignoreId) !== undefined;
}

export function isFree(ctx: SlotContext, staffId: StaffId, date: DateKey, start: number, need: Need, ignoreId?: string): boolean {
  const window = workWindow(ctx, staffId, date);
  if (!window) return false;
  const span = occupied({ ...need, start });
  if (span.start < window.start || span.end > window.end) return false;
  if (!busyIntervals(ctx, staffId, date, ignoreId).every((i) => span.end <= i.start || span.start >= i.end)) return false;
  return resourceFree(ctx, need, date, start, ignoreId);
}

/** Every start time (15-minute steps) where a treatment fits. */
export function freeStarts(
  ctx: SlotContext,
  staffId: StaffId,
  date: DateKey,
  need: Need,
  opts: { after?: number; ignoreId?: string; step?: number } = {},
): number[] {
  const window = workWindow(ctx, staffId, date);
  if (!window) return [];
  const step = opts.step ?? 15;
  const out: number[] = [];
  const aligned = Math.ceil(Math.max(window.start, opts.after ?? 0) / step) * step;
  for (let t = aligned; t + need.duration <= window.end; t += step) {
    if (isFree(ctx, staffId, date, t, need, opts.ignoreId)) out.push(t);
  }
  return out;
}

/** Continuous gaps of at least `min` minutes during a person's working day. */
export function freeGaps(
  ctx: SlotContext,
  staffId: StaffId,
  date: DateKey,
  opts: { after?: number; min?: number } = {},
): Interval[] {
  const window = workWindow(ctx, staffId, date);
  if (!window) return [];
  const min = opts.min ?? 30;
  const gaps: Interval[] = [];
  let cursor = Math.max(window.start, Math.ceil((opts.after ?? 0) / 15) * 15);
  for (const i of busyIntervals(ctx, staffId, date)) {
    if (i.start > cursor) gaps.push({ start: cursor, end: Math.min(i.start, window.end) });
    cursor = Math.max(cursor, i.end);
  }
  if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
  return gaps.filter((g) => g.end - g.start >= min);
}

/** An owner can block only a free interval entirely inside the staff member's workday. */
export function canBlock(ctx: SlotContext, staffId: StaffId, date: DateKey, start: number, end: number) {
  return Number.isInteger(start) && Number.isInteger(end) && start < end &&
    freeGaps(ctx, staffId, date, { min: 1 }).some(gap => start >= gap.start && end <= gap.end);
}
