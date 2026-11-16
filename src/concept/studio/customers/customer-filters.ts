import { diffDays } from "../../data/dates";
import type { Customer, DateKey, DemoState } from "../../data/types";
import type { MessageKey } from "../../i18n";
import { lateCustomers, recallDue, type CustomerStats } from "../../selectors";

export type CustomerFilter = "all" | "regulars" | "due" | "late" | "new";

export const FILTERS: { value: CustomerFilter; label: MessageKey }[] = [
  { value: "all", label: "customers.filter.all" },
  { value: "regulars", label: "customers.filter.regulars" },
  { value: "due", label: "customers.filter.due" },
  { value: "late", label: "customers.filter.late" },
  { value: "new", label: "customers.filter.new" },
];

const NEW_WITHIN_DAYS = 60;

/** Customers per filter, each list sorted the way that filter is most useful. */
export function filterCustomers(state: DemoState, stats: Map<string, CustomerStats>, today: DateKey): Record<CustomerFilter, Customer[]> {
  const byName = (a: Customer, b: Customer) => a.firstName.localeCompare(b.firstName, "sv") || a.lastName.localeCompare(b.lastName, "sv");
  const byLastVisit = (a: Customer, b: Customer) => (stats.get(a.id)?.lastVisit ?? "").localeCompare(stats.get(b.id)?.lastVisit ?? "");
  return {
    all: [...state.customers].sort(byName),
    regulars: state.customers.filter((c) => c.isRegular).sort(byName),
    due: recallDue(state, stats, today).sort(byLastVisit),
    late: lateCustomers(state, stats, today).sort(byLastVisit),
    new: state.customers.filter((c) => diffDays(today, c.since) <= NEW_WITHIN_DAYS).sort((a, b) => b.since.localeCompare(a.since)),
  };
}

export function isFilter(value: string | null): value is CustomerFilter {
  return FILTERS.some((f) => f.value === value);
}
