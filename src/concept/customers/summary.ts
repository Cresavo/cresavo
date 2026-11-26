import { diffDays } from "../data/dates";
import type { Customer, DemoState } from "../data/types";
import { getActiveLocale, translate, type MessageKey } from "../i18n";
import type { Locale } from "@/lib/locale";
import { findService } from "../selectors";

// The customer card's one-line summary. The facts are computed here from the
// demo data; the `summarize-customer` AI task phrases them, and the same rule
// text is the fallback when no AI key is configured.

export type TimeOfDay = "mornings" | "afternoons" | "evenings";

export interface CustomerFacts {
  sinceYear: number;
  regular: boolean;
  visits: number;
  /** Treatment they book most. */
  service: string | null;
  intervalWeeks: number | null;
  /** Short descriptors from the customer's tags, lower case. */
  traits: string[];
  prefersStaff: string | null;
  timeOfDay: TimeOfDay | null;
  note: string | null;
}

const NOT_TRAITS = new Set(["regular", "new", "imported"]);
const MIN_VISITS_FOR_HABITS = 3;
const HABIT_SHARE = 0.6;

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

function mostCommon<T>(values: T[]): { value: T; share: number } | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return count ? { value: value as T, share: count / values.length } : undefined;
}

const partOfDay = (start: number): TimeOfDay => (start < 12 * 60 ? "mornings" : start < 17 * 60 ? "afternoons" : "evenings");

export function buildCustomerFacts(state: DemoState, customer: Customer): CustomerFacts {
  const visits = state.bookings
    .filter((b) => b.customerId === customer.id && b.status === "completed")
    .sort((a, b) => a.date.localeCompare(b.date));
  const main = mostCommon(visits.map((b) => b.serviceId));
  const service = main && findService(state, main.value);
  const gaps = visits.slice(1).map((b, i) => diffDays(b.date, visits[i].date));
  const habits = visits.length >= MIN_VISITS_FOR_HABITS;
  const time = habits ? mostCommon(visits.map((b) => partOfDay(b.start))) : undefined;
  const staff = habits ? mostCommon(visits.map((b) => b.staffId)) : undefined;
  return {
    sinceYear: Number(customer.since.slice(0, 4)),
    regular: customer.isRegular,
    visits: visits.length,
    service: service?.name ?? null,
    intervalWeeks: service ? (habits && gaps.length ? Math.max(1, Math.round(median(gaps) / 7)) : service.recallWeeks) : null,
    traits: customer.tags.map((tag) => tag.toLowerCase()).filter((tag) => !NOT_TRAITS.has(tag)),
    prefersStaff: staff && staff.share >= HABIT_SHARE ? (state.staff.find((s) => s.id === staff.value)?.firstName ?? null) : null,
    timeOfDay: time && time.share >= HABIT_SHARE ? time.value : null,
    note: customer.note ?? null,
  };
}

const TIME_OF_DAY: Record<TimeOfDay, MessageKey> = {
  mornings: "customer.summary.mornings",
  afternoons: "customer.summary.afternoons",
  evenings: "customer.summary.evenings",
};

/** Rule-based summary: the facts as one short line, in the given language (or the Studio's current one). */
export function summarizeFallback(facts: CustomerFacts, lang: Locale = getActiveLocale()): string {
  const time = facts.timeOfDay ? translate(lang, TIME_OF_DAY[facts.timeOfDay]) : null;
  const preferences = [facts.prefersStaff, time].filter(Boolean).join(", ");
  const parts = [
    translate(lang, facts.regular ? "customer.summary.regularSince" : "customer.summary.customerSinceYear", { year: String(facts.sinceYear) }),
    facts.service && facts.intervalWeeks ? translate(lang, "customer.summary.everyWeeks", { service: facts.service.toLowerCase(), weeks: facts.intervalWeeks }) : facts.visits ? null : translate(lang, "customer.summary.noVisits"),
    ...facts.traits,
    preferences ? translate(lang, "customer.summary.prefers", { preferences }) : null,
  ];
  return `${parts.filter(Boolean).join(", ")}.`;
}
