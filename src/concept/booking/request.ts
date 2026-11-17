import { addDays, startOfWeek, weekday } from "../data/dates";
import type { DateKey, DemoState, StaffId } from "../data/types";
import { parseDate, parseTime } from "../intent/dates";
import { distance, matchNames } from "../intent/match";
import type { Period } from "./suggest";

// Reads a customer's free text ("foot care some afternoon next week with Anna") with the
// studio interpreter's date and name matching. Customers never see the owner's actions,
// so this is a small wrapper rather than a call to `interpretCommand`.

export interface BookingRequest {
  /** Treatment picked for the request; undefined when nothing matched. */
  serviceId?: string;
  /** Every treatment the words could mean, most booked first. More than one means "ask or assume". */
  serviceCandidates: string[];
  staffId?: StaffId;
  /** Inclusive search window. */
  from: DateKey;
  to: DateKey;
  period?: Period;
  /** Preferred start, minutes from midnight. */
  time?: number;
  /** True when no day was named ("as soon as possible", or nothing at all). */
  soonest: boolean;
}

type Source = Pick<DemoState, "services" | "staff" | "bookings">;

const KEYWORDS = [
  "today", "tomorrow", "morning", "afternoon", "evening", "next", "week", "weekend",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];
const FOOT_SYNONYM: [RegExp, string] = [/\b(pedicure|foot treatment|feet|toenails?)\b/g, "foot care"];
const SYNONYMS: [RegExp, string][] = [
  [/\b(asap|as soon as possible|earliest|first available|soonest)\b/g, "soonest"],
  [/\b(after work|after office|late)\b/g, "evening"],
  [/\bnxt\b/g, "next"],
];
const WINDOW_DAYS = 14;

/** Fixes one-letter typos in day and period words ("tomorow", "afternon"). */
function fixTypos(text: string): string {
  return text.replace(/[a-z]{5,}/g, (word) => {
    if (KEYWORDS.includes(word)) return word;
    const close = KEYWORDS.filter((k) => distance(word, k) === 1);
    return close.length === 1 ? close[0] : word;
  });
}

/** Foot words only mean "foot care" where the price list has foot care; a nail studio keeps "pedicure". */
function clean(input: string, source: Source): string {
  const lower = fixTypos(input.toLowerCase().replace(/[’']/g, "'").trim());
  const synonyms = source.services.some((s) => /foot care/i.test(s.name)) ? [FOOT_SYNONYM, ...SYNONYMS] : SYNONYMS;
  return synonyms.reduce((text, [pattern, to]) => text.replace(pattern, to), lower);
}

function popularity(source: Source, serviceId: string) {
  return source.bookings.filter((b) => b.serviceId === serviceId).length;
}

function pickService(text: string, source: Source) {
  const matches = matchNames(text, source.services);
  const candidates = [...matches].sort((a, b) => popularity(source, b.id) - popularity(source, a.id)).map((s) => s.id);
  return { serviceId: candidates[0], serviceCandidates: candidates };
}

function pickStaff(text: string, source: Source): StaffId | undefined {
  const named = text.match(/\b(?:with|by|from)\s+([a-z]+)/)?.[1];
  if (!named) return undefined;
  const found = matchNames(named, source.staff.map((s) => ({ id: s.id, name: s.firstName })));
  return found.length === 1 ? (found[0].id as StaffId) : undefined;
}

function pickWindow(text: string, today: DateKey): { from: DateKey; to: DateKey; soonest: boolean } {
  const context = { customers: [], services: [], staff: [], bookings: [], now: `${today}T12:00:00` };
  const named = parseDate(text, context);
  const nextWeek = /\bnext week\b/.test(text);
  const hasDay = /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}-\d{2}-\d{2})\b/.test(text);
  const soon = { from: today, to: addDays(today, WINDOW_DAYS), soonest: true };
  if (/\bweekend\b/.test(text)) {
    const saturday = addDays(today, (6 - weekday(today) + 7) % 7);
    return { from: saturday, to: saturday, soonest: false };
  }
  if (nextWeek && named) {
    const monday = addDays(startOfWeek(today), 7);
    let date = named;
    while (hasDay && date < monday) date = addDays(date, 7);
    return hasDay ? { from: date, to: date, soonest: false } : { from: monday, to: addDays(monday, 6), soonest: false };
  }
  if (/\bthis week\b/.test(text) && !hasDay) return { from: today, to: addDays(today, (7 - weekday(today)) % 7), soonest: false };
  if (named && hasDay && named >= today) return { from: named, to: named, soonest: false };
  return soon;
}

function pickPeriod(text: string): Period | undefined {
  if (/\bmorning\b/.test(text)) return "morning";
  if (/\bafternoon\b/.test(text)) return "afternoon";
  if (/\bevening\b/.test(text)) return "evening";
  return undefined;
}

/** "at 3" means 15:00 in a salon that opens at 09:00. */
function pickTime(text: string): number | undefined {
  const parsed = parseTime(text);
  if (!parsed) return undefined;
  const [hour, minute] = parsed.split(":").map(Number);
  return (hour < 8 ? hour + 12 : hour) * 60 + minute;
}

export function parseBookingRequest(input: string, source: Source, today: DateKey): BookingRequest {
  const text = clean(input, source);
  return {
    ...pickService(text, source),
    staffId: pickStaff(text, source),
    ...pickWindow(text, today),
    period: pickPeriod(text),
    time: pickTime(text),
  };
}
