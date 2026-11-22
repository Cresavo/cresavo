import type { CheckoutHold } from "../booking/protection";
import { weekday } from "./dates";
import type { Booking, DateKey, Interval, Resource, Salon, Service, Staff, StaffBlock, StaffException, StaffId, VisitTiming } from "./types";

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
  blocks?: StaffBlock[];
}

/** What a booking needs: a treatment (for its room or chair) and how long it takes. */
export interface Need extends VisitTiming {
  serviceId: string;
  duration: number;
}

/** The timing worth keeping on a booking or hold: zero and unset values are left out. */
export const timingOf = ({ bufferBefore, bufferAfter, processing }: VisitTiming): VisitTiming => ({
  ...(bufferBefore ? { bufferBefore } : {}),
  ...(bufferAfter ? { bufferAfter } : {}),
  ...(processing ? { processing: { after: processing.after, duration: processing.duration } } : {}),
});

export const needOf = (service: Pick<Service, "id" | "duration"> & VisitTiming): Need => ({ serviceId: service.id, duration: service.duration, ...timingOf(service) });

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

/** The stretches of a person's day that can be booked: their working hours minus lunch. */
export function bookableIntervals(ctx: Pick<SlotContext, "salon" | "staff" | "exceptions">, staffId: StaffId, date: DateKey): Interval[] {
  const window = workWindow(ctx, staffId, date);
  if (!window) return [];
  const lunch = lunchFor(ctx.salon, date);
  if (!lunch || lunch.end <= window.start || lunch.start >= window.end) return [window];
  return [{ start: window.start, end: lunch.start }, { start: lunch.end, end: window.end }].filter((part) => part.end > part.start);
}

/** Bookable minutes in a person's day. */
export function workMinutes(ctx: Pick<SlotContext, "salon" | "staff" | "exceptions">, staffId: StaffId, date: DateKey): number {
  return bookableIntervals(ctx, staffId, date).reduce((sum, part) => sum + part.end - part.start, 0);
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

function activeHolds(ctx: SlotContext, date: DateKey) {
  if (!ctx.checkoutHolds?.length) return [];
  // eslint-disable-next-line no-restricted-syntax -- Direct browser slot reads use the wall clock outside a store operation.
  const now = fixedNow ?? Date.now();
  return ctx.checkoutHolds.filter(h => h.date === date && h.expiresAt > now);
}

const intersects = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** The wait inside a visit where the customer stays and the staff member is free; null when there is none. */
export function processingGap(timing: VisitTiming | undefined, start: number, duration: number): Interval | null {
  if (!timing?.processing) return null;
  const gap = { start: start + timing.processing.after, end: Math.min(start + timing.processing.after + timing.processing.duration, start + duration) };
  return gap.end > gap.start ? gap : null;
}

/**
 * When the staff member is busy for a visit: preparation, the active parts of the treatment and clean-up, but not the processing gap.
 * The timing comes from the visit itself, never from its treatment: it is copied onto the booking
 * or hold when it is made, and a visit without a copy has no buffers, so there is no fallback.
 */
export function staffIntervals(timing: VisitTiming | undefined, start: number, duration: number): Interval[] {
  const end = start + duration;
  const from = start - (timing?.bufferBefore ?? 0);
  const to = end + (timing?.bufferAfter ?? 0);
  const gap = processingGap(timing, start, duration);
  const parts = gap ? [{ start: from, end: gap.start }, { start: gap.end, end: to }] : [{ start: from, end: to }];
  return parts.filter((part) => part.end > part.start);
}

function serviceOf(ctx: SlotContext, serviceId: string): Service | undefined {
  return [...ctx.services, ...(ctx.retiredServices ?? [])].find((s) => s.id === serviceId);
}

export function busyIntervals(ctx: SlotContext, staffId: StaffId, date: DateKey, ignoreId?: string): Interval[] {
  const visits = ctx.bookings.filter(b => b.staffId === staffId && b.date === date && isActive(b) && b.id !== ignoreId);
  const holds = activeHolds(ctx, date).filter(h => h.staffId === staffId && h.id !== ignoreId);
  const list = [...visits, ...holds].flatMap(b => staffIntervals(b, b.start, b.duration));
  const lunch = lunchFor(ctx.salon, date);
  if (lunch) list.push(lunch);
  for (const block of ctx.blocks ?? []) if (block.staffId === staffId && block.date === date) list.push(block);
  return list.sort((a, b) => a.start - b.start);
}

/** The room or chair a booking would use: `preferred` if it is free, otherwise the first one of the treatment's resources that is free. Undefined when none is free or none is needed. */
export function pickResource(ctx: SlotContext, need: Need, date: DateKey, start: number, ignoreId?: string, preferred?: string): string | undefined {
  const end = start + need.duration;
  const holds = activeHolds(ctx, date);
  const overlaps = (b: Booking | CheckoutHold, id: string) =>
    b.resourceId === id && b.id !== ignoreId && start < b.start + b.duration && end > b.start;
  return usableResources(ctx, need.serviceId).sort((a, b) => Number(b === preferred) - Number(a === preferred)).find(id =>
    !ctx.bookings.some(b => b.date === date && isActive(b) && overlaps(b, id)) && !holds.some(h => overlaps(h, id)),
  );
}

function usableResources(ctx: SlotContext, serviceId: string): string[] {
  const wanted = serviceOf(ctx, serviceId)?.resourceIds ?? [];
  return wanted.filter((id) => ctx.resources.some((r) => r.id === id));
}

function resourceFree(ctx: SlotContext, need: Need, date: DateKey, start: number, ignoreId?: string): boolean {
  return usableResources(ctx, need.serviceId).length === 0 || pickResource(ctx, need, date, start, ignoreId) !== undefined;
}

export function isFree(ctx: SlotContext, staffId: StaffId, date: DateKey, start: number, need: Need, ignoreId?: string): boolean {
  if (!Number.isInteger(start) || !Number.isInteger(need.duration) || need.duration <= 0) return false;
  const window = workWindow(ctx, staffId, date);
  if (!window) return false;
  const end = start + need.duration;
  if (start < window.start || end > window.end) return false;
  const mine = staffIntervals(need, start, need.duration);
  // Preparation and clean-up stay within the day, so no check has to look at the neighbouring days.
  if (mine.some((part) => part.start < 0 || part.end > 24 * 60)) return false;
  if (busyIntervals(ctx, staffId, date, ignoreId).some((busy) => mine.some((part) => intersects(part, busy)))) return false;
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

/** Minutes of the bookable intervals that visits take, counting overlapping work once. */
export function busyMinutes(bookings: Booking[], bookable: Interval[]): number {
  const parts = bookings.flatMap((b) => staffIntervals(b, b.start, b.duration)).sort((a, b) => a.start - b.start);
  const union: Interval[] = [];
  for (const part of parts) {
    const last = union.at(-1);
    if (last && part.start <= last.end) last.end = Math.max(last.end, part.end);
    else union.push({ ...part });
  }
  return bookable.reduce((sum, window) => sum + union.reduce((inside, part) => inside + Math.max(0, Math.min(part.end, window.end) - Math.max(part.start, window.start)), 0), 0);
}

/** What a booking being moved needs: its own length and timing, as the reducer checks the move. Anything else needs `fallback`. */
export function moveNeed(ctx: Pick<SlotContext, "bookings">, bookingId: string | undefined, fallback: Need): Need {
  const booking = bookingId ? ctx.bookings.find((b) => b.id === bookingId) : undefined;
  return booking ? { serviceId: booking.serviceId, duration: booking.duration, ...timingOf(booking) } : fallback;
}
