import type { Customer, DateKey, DemoState } from "../../data/types";
import type { MessageKey } from "../../i18n";
import { dueBackList } from "../../customers/return-visits";
import { SEGMENTS, segmentCustomers, type SegmentId } from "../../customers/segments";
import type { CustomerStats } from "../../selectors";

export type CustomerFilter = "all" | "due" | SegmentId;

export const FILTERS: { value: CustomerFilter; label: MessageKey }[] = [
  { value: "all", label: "customers.filter.all" },
  { value: "due", label: "customers.filter.due" },
  ...SEGMENTS.map((segment) => ({ value: segment.id, label: segment.label })),
];

/** Customers per filter, each list sorted the way that filter is most useful. */
export function filterCustomers(state: DemoState, stats: Map<string, CustomerStats>, today: DateKey): Record<CustomerFilter, Customer[]> {
  const byName = (a: Customer, b: Customer) => a.firstName.localeCompare(b.firstName, "sv") || a.lastName.localeCompare(b.lastName, "sv");
  const byLastVisit = (a: Customer, b: Customer) => (stats.get(a.id)?.lastVisit ?? "").localeCompare(stats.get(b.id)?.lastVisit ?? "");
  const segment = (id: SegmentId) => segmentCustomers(id, state, stats, today);
  return {
    all: [...state.customers].sort(byName),
    due: dueBackList(state, stats, today).map((row) => row.customer),
    regulars: segment("regulars").sort(byName),
    notSeen: segment("notSeen").sort(byLastVisit),
    newThisYear: segment("newThisYear").sort((a, b) => b.since.localeCompare(a.since)),
    birthdayThisMonth: segment("birthdayThisMonth").sort((a, b) => (a.birthday ?? "").slice(5).localeCompare((b.birthday ?? "").slice(5))),
  };
}

export function isFilter(value: string | null): value is CustomerFilter {
  return FILTERS.some((f) => f.value === value);
}
