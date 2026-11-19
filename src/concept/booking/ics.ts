import type { Locale } from "@/lib/locale";
import type { Booking, Salon, Service, Staff } from "../data/types";
import { translate } from "../i18n";
import { serviceCopy } from "../i18n/salon-eko-copy";
import { FREE_CHANGE_HOURS, visitTime } from "./policy";
import { SALON_TIMEZONE } from "../tools/clock";

const escape = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

export function icsTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

interface CalendarVisit {
  booking: Booking;
  service: Service;
  salon: Salon;
  language?: Locale;
}

function eventDetails({ booking, service, salon, language = "en" }: CalendarVisit) {
  const start = visitTime(booking);
  return {
    start: icsTimestamp(start.toJSDate()),
    end: icsTimestamp(start.plus({ minutes: booking.duration }).toJSDate()),
    title: translate(language, "booking.calendarTitle", { service: serviceCopy(service, language).name, salon: salon.name }),
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

/** A one-event calendar file with absolute timestamps and a reminder one hour before. */
export function buildIcs(input: CalendarVisit & { staff: Staff; createdAt: string }): string {
  const event = eventDetails(input);
  const { booking, salon, staff, createdAt, language = "en" } = input;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking//Appointment//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${booking.id}@${salon.slug}.example`,
    `DTSTAMP:${createdAt}`,
    `DTSTART:${event.start}`,
    `DTEND:${event.end}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(translate(language, "booking.ics.description", { staff: staff.firstName, hours: booking.protection?.terms.freeHours ?? FREE_CHANGE_HOURS }))}`,
    `LOCATION:${escape(event.location)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escape(translate(language, "booking.calendarReminder"))}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
