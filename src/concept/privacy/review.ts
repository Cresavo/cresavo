import { fromKey, toKey } from "../data/dates";
import type { Customer, DateKey, DemoState } from "../data/types";
import { buildCustomerStats } from "../selectors";
import { RETENTION } from "./retention";

// The owner's retention reviews. Nothing here deletes anything: it only says
// who is due, and the owner decides (keep, delete to the trash, or erase).

function shiftYears(day: DateKey, years: number): DateKey {
  const date = fromKey(day);
  date.setFullYear(date.getFullYear() + years);
  return toKey(date);
}

function shiftMonths(day: DateKey, months: number): DateKey {
  const date = fromKey(day);
  const dayOfMonth = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return toKey(date);
}

export interface ReviewRow {
  customer: Customer;
  /** The last visit, or the day they were added when they never came. */
  lastActivity: DateKey;
  neverVisited: boolean;
}

/**
 * Customers whose last visit is `RETENTION.inactiveCustomerYears` or more ago,
 * oldest first. A customer with a booking ahead is never due, and one the
 * owner kept stays off the list for `RETENTION.reviewAgainMonths`.
 */
export function customersDueForReview(state: DemoState, today: DateKey): ReviewRow[] {
  const stats = buildCustomerStats(state, today);
  const limit = shiftYears(today, -RETENTION.inactiveCustomerYears);
  const rows: ReviewRow[] = [];
  for (const customer of state.customers) {
    const s = stats.get(customer.id);
    if (!s || s.nextBooking) continue;
    if (customer.keptOn && shiftMonths(customer.keptOn, RETENTION.reviewAgainMonths) > today) continue;
    const lastActivity = s.lastVisit ?? customer.since;
    if (lastActivity <= limit) rows.push({ customer, lastActivity, neverVisited: !s.lastVisit });
  }
  return rows.sort((a, b) => a.lastActivity.localeCompare(b.lastActivity) || a.customer.id.localeCompare(b.customer.id));
}

export interface JournalReviewRow {
  customer: Customer;
  entries: number;
  oldest: DateKey;
}

/** Customers with journal entries older than the owner's own retention setting, oldest first. Empty while no period is set. */
export function journalsPastRetention(state: DemoState, today: DateKey): JournalReviewRow[] {
  const years = state.privacy?.journalRetentionYears;
  if (typeof years !== "number") return [];
  const limit = shiftYears(today, -years);
  const rows = new Map<string, JournalReviewRow>();
  for (const entry of state.journals) {
    if (entry.date > limit) continue;
    const customer = state.customers.find((c) => c.id === entry.customerId);
    if (!customer) continue;
    const row = rows.get(customer.id);
    if (row) {
      row.entries += 1;
      if (entry.date < row.oldest) row.oldest = entry.date;
    } else {
      rows.set(customer.id, { customer, entries: 1, oldest: entry.date });
    }
  }
  return [...rows.values()].sort((a, b) => a.oldest.localeCompare(b.oldest) || a.customer.id.localeCompare(b.customer.id));
}

/** A valid journal period: a whole number of years the owner can pick, or null for "until I decide". */
export const validJournalYears = (years: unknown): years is number | null =>
  years === null || (typeof years === "number" && RETENTION.journalYearsChoices.includes(years));
