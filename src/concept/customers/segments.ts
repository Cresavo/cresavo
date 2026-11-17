import { diffDays } from "../data/dates";
import type { Customer, DateKey, DemoState } from "../data/types";
import type { MessageKey } from "../i18n";
import type { CustomerStats } from "../selectors";

// Reusable customer segments. The customer list uses them as filters; the
// marketing studio can offer the same lists as campaign audiences.

export type SegmentId = "notSeen" | "regulars" | "newThisYear" | "birthdayThisMonth";

/** About three months. */
export const NOT_SEEN_DAYS = 91;

/** Customers who have visited before, have nothing booked and were last here over three months ago. */
export function notSeenInThreeMonths(state: DemoState, stats: Map<string, CustomerStats>, today: DateKey): Customer[] {
  return state.customers.filter((c) => {
    const s = stats.get(c.id);
    return !!s?.lastVisit && !s.nextBooking && diffDays(today, s.lastVisit) > NOT_SEEN_DAYS;
  });
}

export function regulars(state: DemoState): Customer[] {
  return state.customers.filter((c) => c.isRegular);
}

/** Customers whose first visit or sign-up falls in the current calendar year. */
export function newThisYear(state: DemoState, today: DateKey): Customer[] {
  return state.customers.filter((c) => c.since.slice(0, 4) === today.slice(0, 4));
}

export function birthdayThisMonth(state: DemoState, today: DateKey): Customer[] {
  return state.customers.filter((c) => c.birthday?.slice(5, 7) === today.slice(5, 7));
}

export interface Segment {
  id: SegmentId;
  label: MessageKey;
  select: (state: DemoState, stats: Map<string, CustomerStats>, today: DateKey) => Customer[];
}

export const SEGMENTS: Segment[] = [
  { id: "regulars", label: "segment.regulars", select: (state) => regulars(state) },
  { id: "notSeen", label: "segment.notSeen", select: notSeenInThreeMonths },
  { id: "newThisYear", label: "segment.newThisYear", select: (state, _stats, today) => newThisYear(state, today) },
  { id: "birthdayThisMonth", label: "segment.birthdayThisMonth", select: (state, _stats, today) => birthdayThisMonth(state, today) },
];

export function segmentCustomers(id: SegmentId, state: DemoState, stats: Map<string, CustomerStats>, today: DateKey): Customer[] {
  return SEGMENTS.find((segment) => segment.id === id)!.select(state, stats, today);
}
