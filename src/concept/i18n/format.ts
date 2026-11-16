import { diffDays, fromKey, weekday } from "../data/dates";
import type { DateKey } from "../data/types";
import { locale, t, tc, words } from "./index";

/** "Monday 16 November" */
export function formatDayLong(key: DateKey): string {
  const d = fromKey(key);
  return `${words.weekdays[d.getDay()]} ${d.getDate()} ${words.months[d.getMonth()]}`;
}

/** "Mon 16 Nov" */
export function formatDayShort(key: DateKey): string {
  const d = fromKey(key);
  return `${words.weekdaysShort[d.getDay()]} ${d.getDate()} ${words.monthsShort[d.getMonth()]}`;
}

/** "16 Nov 2026" */
export function formatDate(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()} ${words.monthsShort[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatMonth(month: string, short = false): string {
  const index = Number(month.slice(5, 7)) - 1;
  return (short ? words.monthsShort : words.months)[index];
}

export function weekdayName(key: DateKey): string {
  return words.weekdays[weekday(key)];
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

export function formatMoney(amount: number): string {
  return t("money", { amount: Math.round(amount).toLocaleString(locale) });
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** "16 Nov" */
export function formatDayMonth(key: DateKey): string {
  const d = fromKey(key);
  return `${d.getDate()} ${words.monthsShort[d.getMonth()]}`;
}

/** "Today", "Tomorrow" or a short weekday such as "Thu". */
export function dayChipLabel(key: DateKey, today: DateKey): string {
  const diff = diffDays(key, today);
  return diff === 0 || diff === 1 ? relativeDay(key, today) : words.weekdaysShort[weekday(key)];
}
