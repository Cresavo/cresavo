import { addDays } from "../data/dates";
import { freeStarts, needOf } from "../data/slots";
import type { DateKey, DemoState, StaffId } from "../data/types";
import { earliestBookingStart } from "./policy";

export type Period = "morning" | "afternoon" | "evening";

export interface OpenSlot {
  staffId: StaffId;
  date: DateKey;
  start: number;
}

export interface Clock {
  today: DateKey;
  minutes: number;
}

export interface SlotQuery {
  serviceId: string;
  staffId?: StaffId;
  /** Inclusive search window. */
  from: DateKey;
  to: DateKey;
  period?: Period;
  /** Preferred start, minutes from midnight. */
  time?: number;
}

const STEP = 30;
const MAX_DAYS = 21;

export function inPeriod(start: number, period: Period | undefined): boolean {
  if (!period) return true;
  if (period === "morning") return start < 12 * 60;
  if (period === "afternoon") return start >= 12 * 60 && start < 17 * 60;
  return start >= 16 * 60;
}

/** Every bookable start on one day, merged over the staff who can do the treatment. */
export function openSlots(
  state: DemoState,
  serviceId: string,
  date: DateKey,
  clock: Clock,
  opts: { staffId?: StaffId; ignoreId?: string } = {},
): OpenSlot[] {
  const service = state.services.find((s) => s.id === serviceId);
  if (!service || date < clock.today) return [];
  const after = earliestBookingStart(date, clock.today, clock.minutes);
  const byStart = new Map<number, OpenSlot>();
  for (const id of service.staffIds.filter((s) => !opts.staffId || s === opts.staffId)) {
    for (const start of freeStarts(state, id, date, needOf(service), { after, step: STEP, ignoreId: opts.ignoreId })) {
      if (!byStart.has(start)) byStart.set(start, { staffId: id, date, start });
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/**
 * Up to `count` varied suggestions: one per day first (the earliest match, or the one
 * closest to the preferred time), then a later second option if the window is short.
 */
export function suggestSlots(state: DemoState, query: SlotQuery, clock: Clock, count = 3): OpenSlot[] {
  const picks: OpenSlot[] = [];
  const spare: OpenSlot[] = [];
  const first = query.from < clock.today ? clock.today : query.from;
  for (let i = 0; i < MAX_DAYS && addDays(first, i) <= query.to && picks.length < count; i++) {
    const date = addDays(first, i);
    const matching = openSlots(state, query.serviceId, date, clock, { staffId: query.staffId }).filter((s) => inPeriod(s.start, query.period));
    if (query.time !== undefined) matching.sort((a, b) => Math.abs(a.start - query.time!) - Math.abs(b.start - query.time!));
    const [best, ...rest] = matching;
    if (!best) continue;
    picks.push(best);
    const later = rest.filter((s) => Math.abs(s.start - best.start) >= 90).sort((a, b) => a.start - b.start)[0];
    if (later) spare.push(later);
  }
  return [...picks, ...spare.slice(0, count - picks.length)].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}
