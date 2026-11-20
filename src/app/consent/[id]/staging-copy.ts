import { intlLocale, type Locale } from "@/lib/locale";

// Customer copy for the split-mode staging channel. English source, Swedish translation.
const en = {
  title: "Approve booking proposal",
  intro: "Staging test with a fictional customer. No real messages or payments.",
  loading: "Loading the proposal…",
  invalid: "This link is invalid. Nothing was approved.",
  used: "This link has already been used. Nothing more was approved.",
  expired: "This proposal has expired. Nothing was approved.",
  unavailable: "The proposal could not be loaded. Nothing was approved. Open the link again to retry.",
  unconfirmed: "We could not confirm whether your decision was saved. It may have been approved. Open the link again to see its current status.",
  limited: "Too many attempts. This attempt changed nothing. Try again later.",
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
  unavailable: "Förslaget kunde inte läsas in. Inget godkändes. Öppna länken igen för att försöka på nytt.",
  unconfirmed: "Vi kunde inte bekräfta om ditt beslut sparades. Det kan ha godkänts. Öppna länken igen för att se aktuell status.",
  limited: "För många försök. Det här försöket ändrade ingenting. Försök igen senare.",
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

export type ConsentOutcome = "loading" | "ready" | "invalid" | "used" | "expired" | "unavailable" | "unconfirmed" | "limited" | "approved" | "declined";

/**
 * What the customer is told after a request to the decision endpoint. Only a definite
 * refusal from the salon may say that nothing was approved. A lost response, a server
 * error or an intermediary's error after an approve or decline is an unknown outcome:
 * the decision may have been committed.
 */
export function consentOutcome(phase: "view" | "yes" | "no", response: { status: number; state?: unknown } | "network-error"): Exclude<ConsentOutcome, "loading"> {
  if (response !== "network-error") {
    const { status, state } = response;
    if (status >= 200 && status < 300) return phase === "view" ? "ready" : phase === "yes" ? "approved" : "declined";
    if ((status === 409 || status === 410) && (state === "used" || state === "expired")) return state;
    if (status === 403) return "invalid";
    if (status === 429) return "limited";
  }
  // Viewing never approves, so a failed view is safe to report as such.
  return phase === "view" ? "unavailable" : "unconfirmed";
}
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
