import { addDays, diffDays, startOfWeek, weekday } from "../data/dates";
import { freeGaps, isFree, openingFor } from "../data/slots";
import type { DemoState } from "../data/types";
import { buildCustomerStats, dayBookings, findCustomer, lowStock, utilisation } from "../selectors";
import { dueBackList } from "../customers/return-visits";
import { figuresFor } from "../finance/figures";
import { changeShare } from "../finance/overview";
import type { Clock } from "../finance/types";
import { t, tc } from "../i18n";
import { formatMoney, formatNumber, formatTime } from "../i18n/format";
import { needsMoving } from "../ops/needs-moving";
import { dayFacts, daySummaryText, summaryDue } from "../summary/day";
import { noticeItems } from "./brief-notices";

// Proactive briefs. Rules decide what matters and how much (cost 0); an AI
// model may only rephrase and reorder the same items (`phrase-brief`).

export type BriefKind = "morning" | "closing" | "weekly" | "events";

export interface BriefItem {
  id: string;
  text: string;
  /** Higher first. */
  priority: number;
  href?: string;
}

export interface Brief {
  kind: BriefKind;
  title: string;
  items: BriefItem[];
}

const HOLIDAY_DAYS = 14;
const MAX_ITEMS = 8;

const byPriority = (items: BriefItem[]) => [...items].sort((a, b) => b.priority - a.priority).slice(0, MAX_ITEMS);

/** Things that just happened or are about to: a cancellation today, stock running out, a holiday coming up. */
export function eventReactions(state: DemoState, clock: Clock): BriefItem[] {
  const items: BriefItem[] = [];
  const cancelled = state.bookings.filter((b) => b.status === "cancelled" && b.date === clock.today && b.start >= clock.minutes && isFree(state, b.staffId, b.date, b.start, b));
  for (const booking of cancelled.slice(0, 2)) {
    const name = findCustomer(state, booking.customerId)?.firstName ?? "";
    items.push({ id: `cancel-${booking.id}`, text: t("brief.cancelled", { name, time: formatTime(booking.start) }), priority: 5, href: "/studio/calendar" });
  }
  if (state.modules.stock) {
    for (const item of lowStock(state).slice(0, 2)) items.push({ id: `stock-${item.id}`, text: t("brief.lowStock", { name: item.name }), priority: 3, href: "/studio/more/stock" });
  }
  const holiday = [...state.holidays].sort((a, b) => a.date.localeCompare(b.date)).find((h) => h.date >= clock.today && diffDays(h.date, clock.today) <= HOLIDAY_DAYS);
  if (holiday && state.modules.campaigns) {
    items.push({ id: `holiday-${holiday.id}`, text: tc("brief.holiday", diffDays(holiday.date, clock.today), { name: holiday.name }), priority: 2, href: "/studio/more/campaigns" });
  }
  return items;
}

/** The start of the day: bookings, what needs attention, and the event reactions. */
export function morningBrief(state: DemoState, clock: Clock): Brief {
  const items: BriefItem[] = [];
  const bookings = dayBookings(state, clock.today);
  if (!openingFor(state.salon, clock.today)) items.push({ id: "closed", text: t("brief.closed"), priority: 6 });
  else if (bookings.length) {
    const first = bookings[0];
    items.push({ id: "bookings", text: tc("brief.bookings", bookings.length, { time: formatTime(first.start), name: findCustomer(state, first.customerId)?.firstName ?? "" }), priority: 6, href: "/studio/calendar" });
  }
  const moving = needsMoving(state, clock.today, clock.minutes).length;
  if (moving) items.push({ id: "needs-moving", text: tc("brief.needsMoving", moving), priority: 6, href: "/studio" });
  const waiting = state.inbox.filter((i) => !i.handled && (i.kind === "request" || i.kind === "reschedule")).length;
  if (waiting) items.push({ id: "inbox", text: tc("brief.waiting", waiting), priority: 4, href: "/studio/inbox" });
  const gaps = state.staff.flatMap((s) => freeGaps(state, s.id, clock.today, { after: clock.minutes, min: 30 })).length;
  if (gaps) items.push({ id: "gaps", text: tc("brief.gaps", gaps), priority: 2, href: "/studio/calendar" });
  const due = dueBackList(state, buildCustomerStats(state, clock.today), clock.today).length;
  if (due) items.push({ id: "due-back", text: tc("brief.dueBack", due), priority: 1, href: "/studio/customers/due-back" });
  // What customers did on the booking page leads. If a cancellation is also a still-free slot today,
  // keep the reaction that says so and do not also list the booking-page notice for the same visit.
  const reactions = eventReactions(state, clock);
  const freed = new Set(reactions.filter((item) => item.id.startsWith("cancel-")).map((item) => item.id.slice("cancel-".length)));
  // Omit those cancellations before the notice cap, so the "more" count and the first two lines stay honest.
  const notices = noticeItems(state, clock, freed).map(({ id, text, priority, href }) => ({ id, text, priority, href }));
  return { kind: "morning", title: t("brief.morning"), items: byPriority([...items, ...notices, ...reactions]) };
}

