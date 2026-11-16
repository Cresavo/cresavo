import { weekday } from "./dates";
import type { Booking, DateKey, Salon, Staff, StaffId } from "./types";

// Free time: opening hours, lunch and existing bookings per staff member.

export interface SlotContext {
  salon: Salon;
  staff: Staff[];
  bookings: Booking[];
}

export interface Interval {
  start: number;
  end: number;
}

export function openingFor(salon: Salon, date: DateKey) {
  return salon.hours[weekday(date)] ?? null;
}

/** Lunch only applies to long days (not the short Saturday shift). */
export function lunchFor(salon: Salon, date: DateKey): Interval | null {
  const hours = openingFor(salon, date);
  if (!hours || hours.close - hours.open <= 6 * 60) return null;
  return { ...salon.lunch };
}

export function staffWorks(staff: Staff | undefined, salon: Salon, date: DateKey): boolean {
  if (!staff || !openingFor(salon, date)) return false;
  return staff.workdays.includes(weekday(date));
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
  return list.sort((a, b) => a.start - b.start);
}

export function isFree(
  ctx: SlotContext,
  staffId: StaffId,
  date: DateKey,
  start: number,
  duration: number,
  ignoreId?: string,
): boolean {
  const staff = ctx.staff.find((s) => s.id === staffId);
  const hours = openingFor(ctx.salon, date);
  if (!hours || !staffWorks(staff, ctx.salon, date)) return false;
  const end = start + duration;
  if (start < hours.open || end > hours.close) return false;
  return busyIntervals(ctx, staffId, date, ignoreId).every((i) => end <= i.start || start >= i.end);
}

/** Every start time (15-minute steps) where a treatment of the given length fits. */
export function freeStarts(
  ctx: SlotContext,
  staffId: StaffId,
  date: DateKey,
  duration: number,
  opts: { after?: number; ignoreId?: string; step?: number } = {},
): number[] {
  const hours = openingFor(ctx.salon, date);
  if (!hours) return [];
  const step = opts.step ?? 15;
  const out: number[] = [];
  const first = Math.max(hours.open, opts.after ?? 0);
  const aligned = Math.ceil(first / step) * step;
  for (let t = aligned; t + duration <= hours.close; t += step) {
    if (isFree(ctx, staffId, date, t, duration, opts.ignoreId)) out.push(t);
  }
  return out;
}

/** Continuous gaps of at least `min` minutes during the working day. */
export function freeGaps(
  ctx: SlotContext,
  staffId: StaffId,
  date: DateKey,
  opts: { after?: number; min?: number } = {},
): Interval[] {
  const staff = ctx.staff.find((s) => s.id === staffId);
  const hours = openingFor(ctx.salon, date);
  if (!hours || !staffWorks(staff, ctx.salon, date)) return [];
  const min = opts.min ?? 30;
  const busy = busyIntervals(ctx, staffId, date);
  const gaps: Interval[] = [];
  let cursor = Math.max(hours.open, Math.ceil((opts.after ?? 0) / 15) * 15);
  for (const i of busy) {
    if (i.start > cursor) gaps.push({ start: cursor, end: Math.min(i.start, hours.close) });
    cursor = Math.max(cursor, i.end);
  }
  if (cursor < hours.close) gaps.push({ start: cursor, end: hours.close });
  return gaps.filter((g) => g.end - g.start >= min);
}
