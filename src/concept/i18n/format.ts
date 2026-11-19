import { intlLocale, type Locale } from "@/lib/locale";
import { diffDays, fromKey, weekday } from "../data/dates";
import type { DateKey } from "../data/types";
import { getActiveLocale, locale, t, tc, words } from "./index";
import { DEFAULT_CURRENCY } from "./business";

let currency = DEFAULT_CURRENCY;

export function setCurrency(next: string) {
  currency = next;
}

function dateText(key: DateKey, options: Intl.DateTimeFormatOptions, language = getActiveLocale()) {
  return new Intl.DateTimeFormat(intlLocale(language), options).format(fromKey(key));
}

export function formatDayLong(key: DateKey, language?: Locale): string {
  return dateText(key, { weekday: "long", day: "numeric", month: "long" }, language);
}

export function formatDayShort(key: DateKey, language?: Locale): string {
  return dateText(key, { weekday: "short", day: "numeric", month: "short" }, language);
}

export function formatDate(key: DateKey, language = getActiveLocale()): string {
  // Spell out the month so abbreviated or numeric Swedish dates are unambiguous.
  return dateText(key, { day: "numeric", month: language === "sv" ? "long" : "short", year: "numeric" }, language);
}

export function formatMonth(month: string, short = false): string {
  return dateText(`${month}-01`, { month: short ? "short" : "long" });
}

export function weekdayName(key: DateKey): string {
  return dateText(key, { weekday: "long" });
}

export function formatTime(minutes: number, language = getActiveLocale()): string {
  if (minutes === 24 * 60) return "24:00";
  return new Intl.DateTimeFormat(intlLocale(language), {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC",
  }).format(minutes * 60_000);
}

/** "Today", "Tomorrow", "Yesterday", "Thursday", "Mon 30 Nov" */
export function relativeDay(key: DateKey, today: DateKey): string {
  const diff = diffDays(key, today);
  if (diff === 0) return t("date.today");
  if (diff === 1) return t("date.tomorrow");
  if (diff === -1) return t("date.yesterday");
  if (diff > 1 && diff < 7) return weekdayName(key);
  return formatDayShort(key);
}

/** "3 weeks ago" */
export function agoText(key: DateKey, today: DateKey): string {
  const days = diffDays(today, key);
  if (days <= 0) return t("date.today").toLowerCase();
  if (days === 1) return t("date.yesterday").toLowerCase();
  if (days < 14) return tc("date.daysAgo", days);
  if (days < 63) return tc("date.weeksAgo", Math.round(days / 7));
  return tc("date.monthsAgo", Math.max(2, Math.round(days / 30.4)));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return t("time.minutes", { m: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t("time.hoursMinutes", { h, m }) : t("time.hours", { h });
}

export function formatMoney(amount: number, unit = currency, language = getActiveLocale()): string {
  return new Intl.NumberFormat(intlLocale(language), { style: "currency", currency: unit, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatAmount(value: number): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

export function formatDayMonth(key: DateKey): string {
  return dateText(key, { day: "numeric", month: "short" });
}

export function dayChipLabel(key: DateKey, today: DateKey): string {
  const diff = diffDays(key, today);
  return diff === 0 || diff === 1 ? relativeDay(key, today) : words.weekdaysShort[weekday(key)];
}

/** Estimated cost of AI calls in US dollars; null when the provider's price is unknown. */
export function formatUsd(amount: number | null): string {
  if (amount === null) return t("ai.costUnknown");
  return t("usd", { amount: formatNumber(amount, amount > 0 && amount < 0.01 ? 4 : 2) });
}
