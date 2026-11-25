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

/** The fields a booking-link page already has: no customer, notes, price or the internal booking id. */
export interface PublicCalendarVisit {
  id: string;
  treatment: string;
  date: string;
  start: number;
  duration: number;
  staffFirstName: string;
  salon: { name: string; slug: string; address: string; area?: string };
  language?: Locale;
  freeHours?: number;
}

function publicEventDetails(visit: PublicCalendarVisit) {
  const language = visit.language ?? "en";
  const start = visitTime(visit);
  return {
    start: icsTimestamp(start.toJSDate()),
    end: icsTimestamp(start.plus({ minutes: visit.duration }).toJSDate()),
    title: visit.salon.name
      ? translate(language, "booking.calendarTitle", { service: visit.treatment, salon: visit.salon.name })
      : visit.treatment,
    location: [visit.salon.name, visit.salon.address, visit.salon.area?.split(" · ")[0]].filter(Boolean).join(", "),
  };
}

export function publicGoogleCalendarLink(visit: PublicCalendarVisit): string {
  const event = publicEventDetails(visit);
  const query = new URLSearchParams({
    action: "TEMPLATE", text: event.title, dates: `${event.start}/${event.end}`,
    stz: SALON_TIMEZONE, etz: SALON_TIMEZONE, location: event.location,
  });
  return `https://calendar.google.com/calendar/r/eventedit?${query}`;
}

/** A one-event calendar file from the public booking-link fields, with a reminder one hour before. */
export function buildPublicIcs(input: PublicCalendarVisit & { createdAt: string }): string {
  const event = publicEventDetails(input);
  const { id, salon, staffFirstName, createdAt, language = "en", freeHours = FREE_CHANGE_HOURS } = input;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking//Appointment//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${id}@${salon.slug}.example`,
    `DTSTAMP:${createdAt}`,
    `DTSTART:${event.start}`,
    `DTEND:${event.end}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(translate(language, "booking.ics.description", { staff: staffFirstName, hours: freeHours }))}`,
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
