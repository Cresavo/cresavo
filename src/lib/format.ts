export function formatPrice(ore: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
  }).format(ore / 100);
}

export function formatBookingTime(value: string | Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
import { DateTime } from "luxon";
export function readableDay(value: string) {
  const d = DateTime.fromISO(value, { zone: "Europe/Stockholm" });
  return d.isValid
    ? d.setLocale("sv").toFormat("cccc d MMMM yyyy")
    : "Välj en dag";
}
