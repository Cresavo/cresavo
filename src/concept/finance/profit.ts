import type { DemoState } from "../data/types";
import { monthFigures } from "./figures";
import { shiftMonth } from "./periods";
import type { Clock, Cost, CostKind } from "./types";

export const COST_KINDS: CostKind[] = ["rent", "products", "wages", "fees", "other"];

export function totalCosts(costs: Cost[]): number {
  return costs.reduce((sum, c) => sum + c.amount, 0);
}

/** Monthly costs added up per kind, in the fixed order of `COST_KINDS`, without empty kinds. */
export function costsByKind(costs: Cost[]): { kind: CostKind; amount: number }[] {
  return COST_KINDS.map((kind) => ({ kind, amount: totalCosts(costs.filter((c) => c.kind === kind)) })).filter((row) => row.amount > 0);
}

export interface MonthResult {
  month: string;
  revenue: number;
  costs: number;
  profit: number;
}

/** What was left of a full month after the monthly costs. */
export function monthResult(state: DemoState, month: string, clock: Clock): MonthResult {
  const revenue = monthFigures(state, month, clock).revenue;
  const costs = totalCosts(state.costs);
  return { month, revenue, costs, profit: revenue - costs };
}

/** The last full months, oldest first. */
export function recentResults(state: DemoState, clock: Clock, count: number): MonthResult[] {
  const last = shiftMonth(clock.today.slice(0, 7), -1);
  return Array.from({ length: count }, (_, i) => monthResult(state, shiftMonth(last, i - count + 1), clock));
}
