import { addDays, monthKey } from "../data/dates";
import type { Booking, DateKey } from "../data/types";
import { shiftMonth } from "./periods";
import type { MonthFigures } from "./types";

const ARCHIVE_MONTHS = 20;
/** Share of the average month, January to December. */
const SEASON = [0.95, 0.97, 1.02, 1, 1.03, 0.95, 0.78, 0.88, 1.05, 1.05, 1, 1.08];
/** The business grows from 80% to 100% of today's level over the archive. */
const GROWTH_FROM = 0.8;
const VISITS_PER_CUSTOMER = 1.15;
const NEW_PER_MONTH = 12;
const CANCELLED_SHARE = 0.035;
const NO_SHOW_SHARE = 0.015;

/**
 * Invented monthly totals for the months before the bookings start, so that
 * "this March compared with last year" has something to compare with. They
 * follow the level of the real months in the data, with a quieter summer and
 * a business that grew over the period.
 */
export function makeMonthHistory(bookings: Booking[], today: DateKey, historyDays: number, next: () => number): MonthFigures[] {
  const historyStart = addDays(today, -historyDays);
  const thisMonth = monthKey(today);
  const full = new Map<string, { revenue: number; visits: number }>();
  for (const b of bookings) {
    const month = monthKey(b.date);
    if (b.status !== "completed" || b.date < historyStart || month >= thisMonth || `${month}-01` < historyStart) continue;
    const row = full.get(month) ?? { revenue: 0, visits: 0 };
    row.revenue += b.price;
    row.visits += 1;
    full.set(month, row);
  }
  const rows = [...full.values()];
  const average = (pick: (row: { revenue: number; visits: number }) => number) => (rows.length ? rows.reduce((sum, r) => sum + pick(r), 0) / rows.length : 0);
  const revenue = average((r) => r.revenue);
  const visits = average((r) => r.visits);

  const last = monthKey(historyStart);
  return Array.from({ length: ARCHIVE_MONTHS }, (_, i) => {
    const month = shiftMonth(last, i - ARCHIVE_MONTHS + 1);
    const factor = SEASON[Number(month.slice(5, 7)) - 1] * (GROWTH_FROM + ((1 - GROWTH_FROM) * i) / (ARCHIVE_MONTHS - 1)) * (0.96 + next() * 0.08);
    const monthVisits = Math.round(visits * factor);
    const newCustomers = Math.round(NEW_PER_MONTH * (0.7 + next() * 0.6));
    return {
      month,
      revenue: Math.round((revenue * factor) / 10) * 10,
      visits: monthVisits,
      cancelled: Math.round(monthVisits * CANCELLED_SHARE),
      noShows: Math.round(monthVisits * NO_SHOW_SHARE),
      newCustomers,
      returning: Math.max(0, Math.round(monthVisits / VISITS_PER_CUSTOMER) - newCustomers),
    };
  });
}
