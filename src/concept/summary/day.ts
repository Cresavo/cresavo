import { formatMoney } from "../i18n/format";
import { t, tc } from "../i18n";
import { addDays } from "../data/dates";
import { openingFor } from "../data/slots";
import type { DemoState } from "../data/types";
import { figuresFromBookings } from "../finance/figures";
import type { Clock } from "../finance/types";
import { dayBookings, findCustomer, finishedVisit } from "../selectors";

/** What the `daily-summary` task is told about the day. Only numbers and one first name. */
export interface DayFacts {
  revenueSek: number;
  visits: number;
  noShows: number;
  newCustomers: number;
  /** Visits today with no journal entry yet (0 while the journal is switched off). */
  missingJournals: number;
  tomorrowFirstCustomer: string | null;
}

export function dayFacts(state: DemoState, { today, minutes }: Clock): DayFacts {
  const tomorrow = addDays(today, 1);
  const figures = figuresFromBookings(state, { start: today, end: tomorrow }, { today, minutes });
  const journaled = (customerId: string, bookingId: string) =>
    state.journals.some((j) => j.bookingId === bookingId || (j.customerId === customerId && j.date === today));
  const missingJournals = state.modules.journal
    ? dayBookings(state, today).filter((b) => finishedVisit(b, today, minutes) && !journaled(b.customerId, b.id)).length
    : 0;
  const first = dayBookings(state, tomorrow)[0];
  return {
    revenueSek: figures.revenue,
    visits: figures.visits,
    noShows: figures.noShows,
    newCustomers: figures.newCustomers,
    missingJournals,
    tomorrowFirstCustomer: findCustomer(state, first?.customerId)?.firstName ?? null,
  };
}

export function daySummaryText(facts: DayFacts, currency: string) {
  return {
    summary: t("summary.revenue", { amount: formatMoney(facts.revenueSek, currency), visits: tc("command.revenue.visits", facts.visits) }),
    highlights: [
      tc("summary.noShows", facts.noShows),
      tc("summary.newCustomers", facts.newCustomers),
      tc("summary.missingJournals", facts.missingJournals),
      facts.tomorrowFirstCustomer ? t("summary.tomorrowFirst", { name: facts.tomorrowFirstCustomer }) : t("summary.tomorrowEmpty"),
    ],
  };
}

/** The summary is for the evening: the business is open today, had bookings, and the last one has ended. */
export function summaryDue(state: DemoState, { today, minutes }: Clock): boolean {
  if (!openingFor(state.salon, today)) return false;
  const bookings = dayBookings(state, today);
  return bookings.length > 0 && bookings.every((b) => b.start + b.duration <= minutes);
}
