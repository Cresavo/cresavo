import { addDays, startOfWeek, weekday } from "../data/dates";
import type { DemoState } from "../data/types";
import { earningsPerHour, monthFigures } from "../finance/figures";
import { shiftMonth } from "../finance/periods";
import type { Clock } from "../finance/types";
import { t, words } from "../i18n";
import { formatDayMonth, formatMoney, formatNumber } from "../i18n/format";
import { normalize } from "../intent/match";
import { findService, utilisation } from "../selectors";

// Questions about the numbers. The answer is one number and a small chart.

export type InsightUnit = "money" | "percent" | "moneyPerHour";

export interface Insight {
  kind: "insight";
  title: string;
  value: string;
  note: string;
  chart: { type: "columns" | "bars"; unit: InsightUnit; data: { id: string; label: string; value: number; highlight?: boolean }[] };
}

const PER_HOUR_DAYS = 90;
const MIN_COMPARE_VISITS = 3;

const percent = (share: number) => t("format.percent", { value: formatNumber(share * 100) });
const signed = (change: number) => `${change >= 0 ? "+" : "−"}${t("format.percent", { value: formatNumber(Math.abs(change) * 100) })}`;

/** The month a name points at: this month or an earlier one, never one still to come. */
function monthNamed(name: string, today: string): string {
  const index = words.months.findIndex((m) => m.toLowerCase() === name);
  const year = Number(today.slice(0, 4));
  const current = Number(today.slice(5, 7));
  return `${index + 1 > current ? year - 1 : year}-${String(index + 1).padStart(2, "0")}`;
}

const monthLabel = (month: string) => `${words.months[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** "Compare March with last year", "compare this month with last month", "compare March with May". */
function compareMonths(state: DemoState, text: string, clock: Clock): Insight | null {
  if (!/\bcompar/.test(text)) return null;
  const month = (id: string) => (id === "this month" ? clock.today.slice(0, 7) : id === "last month" ? shiftMonth(clock.today.slice(0, 7), -1) : monthNamed(id, clock.today));
  const names = [...words.months.map((m) => m.toLowerCase()), "this month", "last month"];
  const found = [...text.matchAll(new RegExp(`\\b(${names.join("|")})\\b`, "g"))].map((m) => m[1]);
  if (!found.length) return null;
  const to = month(found[0]);
  const from = found.length > 1 && !/last year|year before/.test(text) ? month(found[1]) : shiftMonth(to, -12);
  const [a, b] = [monthFigures(state, from, clock).revenue, monthFigures(state, to, clock).revenue];
  const change = a ? b / a - 1 : 0;
  return {
    kind: "insight",
    title: t("insight.compare.title", { to: monthLabel(to), from: monthLabel(from) }),
    value: a ? signed(change) : t("insight.noFigures"),
    note: a && b ? t("insight.compare.note", { to: formatMoney(b), from: formatMoney(a) }) : t("insight.compare.missing"),
    chart: {
      type: "columns",
      unit: "money",
      data: [
        { id: from, label: monthLabel(from), value: a },
        { id: to, label: monthLabel(to), value: b, highlight: true },
      ],
    },
  };
}

/** "Which treatment earns the most per hour?" */
function bestPerHour(state: DemoState, text: string, clock: Clock): Insight | null {
  if (!/\b(per|an|each) hour\b|\bhourly\b/.test(text) || !/\b(earn|make|pay|worth|profitable)/.test(text)) return null;
  const range = { start: addDays(clock.today, -PER_HOUR_DAYS), end: addDays(clock.today, 1) };
  const rows = earningsPerHour(state, range, clock, MIN_COMPARE_VISITS);
  if (!rows.length) return null;
  const name = (id: string) => findService(state, id)?.name ?? id;
  return {
    kind: "insight",
    title: t("insight.perHour.title", { name: name(rows[0].id) }),
    value: t("insight.perHour.value", { amount: formatMoney(rows[0].perHour) }),
    note: t("insight.perHour.note", { days: PER_HOUR_DAYS }),
    chart: { type: "bars", unit: "moneyPerHour", data: rows.map((r) => ({ id: r.id, label: name(r.id), value: r.perHour })) },
  };
}

/** "How busy is Erik next week?" */
function busyWeek(state: DemoState, text: string, clock: Clock): Insight | null {
  if (!/\b(busy|booked|full)\b/.test(text) || !/\bweek\b/.test(text)) return null;
  const person = state.staff.find((s) => new RegExp(`\\b${s.firstName.toLowerCase()}\\b`).test(text));
  const start = addDays(startOfWeek(clock.today), /\bnext week\b/.test(text) ? 7 : 0);
  const share = utilisation(state, start, 7, person?.id);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return {
    kind: "insight",
    title: t("insight.busy.title", { who: person?.firstName ?? t("insight.busy.everyone"), when: /\bnext week\b/.test(text) ? t("insight.busy.next") : t("insight.busy.this") }),
    value: percent(share),
    note: t("insight.busy.note", { from: formatDayMonth(start), to: formatDayMonth(addDays(start, 6)) }),
    chart: {
      type: "columns",
      unit: "percent",
      data: days.map((day) => ({ id: day, label: words.weekdaysShort[weekday(day)], value: utilisation(state, day, 1, person?.id) })),
    },
  };
}

/** An answer when the text is a question about the numbers; null for anything else. */
export function insightFor(state: DemoState, input: string, clock: Clock): Insight | null {
  const text = normalize(input);
  return compareMonths(state, text, clock) ?? bestPerHour(state, text, clock) ?? busyWeek(state, text, clock);
}
