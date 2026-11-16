import { addDays, diffDays, toKey, weekday } from "./dates";
import type { DateKey, Holiday } from "./types";

// Swedish holiday calendar with campaign ideas for a foot care and massage salon.

function easterSunday(year: number): Date {
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

function holidaysForYear(year: number): Holiday[] {
  const fixed = (m: number, d: number) => toKey(new Date(year, m - 1, d, 12));
  const easter = toKey(easterSunday(year));
  const christmas = fixed(12, 24);
  const firstAdvent = addDays(christmas, -weekday(christmas) - 21);
  // Black Friday: the Friday after the fourth Thursday of November.
  const blackFriday = addDays(nthWeekday(year, 10, 4, 4), 1);
  // Midsummer Eve: the Friday between 19 and 25 June.
  const midsummer = addDays(fixed(6, 19), (5 - weekday(fixed(6, 19)) + 7) % 7);
  const list: Omit<Holiday, "id">[] = [
    { name: "Valentine's Day", date: fixed(2, 14), idea: "Gift cards for a massage for two or spa foot care.", serviceIds: ["relax-90", "spa-foot-care"], leadDays: 21 },
    { name: "Easter", date: easter, idea: "Spring feet: foot care before sandal season.", serviceIds: ["medical-foot-care", "spa-foot-care"], leadDays: 21 },
    { name: "Mother's Day", date: nthWeekday(year, 4, 0, -1), idea: "Spa foot care gift card – give mum a break.", serviceIds: ["spa-foot-care", "relax-90"], leadDays: 21 },
    { name: "Midsummer", date: midsummer, idea: "Summer feet: book before the holidays.", serviceIds: ["medical-foot-care", "basic-foot-care"], leadDays: 28 },
    { name: "Father's Day", date: nthWeekday(year, 10, 0, 2), idea: "Deep tissue massage as a gift – 15% off gift cards.", serviceIds: ["deep-tissue", "classic-60"], leadDays: 21 },
    { name: "Black Friday", date: blackFriday, idea: "Gift cards with 20% extra value – one weekend only.", serviceIds: ["classic-60", "medical-foot-care"], leadDays: 10 },
    { name: "First Advent", date: firstAdvent, idea: "Christmas gift tip: gift cards in a nice envelope, in the salon or online.", serviceIds: ["relax-90", "spa-foot-care"], leadDays: 14 },
    { name: "Lucia", date: fixed(12, 13), idea: "Lucia week: warm foot baths and mulled wine in the waiting room.", serviceIds: ["spa-foot-care"], leadDays: 10 },
    { name: "Christmas", date: christmas, idea: "Last chance for gift cards – digital gift cards straight to the inbox.", serviceIds: ["relax-90", "medical-foot-care"], leadDays: 28 },
    { name: "New Year", date: fixed(1, 1), idea: "New year, new habits: massage punch card – 5 for the price of 4.", serviceIds: ["classic-60"], leadDays: 14 },
  ];
  return list.map((h) => ({ ...h, id: `${h.name.toLowerCase().replace(/[^a-z]+/g, "-")}-${h.date.slice(0, 4)}` }));
}

/** Holidays within the coming year, sorted. */
export function upcomingHolidays(today: DateKey, horizonDays = 365): Holiday[] {
  const year = Number(today.slice(0, 4));
  return [...holidaysForYear(year), ...holidaysForYear(year + 1)]
    .filter((h) => {
      const d = diffDays(h.date, today);
      return d >= 0 && d <= horizonDays;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
