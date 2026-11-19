import { DateTime } from "luxon";
import { formatTime } from "../data/dates";
import type { Booking, Salon, Service, Staff } from "../data/types";
import { t } from "../i18n";
import { SALON_TIMEZONE } from "../tools/clock";

const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

export function icsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

interface CalendarVisit {
  booking: Booking;
  service: Service;
  salon: Salon;
}

function eventDetails({ booking, service, salon }: CalendarVisit) {
  const start = DateTime.fromISO(`${booking.date}T${formatTime(booking.start)}`, { zone: SALON_TIMEZONE });
  return {
    start: icsTimestamp(start.toJSDate()),
    end: icsTimestamp(start.plus({ minutes: booking.duration }).toJSDate()),
    title: t("booking.calendarTitle", { service: service.name, salon: salon.name }),
    location: `${salon.name}, ${salon.address}, ${salon.area}`,
  };
}

export function googleCalendarLink(visit: CalendarVisit): string {
  const event = eventDetails(visit);
  const query = new URLSearchParams({
    action: "TEMPLATE", text: event.title, dates: `${event.start}/${event.end}`,
    stz: SALON_TIMEZONE, etz: SALON_TIMEZONE, location: event.location,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${query}`;
}

export function buildIcs(input: CalendarVisit & { staff: Staff; createdAt: string }): string {
  const event = eventDetails(input);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking//Appointment//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${input.booking.id}@${input.salon.slug}.example`,
    `DTSTAMP:${input.createdAt}`,
    `DTSTART:${event.start}`,
    `DTEND:${event.end}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(t("booking.withStaff", { name: input.staff.firstName }))}`,
    `LOCATION:${escape(event.location)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(t("booking.calendarReminder"))}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
