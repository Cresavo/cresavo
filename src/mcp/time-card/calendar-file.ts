import { z } from "zod";
import { DomainError } from "../../lib/errors";
import { readCardBookings } from "./recovery";

const escapeText = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const utc = (s: string) =>
  new Date(s)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
// RFC5545: fold at <=75 UTF-8 octets, never inside a code point.
export function foldCalendarLine(line: string) {
  const lines = [];
  let part = "",
    bytes = 0;
  for (const char of line) {
    const n = Buffer.byteLength(char);
    if (bytes + n > 75) {
      lines.push(part);
      part = " ";
      bytes = 1;
    }
    part += char;
    bytes += n;
  }
  lines.push(part);
  return lines.join("\r\n");
}
export function bookingCalendarFile(
  b: {
    id: string;
    serviceName: string;
    staffName: string;
    startsAt: string;
    duration: number;
    version: number;
  },
  now = new Date(),
) {
  const end = new Date(
    Date.parse(b.startsAt) + b.duration * 60000,
  ).toISOString();
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Booking Lab//Synthetic Demo//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(b.id)}@booking-lab.example.test`,
    `DTSTAMP:${utc(now.toISOString())}`,
    `SEQUENCE:${b.version}`,
    `DTSTART:${utc(b.startsAt)}`,
    `DTEND:${utc(end)}`,
    `SUMMARY:${escapeText(`${b.serviceName} hos ${b.staffName} – DEMO`)}`,
    `DESCRIPTION:${escapeText("Endast påhittade uppgifter. Ingen betalning eller utskick. Importerad kalenderpost uppdateras inte automatiskt; kontrollera bokningsstatus i Booking Lab.")}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ]
    .map(foldCalendarLine)
    .join("\r\n");
}
export const calendarFileSchema = z.object({ requestId: z.uuid() }).strict();
export async function getCardCalendarFile(input: unknown) {
  const args = calendarFileSchema.parse(input);
  const history = await readCardBookings(args);
  const item = history.items.find((i) => i.requestId === args.requestId);
  const receipt = item && "receipt" in item ? item.receipt : null;
  if (!receipt || receipt.status !== "confirmed")
    throw new DomainError("Ingen aktiv bokning att lägga i kalendern.", 409);
  return {
    demo: true,
    filename: "booking-lab-demo.ics",
    mimeType: "text/calendar;charset=utf-8",
    content: bookingCalendarFile(receipt),
    notice:
      "Kalenderfil, inte automatisk synk. Ingen kalenderinsättning är bekräftad.",
  };
}
