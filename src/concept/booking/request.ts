import { addDays, startOfWeek, weekday } from "../data/dates";
import type { DateKey, DemoState, StaffId } from "../data/types";
import { fixtureServiceAliases } from "../i18n/salon-eko-copy";
import { parseDate, parseTime } from "../intent/dates";
import { swedishDates } from "../intent/swedish";
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
const FOOT_SYNONYM: [RegExp, string] = [/\b(fotvård|pedicure|pedi|footcare|foot treatment|tired feet|feet|toenails?)\b/g, "foot care"];
const SYNONYMS: [RegExp, string][] = [
  [/\b(half[ -]an?[ -]hour massage|half[ -]hour massage|30[ -]minute massage)\b/g, "classic massage 30 min"],
  [/\b(hour[ -]long massage|60[ -]minute massage)\b/g, "classic massage 60 min"],
  [/\b(sports massage|firm massage)\b/g, "deep tissue massage"],
  [/\b(back rub|back massage|neck and shoulder massage)\b/g, "classic massage"],
  [/\b(before lunch|before noon|early in the day)\b/g, "morning"],
  [/\b(after lunch|after midday)\b/g, "afternoon"],
  [/\b(after i finish work|when i finish work|on my way home)\b/g, "evening"],
  [/\b(next available|first opening|any time available)\b/g, "soonest"],
  [/\bmon\b/g, "monday"], [/\btues?\b/g, "tuesday"], [/\bwed\b/g, "wednesday"],
  [/\bthu(?:rs)?\b/g, "thursday"], [/\bfri\b/g, "friday"], [/\bsat\b/g, "saturday"], [/\bsun\b/g, "sunday"],
  [/\b(around|about)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)\b/g, "at $2"],
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
function clean(input: string, source: Source, today: DateKey): string {
  const lower = fixTypos(swedishDates(input.toLowerCase().replace(/[’']/g, "'").trim()
    .replace(/\bi övermorgon\b/g, addDays(today, 2))
    .replace(/\b(?:på )?förmiddagen\b/g, "morning")
    .replace(/\b(?:på )?eftermiddagen\b/g, "afternoon")
    .replace(/\bhos\b/g, "with")
    .replace(/\b(?:kl\.?|klockan)\s+(?=\d)/g, "at ")));
  const dated = lower.replace(/\b(day after tomorrow|in two days|in 2 days)\b/g, addDays(today, 2));
  const synonyms = source.services.some((s) => fixtureServiceAliases(s).some((name) => /foot care/i.test(name))) ? [FOOT_SYNONYM, ...SYNONYMS] : SYNONYMS;
  return synonyms.reduce((text, [pattern, to]) => text.replace(pattern, to), dated);
}

function popularity(source: Source, serviceId: string) {
  return source.bookings.filter((b) => b.serviceId === serviceId).length;
}

function pickService(text: string, source: Source) {
  const aliases = source.services.flatMap((service) => fixtureServiceAliases(service).map((name) => ({ id: service.id, name })));
  const matches = new Set(matchNames(text, aliases).map((service) => service.id));
  const candidates = [...matches].sort((a, b) => popularity(source, b) - popularity(source, a));
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
  const nextWeek = /\bnext week\b/;
  const named = parseDate(text.replace(nextWeek, ""), context);
  const soon = { from: today, to: addDays(today, WINDOW_DAYS), soonest: true };
  if (/\bweekend\b/.test(text)) {
    const saturday = addDays(today, (6 - weekday(today) + 7) % 7);
    return { from: saturday, to: saturday, soonest: false };
  }
  if (nextWeek.test(text)) {
    const monday = addDays(startOfWeek(today), 7);
    if (!named) return { from: monday, to: addDays(monday, 6), soonest: false };
    let date = named;
    while (date < monday) date = addDays(date, 7);
    return { from: date, to: date, soonest: false };
  }
  if (/\bthis week\b/.test(text) && !named) return { from: today, to: addDays(today, (7 - weekday(today)) % 7), soonest: false };
  if (named && named >= today) return { from: named, to: named, soonest: false };
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
  const explicit = text.match(/\b\d{1,2}:\d{2}\s*(?:am|pm)?\b|\b\d{1,2}\s*(?:am|pm)\b/)?.[0];
  const parsed = parseTime(text);
  if (!parsed) return undefined;
  const [hour, minute] = parsed.split(":").map(Number);
  return (hour < 8 && !explicit ? hour + 12 : hour) * 60 + minute;
}

export function parseBookingRequest(input: string, source: Source, today: DateKey): BookingRequest {
  const text = clean(input, source, today);
  return {
    ...pickService(text, source),
    staffId: pickStaff(text, source),
    ...pickWindow(text, today),
    period: pickPeriod(text),
    time: pickTime(text),
  };
}
