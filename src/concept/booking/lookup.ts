import type { Booking, Customer, DateKey, DemoState } from "../data/types";
import { hasSettlement } from "./protection";
import { changeRule } from "./policy";

/** Country codes whose numbers are written with a national trunk zero that international dialling drops: "+44 (0)7700 900123" is "+44 7700 900123". */
/** Country codes whose numbers are often written with the national trunk 0, as in "+44 (0)20". */
export const TRUNK_ZERO_CODES = ["44", "49", "45", "47", "358", "31", "32", "33", "39", "41", "43", "353"];

/**
 * One identity for a number, whatever its format: digits only, without the "00" or "+" international
 * prefix, the Swedish country code or trunk zero, so "070-174 06 50" equals "+46 70 174 06 50", and
 * "0044 7700 900123", "+44 (0)7700 900123" and "+44 7700 900123" are one number. A zero is dropped only straight after a country code, never inside a national number.
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  const international = phone.trim().startsWith("+") || digits.startsWith("00");
  digits = digits.replace(/^00/, "");
  const code = international ? TRUNK_ZERO_CODES.find((candidate) => digits.startsWith(candidate)) : undefined;
  if (code && digits[code.length] === "0") digits = code + digits.slice(code.length + 1);
  return digits.replace(/^46/, "").replace(/^0/, "");
}

const PHONE_INPUT = /^\+?[\d\s().-]+$/;
const digitsOnly = (phone: string) => phone.replace(/\D/g, "");

export function phoneMatches(phone: string, query: string): boolean {
  if (!PHONE_INPUT.test(query.trim())) return false;
  const digits = digitsOnly(query);
  if (!digits) return false;
  const stored = digitsOnly(phone);
  const wanted = normalizePhone(query);
  const normalized = normalizePhone(phone);
  if (stored.includes(digits) || (wanted.length >= 3 && normalized.includes(wanted))) return true;
  // A national number can appear with a different country prefix in a search. Limit
  // suffix matches to a long sequence and leave exact identity lookup unchanged.
  const national = (value: string) => value.replace(/^0(?!0)/, "");
  const q = national(digits);
  const number = national(stored);
  return Math.min(q.length, number.length) >= 7 && (number.endsWith(q) || q.endsWith(number));
}

/** A contact number can also be a landline when the owner enters it. */
export function isContactPhone(phone: string): boolean {
  const raw = phone.trim();
  const digits = digitsOnly(raw).replace(/^00/, "");
  return PHONE_INPUT.test(raw) && /^\d{7,15}$/.test(digits) && !/^(\d)\1+$/.test(digits);
}

/** Swedish mobile format or a plausible international number without a trunk zero. */
export function isMobilePhone(phone: string): boolean {
  const raw = phone.trim();
  if (!PHONE_INPUT.test(raw)) return false;
  const digits = digitsOnly(raw);
  const international = raw.startsWith("+") || digits.startsWith("00");
  const number = raw.startsWith("+") ? digits : digits.replace(/^00/, "");
  const swedish = international && number.startsWith("46");
  if (!international || swedish) {
    const national = (swedish ? number.slice(2) : number).replace(/^0/, "");
    // PTS includes 078 in the mobile plan, with 0783 reserved.
    return /^7(?:[02369]\d|8[0-24-9])\d{6}$/.test(national) && !/^(\d)\1+$/.test(national.slice(2));
  }
  return /^[1-9]\d{7,14}$/.test(number) && !/^(\d)\1{6}$/.test(number.slice(-7));
}

export function customerDraft(query: string) {
  const value = query.trim();
  const isName = /\p{L}/u.test(value);
  return { name: isName ? value : "", phone: isName ? "" : value };
}

/** The customer with this number. When several stored numbers share one canonical key, the one written the same way wins. */
export function findCustomerByPhone(state: Pick<DemoState, "customers">, phone: string): Customer | undefined {
  const wanted = normalizePhone(phone);
  if (wanted.length < 7) return undefined;
  const matches = state.customers.filter((c) => normalizePhone(c.phone) === wanted);
  return matches.find((c) => digitsOnly(c.phone) === digitsOnly(phone)) ?? matches[0];
}

export interface CustomerBookings {
  upcoming: Booking[];
  past: Booking[];
}

export function customerBookings(state: Pick<DemoState, "bookings">, customerId: string, today: DateKey, minutes: number, instant?: number): CustomerBookings {
  const own = state.bookings.filter((b) => b.customerId === customerId);
  const isUpcoming = (b: Booking) => b.status === "booked" && changeRule(b, today, minutes, instant) !== "past";
  const byTime = (a: Booking, b: Booking) => a.date.localeCompare(b.date) || a.start - b.start;
  return {
    upcoming: own.filter(isUpcoming).sort(byTime),
    past: own
      .filter((b) => !isUpcoming(b) && (b.status !== "cancelled" || hasSettlement(b)))
      .sort((a, b) => byTime(b, a))
      .filter((booking, index) => index < 8 || hasSettlement(booking)),
  };
}
