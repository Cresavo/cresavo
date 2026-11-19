import { DateTime } from "luxon";
import { DEFAULT_LOCALE, intlLocale, type Locale } from "./locale";
export function formatPrice(ore: number, locale: Locale = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
  }).format(ore / 100);
}

export function formatBookingTime(value: string | Date, locale: Locale = DEFAULT_LOCALE) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
export function readableDay(value: string, locale: Locale = DEFAULT_LOCALE) {
  const d = DateTime.fromISO(value, { zone: "Europe/Stockholm" });
  return d.isValid
    ? d.setLocale(locale).toFormat("cccc d MMMM yyyy")
    : locale === "en"
      ? "Choose a day"
      : "Välj en dag";
}
