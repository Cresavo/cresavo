import { addDays, toKey, weekday } from "../data/dates";
import { easterSunday } from "../data/holidays";
import { openingFor } from "../data/slots";
import type { DateKey, Salon } from "../data/types";
import type { MessageKey } from "../i18n";

// The Swedish public holidays, offered as suggestions when the owner closes
// the salon. Nothing is closed automatically.

export interface PublicHoliday {
  date: DateKey;
  name: MessageKey;
}

function holidaysOf(year: number): PublicHoliday[] {
  const fixed = (month: number, day: number) => toKey(new Date(year, month - 1, day, 12));
  const easter = toKey(easterSunday(year));
  // Midsummer Eve is the Friday from 19 to 25 June; All Saints' Day the Saturday from 31 October to 6 November.
  const midsummerEve = addDays(fixed(6, 19), (5 - weekday(fixed(6, 19)) + 7) % 7);
  const allSaints = addDays(fixed(10, 31), (6 - weekday(fixed(10, 31)) + 7) % 7);
  return [
    { date: fixed(1, 1), name: "holiday.newYearsDay" },
    { date: fixed(1, 6), name: "holiday.epiphany" },
    { date: addDays(easter, -2), name: "holiday.goodFriday" },
    { date: easter, name: "holiday.easterSunday" },
    { date: addDays(easter, 1), name: "holiday.easterMonday" },
    { date: fixed(5, 1), name: "holiday.mayDay" },
    { date: addDays(easter, 39), name: "holiday.ascension" },
    { date: addDays(easter, 49), name: "holiday.whitsun" },
    { date: fixed(6, 6), name: "holiday.nationalDay" },
    { date: midsummerEve, name: "holiday.midsummerEve" },
    { date: addDays(midsummerEve, 1), name: "holiday.midsummerDay" },
    { date: allSaints, name: "holiday.allSaints" },
    { date: fixed(12, 24), name: "holiday.christmasEve" },
    { date: fixed(12, 25), name: "holiday.christmasDay" },
    { date: fixed(12, 26), name: "holiday.boxingDay" },
    { date: fixed(12, 31), name: "holiday.newYearsEve" },
  ];
}

/** Holidays from today onward (this and next year) that fall on a day the salon would otherwise be open. */
export function closureSuggestions(salon: Salon, today: DateKey, count = 8): PublicHoliday[] {
  const year = Number(today.slice(0, 4));
  return [...holidaysOf(year), ...holidaysOf(year + 1)]
    .filter((h) => h.date >= today && openingFor(salon, h.date))
    .slice(0, count);
}

/** The holiday on a date, if there is one: used to name a closure from "close on 24 December". */
export function holidayOn(date: DateKey): PublicHoliday | undefined {
  return holidaysOf(Number(date.slice(0, 4))).find((h) => h.date === date);
}
