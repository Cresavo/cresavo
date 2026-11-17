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
  const list: Omit<Holiday, "id">[] = [
    { name: "Valentine's Day", date: fixed(2, 14), idea: "Gift cards for two: something nice to give someone you love.", serviceIds: [f2, f0], leadDays: 21 },
    { name: "Easter", date: easter, idea: "Spring refresh: book before the season starts.", serviceIds: [f1, f0], leadDays: 21 },
    { name: "Mother's Day", date: nthWeekday(year, 4, 0, -1), idea: "A gift card to give mum a break.", serviceIds: [f0, f2], leadDays: 21 },
    { name: "Midsummer", date: midsummer, idea: "Summer is coming: book before the holidays.", serviceIds: [f1, f0], leadDays: 28 },
    { name: "Father's Day", date: nthWeekday(year, 10, 0, 2), idea: "A gift card for dad – 15% off gift cards.", serviceIds: [f3, f2], leadDays: 21 },
    { name: "Black Friday", date: blackFriday, idea: "Gift cards with 20% extra value – one weekend only.", serviceIds: [f3, f1], leadDays: 10 },
    { name: "First Advent", date: firstAdvent, idea: "Christmas gift tip: gift cards in a nice envelope, in the salon or online.", serviceIds: [f2, f0], leadDays: 14 },
    { name: "Lucia", date: fixed(12, 13), idea: "Lucia week: a warm welcome with mulled wine in the waiting room.", serviceIds: [f0], leadDays: 10 },
    { name: "Christmas", date: christmas, idea: "Last chance for gift cards – digital gift cards straight to the inbox.", serviceIds: [f2, f1], leadDays: 28 },
    { name: "New Year", date: fixed(1, 1), idea: "New year, new habits: punch card – 5 for the price of 4.", serviceIds: [f3], leadDays: 14 },
  ];
  return list.map((h) => ({ ...h, id: `${h.name.toLowerCase().replace(/[^a-z]+/g, "-")}-${h.date.slice(0, 4)}` }));
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
