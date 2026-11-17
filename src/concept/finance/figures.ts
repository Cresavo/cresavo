import { addDays, diffDays } from "../data/dates";
import type { Booking, DemoState, StaffId } from "../data/types";
import { finishedVisit, utilisation } from "../selectors";
import { monthRange, rangeDays, type Range } from "./periods";
import type { Clock, Figures } from "./types";

const inRange = (b: Booking, range: Range) => b.date >= range.start && b.date < range.end;

/** A finished visit inside the range, respecting the "so far today" cut-off on its last day. */
export function countsIn(b: Booking, range: Range, { today, minutes }: Clock) {
  if (!inRange(b, range) || !finishedVisit(b, today, minutes)) return false;
  return range.untilMinutes === undefined || b.date !== addDays(range.end, -1) || b.start + b.duration <= range.untilMinutes;
}

const emptyFigures = (): Figures => ({ revenue: 0, visits: 0, cancelled: 0, noShows: 0, newCustomers: 0, returning: 0 });

function sumFigures(list: Figures[]): Figures {
  return list.reduce((total, f) => {
    for (const key of Object.keys(total) as (keyof Figures)[]) total[key] += f[key];
    return total;
  }, emptyFigures());
}

/** Totals counted from the bookings in the range. */
export function figuresFromBookings(state: DemoState, range: Range, clock: Clock): Figures {
  const figures = emptyFigures();
  const since = new Map(state.customers.map((c) => [c.id, c.since]));
  const visitors = new Set<string>();
  for (const b of state.bookings) {
    if (!inRange(b, range)) continue;
    if (b.status === "cancelled") figures.cancelled += 1;
    else if (b.status === "noshow") figures.noShows += 1;
    else if (countsIn(b, range, clock)) {
      figures.revenue += b.price;
      figures.visits += 1;
      visitors.add(b.customerId);
    }
  }
  figures.newCustomers = state.customers.filter((c) => c.since >= range.start && c.since < range.end).length;
  figures.returning = [...visitors].filter((id) => (since.get(id) ?? "") < range.start).length;
  return figures;
}

/** One month: the saved totals if the bookings do not reach back that far, otherwise counted. */
export function monthFigures(state: DemoState, month: string, clock: Clock): Figures {
  const saved = state.monthHistory.find((m) => m.month === month);
  return saved ?? figuresFromBookings(state, monthRange(month), clock);
}

export function figuresFor(state: DemoState, range: Range, clock: Clock): Figures {
  return range.months ? sumFigures(range.months.map((month) => monthFigures(state, month, clock))) : figuresFromBookings(state, range, clock);
}

/** Share of working time that is booked, per person and for everyone. */
export function occupancy(state: DemoState, range: Range) {
  const days = rangeDays(range);
  return {
    all: utilisation(state, range.start, days),
    byStaff: state.staff.map((s) => ({ id: s.id as StaffId, name: s.firstName, value: utilisation(state, range.start, days, s.id) })),
  };
}

/** Finished visits per treatment, most popular first. */
export function treatmentVisits(state: DemoState, range: Range, clock: Clock) {
  const counts = new Map<string, { visits: number; revenue: number }>();
  for (const b of state.bookings) {
    if (!countsIn(b, range, clock)) continue;
    const row = counts.get(b.serviceId) ?? { visits: 0, revenue: 0 };
    row.visits += 1;
    row.revenue += b.price;
    counts.set(b.serviceId, row);
  }
  return [...counts.entries()].map(([id, row]) => ({ id, ...row })).sort((a, b) => b.visits - a.visits || b.revenue - a.revenue);
}

/** What each day (or month, for a stretch of months) earned, for drawing next to the previous period. */
export function revenueSeries(state: DemoState, range: Range, clock: Clock): number[] {
  if (range.months) return range.months.map((month) => monthFigures(state, month, clock).revenue);
  const series = Array.from({ length: rangeDays(range) }, () => 0);
  for (const b of state.bookings) if (countsIn(b, range, clock)) series[diffDays(b.date, range.start)] += b.price;
  return series;
}

/** Revenue per hour of treatment time for each treatment, best first. Treatments with few visits are left out. */
export function earningsPerHour(state: DemoState, range: Range, clock: Clock, minVisits = 3) {
  const rows = new Map<string, { revenue: number; minutes: number; visits: number }>();
  for (const b of state.bookings) {
    if (!countsIn(b, range, clock)) continue;
    const row = rows.get(b.serviceId) ?? { revenue: 0, minutes: 0, visits: 0 };
    row.revenue += b.price;
    row.minutes += b.duration;
    row.visits += 1;
    rows.set(b.serviceId, row);
  }
  return [...rows.entries()]
    .filter(([, row]) => row.visits >= minVisits)
    .map(([id, row]) => ({ id, perHour: row.revenue / (row.minutes / 60), visits: row.visits }))
    .sort((a, b) => b.perHour - a.perHour);
}