/** The brief as one spoken paragraph: the title, then each item as its own sentence. Nothing is added. */
export function briefSpeech(brief: Brief): string {
  const sentence = (text: string) => {
    const trimmed = text.trim();
    return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  };
  const lines = brief.items.length ? brief.items.map((item) => item.text) : [t("assistant.brief.quiet")];
  return [brief.title, ...lines].filter((text) => text.trim()).map(sentence).join(" ");
}

/** After the last booking: the day in numbers, the same facts as the evening summary. */
export function closingBrief(state: DemoState, clock: Clock): Brief {
  const summary = daySummaryText(dayFacts(state, clock), state.localization.currency);
  return {
    kind: "closing",
    title: t("brief.closing"),
    items: [summary.summary, ...summary.highlights].map((text, i) => ({ id: `closing-${i}`, text, priority: MAX_ITEMS - i })),
  };
}

/** Last full week next to the week before it, and how full the coming week is. */
export function weeklyBrief(state: DemoState, clock: Clock): Brief {
  const thisWeek = startOfWeek(clock.today);
  const lastWeek = addDays(thisWeek, -7);
  const current = figuresFor(state, { start: lastWeek, end: thisWeek }, clock);
  const previous = figuresFor(state, { start: addDays(lastWeek, -7), end: lastWeek }, clock);
  const change = changeShare(current.revenue, previous.revenue);
  const items: BriefItem[] = [];
  if (state.modules.finance) {
    items.push({
      id: "revenue",
      text: change === null
        ? t("brief.weekRevenue", { amount: formatMoney(current.revenue) })
        : t("brief.weekRevenueChange", { amount: formatMoney(current.revenue), change: `${change >= 0 ? "+" : "−"}${formatNumber(Math.abs(change) * 100)}` }),
      priority: 5,
      href: "/studio/more/finance",
    });
  }
  items.push({ id: "visits", text: tc("brief.weekVisits", current.visits, { previous: previous.visits }), priority: 4 });
  if (current.noShows) items.push({ id: "no-shows", text: tc("brief.weekNoShows", current.noShows), priority: 3 });
  const ahead = utilisation(state, thisWeek, 7);
  items.push({ id: "this-week", text: t("brief.thisWeek", { percent: formatNumber(ahead * 100) }), priority: 2, href: "/studio/calendar" });
  return { kind: "weekly", title: t("brief.weekly"), items: byPriority(items) };
}

/** The brief that fits the moment: closing after the last booking, a weekly review on Mondays, otherwise the morning brief. */
export function currentBrief(state: DemoState, clock: Clock): Brief {
  if (summaryDue(state, clock)) return closingBrief(state, clock);
  if (weekday(clock.today) === 1 && clock.minutes < 10 * 60) return weeklyBrief(state, clock);
  return morningBrief(state, clock);
}

/** Keeps an AI phrasing only when it uses exactly the rule items: same ids, nothing invented, nothing dropped. */
export function applyPhrasing(brief: Brief, phrased: { headline: string; items: { id: string; text: string }[] }): Brief {
  const known = new Map(brief.items.map((item) => [item.id, item]));
  const ids = phrased.items.map((item) => item.id);
  if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) return brief;
  return { ...brief, title: phrased.headline, items: phrased.items.map((item) => ({ ...known.get(item.id)!, text: item.text })) };
}
