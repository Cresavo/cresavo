import { DateTime } from "luxon";
import type { IntentContext } from "./types";

export function clock(context: IntentContext) {
  const now = DateTime.fromISO(context.now, { zone: context.timezone ?? "Europe/Stockholm" });
  if (!now.isValid) throw new Error("Invalid context.now or timezone");
  return now;
}

const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

const monthPattern = months.map(name => `${name}|${name.slice(0, 3)}`).join("|");

/** "24 December", "24th of dec" or "December 24": the next such day, this year or next. */
function calendarDate(text: string, now: DateTime): string | undefined {
  const match = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${monthPattern})\\b`)) ?? text.match(new RegExp(`\\b(${monthPattern})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (!match) return undefined;
  const [day, name] = /^\d/.test(match[1]) ? [match[1], match[2]] : [match[2], match[1]];
  const month = months.findIndex(full => full.startsWith(name.slice(0, 3)));
  const date = DateTime.fromObject({ year: now.year, month: month + 1, day: Number(day) }, { zone: now.zone });
  if (!date.isValid) return undefined;
  return (date < now.startOf("day") ? date.plus({ years: 1 }) : date).toISODate()!;
}

export function parseDate(text: string, context: IntentContext): string | undefined {
  const now = clock(context).startOf("day");
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return DateTime.fromISO(iso[1]).isValid ? iso[1] : undefined;
  if (/\btomorrow\b/.test(text)) return now.plus({ days: 1 }).toISODate()!;
  if (/\btoday\b/.test(text)) return now.toISODate()!;
  const calendar = calendarDate(text, now);
  if (calendar) return calendar;
  const day = weekdays.findIndex(name => new RegExp(`\\b${name}\\b`).test(text));
  if (day >= 0) {
    let days = (day + 1 - now.weekday + 7) % 7;
    if (days === 0 && /\bnext\b/.test(text)) days = 7;
    return now.plus({ days }).toISODate()!;
  }
  if (/\bnext week\b/.test(text)) return now.plus({ weeks: 1 }).startOf("week").toISODate()!;
}

export function parseTime(text: string): string | undefined {
  // A complete clock token takes precedence over a prefix followed by a bare hour.
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/);
  const bare = match ? undefined : text.match(/\b(?:at|to|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\s+(\d{1,2})\b/);
  if (!match && !bare) return undefined;
  let hour = Number(match?.[1] ?? match?.[4] ?? bare?.[1]);
  const minute = Number(match?.[2] ?? match?.[5] ?? 0);
  if (match?.[3]) {
    if (hour < 1 || hour > 12) return undefined;
    hour = hour % 12 + (match[3] === "pm" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function dateRange(text: string, context: IntentContext) {
  const now = clock(context);
  const month = months.findIndex(name => new RegExp(`\\b${name}\\b`).test(text));
  const unit = /\byear\b/.test(text) ? "year" : /\bweek\b/.test(text) ? "week" : /\btoday|\bday\b/.test(text) ? "day" : "month";
  let start = month >= 0 ? now.set({ month: month + 1, day: 1 }).startOf("day") : now.startOf(unit);
  if (month >= 0 && start < now.startOf("month") && !/last|earned|make|revenue/.test(text)) start = start.plus({ years: 1 });
  if (/\blast\b/.test(text)) start = start.minus({ [unit + "s"]: 1 });
  return { start: start.toISODate()!, end: start.plus({ [month >= 0 ? "months" : unit + "s"]: 1 }).toISODate()! };
}
