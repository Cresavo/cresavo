import type { DemoState } from "../data/types";
import { figuresFor, occupancy, revenueSeries, treatmentVisits } from "./figures";
import { periodRanges, type PeriodKey, type PeriodRanges } from "./periods";
import type { Clock, Figures } from "./types";

const TOP_TREATMENTS = 5;

/** Change from `previous` to `current` as a share (0.12 = 12% more); null when there is nothing to compare with. */
export function changeShare(current: number, previous: number): number | null {
  return previous > 0 ? current / previous - 1 : null;
}

export interface Overview {
  ranges: PeriodRanges;
  current: Figures;
  previous: Figures;
  /** Revenue per day (per month for the year view), for the chart. Empty for a single day. */
  series: { current: number[]; previous: number[] };
  occupancy: { current: ReturnType<typeof occupancy>; previous: ReturnType<typeof occupancy> };
  treatments: { id: string; visits: number; previous: number }[];
}

/** Everything the overview page shows for one period, each number next to the period before. */
export function buildOverview(state: DemoState, period: PeriodKey, clock: Clock): Overview {
  const ranges = periodRanges(period, clock);
  const popular = treatmentVisits(state, ranges.detailCurrent, clock);
  const before = new Map(treatmentVisits(state, ranges.detailPrevious, clock).map((row) => [row.id, row.visits]));
  const series = period === "day" ? { current: [], previous: [] } : { current: revenueSeries(state, ranges.current, clock), previous: revenueSeries(state, ranges.previous, clock) };
  return {
    ranges,
    current: figuresFor(state, ranges.current, clock),
    previous: figuresFor(state, ranges.previous, clock),
    series,
    occupancy: { current: occupancy(state, ranges.detailCurrent), previous: occupancy(state, ranges.detailPrevious) },
    treatments: popular.slice(0, TOP_TREATMENTS).map((row) => ({ id: row.id, visits: row.visits, previous: before.get(row.id) ?? 0 })),
  };
}
