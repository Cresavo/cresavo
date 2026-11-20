import { intlLocale, type Locale } from "@/lib/locale";

// Customer copy for the split-mode staging channel. English source, Swedish translation.
const en = {
  title: "Approve booking proposal",
  intro: "Staging test with a fictional customer. No real messages or payments.",
  loading: "Loading the proposal…",
  invalid: "This link is invalid. Nothing was approved.",
  used: "This link has already been used. Nothing more was approved.",
  expired: "This proposal has expired. Nothing was approved.",
  failed: "The decision could not be saved. Nothing was approved. Open the link again to retry.",
  approved: "Approved. The assistant may now complete exactly this booking. This is not a booking confirmation.",
  declined: "Declined. Nothing was approved.",
  customer: "Customer",
  salon: "Salon",
  location: "Location",
  service: "Service",
  staff: "Staff",
  date: "Date",
  time: "Time",
  timeZone: "Time zone",
  duration: "Duration",
  minutes: "{n} minutes",
  price: "Price",
  currency: "Currency",
  expires: "Approve before",
  approve: "Approve this booking",
  decline: "Decline",
};
const sv: typeof en = {
  title: "Godkänn bokningsförslag",
  intro: "Stagingtest med en påhittad kund. Inga riktiga meddelanden eller betalningar.",
  loading: "Läser förslaget…",
  invalid: "Länken är ogiltig. Inget godkändes.",
  used: "Länken är redan använd. Inget mer godkändes.",
  expired: "Förslaget har gått ut. Inget godkändes.",
  failed: "Beslutet kunde inte sparas. Inget godkändes. Öppna länken igen för att försöka på nytt.",
  approved: "Godkänt. Assistenten kan nu slutföra exakt denna bokning. Detta är ingen bokningsbekräftelse.",
  declined: "Avböjt. Inget godkändes.",
  customer: "Kund",
  salon: "Salong",
  location: "Plats",
  service: "Tjänst",
  staff: "Personal",
  date: "Datum",
  time: "Tid",
  timeZone: "Tidszon",
  duration: "Längd",
  minutes: "{n} minuter",
  price: "Pris",
  currency: "Valuta",
  expires: "Godkänn senast",
  approve: "Godkänn denna bokning",
  decline: "Avböj",
};
export type StagingCopy = typeof en;
export const stagingCopy: Record<Locale, StagingCopy> = { en, sv };

/** One formatter for the page and the staging runner, so both read the same displayed terms. */
export function formatStagingTerms(locale: Locale, timeZone: string, terms: { start: string; expiresAt: string; amountMinor: number; currency: string }) {
  const tag = intlLocale(locale);
  const at = new Date(terms.start);
  return {
    date: new Intl.DateTimeFormat(tag, { timeZone, dateStyle: "full" }).format(at),
    time: new Intl.DateTimeFormat(tag, { timeZone, timeStyle: "short" }).format(at),
    expires: new Intl.DateTimeFormat(tag, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(terms.expiresAt)),
    price: new Intl.NumberFormat(tag, { style: "currency", currency: terms.currency }).format(terms.amountMinor / 100),
  };
}
