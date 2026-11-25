import { formatMoney, formatTime } from "../i18n/format";
import { t, tc } from "../i18n";
import { addDays } from "../data/dates";
import { openingFor } from "../data/slots";
import type { DemoState } from "../data/types";
import { figuresFromBookings } from "../finance/figures";
import type { Clock } from "../finance/types";
import { dayBookings, findCustomer, finishedVisit, lowStock } from "../selectors";

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

/** The evening recap as shown and read: the day's totals, then tomorrow, then anything notable still waiting. Rules only. */
export function eveningRecap(state: DemoState, clock: Clock) {
  const facts = dayFacts(state, clock);
  const text = daySummaryText(facts, state.localization.currency);
  const tomorrow = addDays(clock.today, 1);
  const upcoming = dayBookings(state, tomorrow);
  const first = upcoming[0];
  const name = findCustomer(state, first?.customerId)?.firstName ?? "";
  const tomorrowLine = first
    ? tc("summary.tomorrowStarts", upcoming.length, { name, time: formatTime(first.start) })
    : t("summary.tomorrowEmpty");
  const cancelled = figuresFromBookings(state, { start: clock.today, end: tomorrow }, clock).cancelled;
  const highlights = [
    tc("summary.noShows", facts.noShows),
    tc("summary.cancelled", cancelled),
    tc("summary.newCustomers", facts.newCustomers),
    tc("summary.missingJournals", facts.missingJournals),
    tomorrowLine,
  ];
  const waiting = state.inbox.filter((item) => !item.handled && (item.kind === "request" || item.kind === "reschedule")).length;
  if (waiting) highlights.push(tc("brief.waiting", waiting));
  if (state.modules.stock) {
    const stock = lowStock(state).length;
    if (stock) highlights.push(tc("summary.lowStock", stock));
  }
  return { title: t("summary.title"), summary: text.summary, highlights };
}

const sentence = (text: string) => {
  const trimmed = text.trim();
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

/** The evening recap as one spoken paragraph: the title, the day's total, then each line. Nothing is added. */
export function eveningSpeech(recap: { title: string; summary: string; highlights: string[] }): string {
  return [recap.title, recap.summary, ...recap.highlights].filter((text) => text.trim()).map(sentence).join(" ");
}
