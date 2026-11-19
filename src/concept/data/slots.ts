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
  blocks?: StaffBlock[];
}

/** What a booking needs: a treatment (for its room or chair) and how long it takes. */
export interface Need {
  serviceId: string;
  duration: number;
}

export const needOf = (service: Pick<Service, "id" | "duration">): Need => ({ serviceId: service.id, duration: service.duration });

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

export function busyIntervals(ctx: SlotContext, staffId: StaffId, date: DateKey, ignoreId?: string): Interval[] {
  const list = ctx.bookings
    .filter((b) => b.staffId === staffId && b.date === date && isActive(b) && b.id !== ignoreId)
    .map((b) => ({ start: b.start, end: b.start + b.duration }));
  const lunch = lunchFor(ctx.salon, date);
  if (lunch) list.push(lunch);
  for (const block of ctx.blocks ?? []) if (block.staffId === staffId && block.date === date) list.push(block);
  return list.sort((a, b) => a.start - b.start);
}

/** The room or chair a booking would use: the first one of the treatment's resources that is free. Undefined when none is free or none is needed. */
export function pickResource(ctx: SlotContext, need: Need, date: DateKey, start: number, ignoreId?: string): string | undefined {
  const end = start + need.duration;
  return usableResources(ctx, need.serviceId).find(
    (id) => !ctx.bookings.some((b) => b.resourceId === id && b.date === date && isActive(b) && b.id !== ignoreId && start < b.start + b.duration && end > b.start),
  );
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
  const end = start + need.duration;
  if (start < window.start || end > window.end) return false;
  if (!busyIntervals(ctx, staffId, date, ignoreId).every((i) => end <= i.start || start >= i.end)) return false;
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
