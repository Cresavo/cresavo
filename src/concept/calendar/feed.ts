import { DateTime } from "luxon";
import { BRAND } from "../brand";
import { addDays } from "../data/dates";
import type { Booking, DemoState, StaffId } from "../data/types";
import { SALON_TIMEZONE } from "../tools/clock";
import { findService } from "../selectors";

// A read-only calendar feed of one person's work, for Google or Apple Calendar
// to subscribe to. It carries the treatment, the customer's FIRST name and the
// time: no phone, email, notes or last names, because the URL is a secret link
// that may end up in places a customer record never should.

const PAST_DAYS = 14;
const FUTURE_DAYS = 120;

const escapeText = (text: string) => text.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");

const utc = (date: string, minutes: number) =>
  DateTime.fromISO(date, { zone: SALON_TIMEZONE }).startOf("day").plus({ minutes }).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");

/** RFC 5545: lines are at most 75 octets, folded with CRLF + space, never inside a character. */
function fold(line: string): string {
  const parts: string[] = [];
  let part = "";
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > 75) {
      parts.push(part);
      part = " ";
      bytes = 1;
    }
    part += char;
    bytes += size;
  }
  parts.push(part);
  return parts.join("\r\n");
}

function event(state: DemoState, booking: Booking, stamp: string): string[] {
  const service = findService(state, booking.serviceId);
  const firstName = state.customers.find((c) => c.id === booking.customerId)?.firstName ?? "";
  const title = [service?.name ?? "Booking", firstName].filter(Boolean).join(" · ");
  return [
    "BEGIN:VEVENT",
    `UID:${booking.id}@${state.salon.slug}.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${utc(booking.date, booking.start)}`,
    `DTEND:${utc(booking.date, booking.start + booking.duration)}`,
    `SUMMARY:${escapeText(title)}`,
    `LOCATION:${escapeText(`${state.salon.name}, ${state.salon.address}, ${state.salon.area}`)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ];
}

/** The calendar file for one staff member: their bookings from two weeks back to four months ahead, cancelled and no-show ones left out. Null when there is no such person. */
export function buildStaffFeed(state: DemoState, staffId: StaffId | string, today: string, now: Date): string | null {
  const person = state.staff.find((s) => s.id === staffId);
  if (!person) return null;
  const from = addDays(today, -PAST_DAYS);
  const to = addDays(today, FUTURE_DAYS);
  const stamp = DateTime.fromJSDate(now, { zone: "utc" }).toFormat("yyyyLLdd'T'HHmmss'Z'");
  const bookings = state.bookings
    .filter((b) => b.staffId === person.id && (b.status === "booked" || b.status === "completed") && b.date >= from && b.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${BRAND.name}//Staff calendar//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`${state.salon.name} · ${person.firstName}`)}`,
    `X-WR-TIMEZONE:${SALON_TIMEZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...bookings.flatMap((b) => event(state, b, stamp)),
    "END:VCALENDAR",
    "",
  ]
    .map(fold)
    .join("\r\n");
}
