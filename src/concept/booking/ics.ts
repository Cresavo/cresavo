import { formatTime } from "../data/dates";
import type { Booking, Salon, Service, Staff } from "../data/types";

const pad = (n: number) => String(n).padStart(2, "0");
const local = (key: string, minutes: number) => `${key.replace(/-/g, "")}T${formatTime(minutes).replace(":", "")}00`;
const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function icsTimestamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

interface IcsInput {
  booking: Booking;
  service: Service;
  staff: Staff;
  salon: Salon;
  /** UTC timestamp from `icsTimestamp()`. */
  createdAt: string;
}

/** A one-event calendar file in local ("floating") time with a reminder one hour before. */
export function buildIcs({ booking, service, staff, salon, createdAt }: IcsInput): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Salong Eko//Booking demo//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@${salon.slug}.example`,
    `DTSTAMP:${createdAt}`,
    `DTSTART:${local(booking.date, booking.start)}`,
    `DTEND:${local(booking.date, booking.start + booking.duration)}`,
    `SUMMARY:${escape(`${service.name} at ${salon.name}`)}`,
    `DESCRIPTION:${escape(`With ${staff.firstName}. Free to change or cancel until 24 hours before.`)}`,
    `LOCATION:${escape(`${salon.name}, ${salon.address}, ${salon.area}`)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Appointment in one hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
