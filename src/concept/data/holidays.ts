import type { Locale } from "@/lib/locale";
import { translate } from "../i18n";
import { addDays, diffDays, toKey, weekday } from "./dates";
import { footMassage } from "../packs/foot-massage";
import type { Pack } from "../packs/types";
import type { DateKey, Holiday } from "./types";

// Swedish holiday calendar with campaign ideas. The four featured services come from the industry pack.

export function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12);
}

/** The n:th weekday `wd` of a month (n = -1 means the last one). */
function nthWeekday(year: number, month: number, wd: number, n: number): DateKey {
  if (n > 0) {
    const first = toKey(new Date(year, month, 1, 12));
    const offset = (wd - weekday(first) + 7) % 7;
    return addDays(first, offset + (n - 1) * 7);
  }
  const last = toKey(new Date(year, month + 1, 0, 12));
  const offset = (weekday(last) - wd + 7) % 7;
  return addDays(last, -offset);
}

const HOLIDAY_KEYS = [
  "valentine-s-day", "easter", "mother-s-day", "midsummer", "father-s-day",
  "black-friday", "first-advent", "lucia", "christmas", "new-year",
] as const;
type HolidayKey = (typeof HOLIDAY_KEYS)[number];

function holidayText(language: Locale, key: HolidayKey) {
  return {
    name: translate(language, `fixture.holiday.${key}.name`),
    idea: translate(language, `fixture.holiday.${key}.idea`),
  };
}

function holidayKey(holiday: Holiday) {
  return HOLIDAY_KEYS.find((key) => holiday.id === `${key}-${holiday.date.slice(0, 4)}`);
}

export function holidayCopy(holiday: Holiday, language: Locale): Holiday {
  const key = holidayKey(holiday);
  return key ? { ...holiday, ...holidayText(language, key) } : holiday;
}

export function holidayNames(holiday: Holiday): string[] {
  const key = holidayKey(holiday);
  return key ? [holiday.name, holidayText("en", key).name, holidayText("sv", key).name] : [holiday.name];
}

function holidaysForYear(year: number, featured: Pack["featured"]): Holiday[] {
  const fixed = (m: number, d: number) => toKey(new Date(year, m - 1, d, 12));
  const easter = toKey(easterSunday(year));
  const christmas = fixed(12, 24);
  const firstAdvent = addDays(christmas, -weekday(christmas) - 21);
  // Black Friday: the Friday after the fourth Thursday of November.
  const blackFriday = addDays(nthWeekday(year, 10, 4, 4), 1);
  // Midsummer Eve: the Friday between 19 and 25 June.
  const midsummer = addDays(fixed(6, 19), (5 - weekday(fixed(6, 19)) + 7) % 7);
  const [f0, f1, f2, f3] = featured;
  const list: (Omit<Holiday, "id"> & { key: HolidayKey })[] = [
    { ...holidayText("en", "valentine-s-day"), key: "valentine-s-day", date: fixed(2, 14), serviceIds: [f2, f0], leadDays: 21 },
    { ...holidayText("en", "easter"), key: "easter", date: easter, serviceIds: [f1, f0], leadDays: 21 },
    { ...holidayText("en", "mother-s-day"), key: "mother-s-day", date: nthWeekday(year, 4, 0, -1), serviceIds: [f0, f2], leadDays: 21 },
    { ...holidayText("en", "midsummer"), key: "midsummer", date: midsummer, serviceIds: [f1, f0], leadDays: 28 },
    { ...holidayText("en", "father-s-day"), key: "father-s-day", date: nthWeekday(year, 10, 0, 2), serviceIds: [f3, f2], leadDays: 21 },
    { ...holidayText("en", "black-friday"), key: "black-friday", date: blackFriday, serviceIds: [f3, f1], leadDays: 10 },
    { ...holidayText("en", "first-advent"), key: "first-advent", date: firstAdvent, serviceIds: [f2, f0], leadDays: 14 },
    { ...holidayText("en", "lucia"), key: "lucia", date: fixed(12, 13), serviceIds: [f0], leadDays: 10 },
    { ...holidayText("en", "christmas"), key: "christmas", date: christmas, serviceIds: [f2, f1], leadDays: 28 },
    { ...holidayText("en", "new-year"), key: "new-year", date: fixed(1, 1), serviceIds: [f3], leadDays: 14 },
  ];
  return list.map(({ key, ...holiday }) => ({ ...holiday, id: `${key}-${holiday.date.slice(0, 4)}` }));
}

/** Holidays within the coming year, sorted. */
export function upcomingHolidays(today: DateKey, featured: Pack["featured"] = footMassage.featured, horizonDays = 365): Holiday[] {
  const year = Number(today.slice(0, 4));
  return [...holidaysForYear(year, featured), ...holidaysForYear(year + 1, featured)]
    .filter((h) => {
      const d = diffDays(h.date, today);
      return d >= 0 && d <= horizonDays;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
