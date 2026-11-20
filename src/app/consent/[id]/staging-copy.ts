import { intlLocale, type Locale } from "@/lib/locale";

// Customer copy for the split-mode staging channel. English source, Swedish translation.
const en = {
  title: "Approve booking proposal",
  intro: "Staging test with a fictional customer. No real messages or payments.",
  loading: "Loading the proposal…",
  invalid: "This link is invalid. Nothing was approved.",
  used: "This link has already been used. Nothing more was approved.",
  expired: "This proposal has expired. Nothing was approved.",
  unchecked: "The proposal could not be shown, so its status could not be checked here. If you already answered, your answer was kept. Open the link from your message again to see the current status.",
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
  // Place descriptions by location ID. The salon's own name is a proper name and is not translated.
  locations: { "demo-location": "Fictional demo studio, Stockholm" } as Record<string, string>,
};
const sv: typeof en = {
  title: "Godkänn bokningsförslag",
  intro: "Stagingtest med en påhittad kund. Inga riktiga meddelanden eller betalningar.",
  loading: "Läser förslaget…",
  invalid: "Länken är ogiltig. Inget godkändes.",
  used: "Länken är redan använd. Inget mer godkändes.",
  expired: "Förslaget har gått ut. Inget godkändes.",
  unchecked: "Förslaget kunde inte visas, så dess status kunde inte kontrolleras här. Om du redan har svarat gäller ditt svar. Öppna länken i meddelandet igen för att se aktuell status.",
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
  locations: { "demo-location": "Påhittad demostudio, Stockholm" },
};
export type StagingCopy = typeof en;

export type ConsentOutcome = "loading" | "ready" | "invalid" | "used" | "expired" | "unchecked" | "unconfirmed" | "limited" | "approved" | "declined";

/** The proposal terms the page shows and approves. */
export type StagingView = {
  proposal: { serviceName: string; staff: { name: string }; start: string; durationMinutes: number; price: { amountMinor: number; currency: string }; expiresAt: string };
  proposalHash: string; customer: string;
  terms: { salonName: string; locationId: string; locationName: string; timeZone: string; currency: string };
};

const isText = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const isTime = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
function isZone(v: unknown) {
  if (!isText(v)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
}
type Loose = Record<string, unknown> | null | undefined;
const field = (v: unknown, key: string): unknown => (v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined);

/** The view response as the page needs it, or null when any shown or approved field is missing or invalid. */
export function parseStagingView(body: unknown): StagingView | null {
  const proposal = field(body, "proposal") as Loose, terms = field(body, "terms") as Loose;
  const price = field(proposal, "price") as Loose;
  const ok = proposal && terms && price &&
    isText(proposal.serviceName) && isText(field(proposal.staff, "name")) && isTime(proposal.start) && isTime(proposal.expiresAt) &&
    Number.isInteger(proposal.durationMinutes) && (proposal.durationMinutes as number) > 0 &&
    Number.isInteger(price.amountMinor) && (price.amountMinor as number) >= 0 && typeof price.currency === "string" && /^[A-Z]{3}$/.test(price.currency) &&
    typeof field(body, "proposalHash") === "string" && /^[a-f0-9]{64}$/.test(field(body, "proposalHash") as string) && isText(field(body, "customer")) &&
    isText(terms.salonName) && isText(terms.locationId) && isText(terms.locationName) && isZone(terms.timeZone) &&
    typeof terms.currency === "string" && /^[A-Z]{3}$/.test(terms.currency);
  return ok ? body as StagingView : null;
}

/** A response from the decision endpoint as the page saw it: status and parsed JSON body, if any. */
export type ConsentResponse = { status: number; body?: unknown; redirected?: boolean } | "network-error";

/**
 * What the customer is told after a request to the decision endpoint. "Nothing was approved"
 * (and "approved"/"declined") needs the salon's own JSON answer: a body an intermediary
 * substituted (an HTML error page, a login page) proves nothing. After Approve or Decline
 * anything else is an unknown outcome, since the decision may have been committed. A failed
 * view says only that the status could not be checked: a refresh after a decision, or the
 * retry the unknown outcome suggests, must not claim that nothing was approved.
 */
export function consentOutcome(phase: "view" | "yes" | "no", response: ConsentResponse): Exclude<ConsentOutcome, "loading"> {
  const unknown = phase === "view" ? "unchecked" : "unconfirmed";
  if (response === "network-error" || response.redirected) return unknown;
  const { status, body } = response;
  const error = field(body, "error"), state = field(body, "state");
  if (status === 200) {
    if (phase === "view") return parseStagingView(body) ? "ready" : unknown;
    const expected = phase === "yes" ? "approved" : "declined";
    return field(body, "status") === expected ? expected : unknown;
  }
  if (error === "consent_denied" && ((status === 409 && state === "used") || (status === 410 && state === "expired"))) return state;
  if (status === 429 && error === "consent_rate_limited") return "limited";
  if (status === 403 && error === "consent_denied" && state === undefined) return phase === "view" ? unknown : "invalid";
  return unknown;
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
