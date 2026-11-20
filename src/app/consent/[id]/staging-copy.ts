import { intlLocale, type Locale } from "@/lib/locale";

// Customer copy for the split-mode staging channel. English source, Swedish translation.
const en = {
  title: "Approve booking proposal",
  intro: "Staging test with a fictional customer. No real messages or payments.",
  loading: "Loading the proposal…",
  invalid: "This link is invalid. Nothing was approved.",
  wrongOrigin: "This is not the salon's approval address, so the link was not used here. Nothing was sent or approved. Open the link from your message.",
  used: "This link has already been used. Nothing more was approved.",
  approvedEarlier: "This link has already been used: you approved this proposal. That records your earlier decision only; it does not show whether the booking was made or can still be made. This is not a booking confirmation.",
  declinedEarlier: "This link has already been used: the proposal was declined. Nothing was approved.",
  expired: "This proposal has expired. Nothing was approved.",
  unchecked: "The proposal could not be shown, so its status could not be checked here. Check the status again, or open the link from your message again.",
  unconfirmed: "We could not confirm whether your decision was saved. It may have been approved. Check the status again: the page then shows whether this proposal was approved or declined.",
  recheck: "Check status again",
  limited: "Too many attempts. This attempt changed nothing. Check the status again in a moment.",
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
  // A local time that occurs twice (the hour repeated when clocks go back) with its UTC offset.
  ambiguousTime: "{time} (UTC{offset})",
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
  wrongOrigin: "Det här är inte salongens adress för godkännanden, så länken användes inte här. Inget skickades eller godkändes. Öppna länken i meddelandet.",
  used: "Länken är redan använd. Inget mer godkändes.",
  approvedEarlier: "Länken är redan använd: du godkände förslaget. Det visar bara ditt tidigare beslut, inte om bokningen har gjorts eller fortfarande kan göras. Detta är ingen bokningsbekräftelse.",
  declinedEarlier: "Länken är redan använd: förslaget avböjdes. Inget godkändes.",
  expired: "Förslaget har gått ut. Inget godkändes.",
  unchecked: "Förslaget kunde inte visas, så dess status kunde inte kontrolleras här. Kontrollera statusen igen, eller öppna länken i meddelandet igen.",
  unconfirmed: "Vi kunde inte bekräfta om ditt beslut sparades. Det kan ha godkänts. Kontrollera statusen igen: sidan visar då om förslaget godkändes eller avböjdes.",
  recheck: "Kontrollera status igen",
  limited: "För många försök. Det här försöket ändrade ingenting. Kontrollera statusen igen om en stund.",
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
  ambiguousTime: "{time} (UTC{offset})",
  price: "Pris",
  currency: "Valuta",
  expires: "Godkänn senast",
  approve: "Godkänn denna bokning",
  decline: "Avböj",
  locations: { "demo-location": "Påhittad demostudio, Stockholm" },
};
export type StagingCopy = typeof en;

export type ConsentOutcome = "loading" | "ready" | "wrongOrigin" | "invalid" | "used" | "approvedEarlier" | "declinedEarlier" | "expired" | "unchecked" | "unconfirmed" | "limited" | "approved" | "declined";

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
    // One currency: the amount is shown, labelled and approved in the proposal's own currency.
    terms.currency === price.currency;
  return ok ? body as StagingView : null;
}

/**
 * The secret from the address bar, or null when this page is not on the configured consent origin.
 * Checked in the browser before anything is sent: on another origin the secret is never read.
 */
export function consentFragment(expectedOrigin: string, location: { origin: string; hash: string }) {
  return location.origin === expectedOrigin ? location.hash.slice(1) : null;
}

/** Outcomes after which the page offers to read the status again with the secret still in memory. */
export const recheckable = (outcome: ConsentOutcome) => outcome === "unconfirmed" || outcome === "unchecked" || outcome === "limited";

/** Seconds from a `Retry-After` header, bounded to 15 minutes; 0 when missing or not a number. */
export function retryAfterSeconds(value: string | null | undefined) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), 900) : 0;
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
  if (error === "consent_denied" && status === 410 && state === "expired") return "expired";
  if (error === "consent_denied" && status === 409 && state === "used") {
    // The decision recorded with the link, so a lost response can be resolved.
    const decision = field(body, "decision");
    return decision === "approved" ? "approvedEarlier" : decision === "declined" ? "declinedEarlier" : "used";
  }
  if (status === 429 && error === "consent_rate_limited") return "limited";
  if (status === 403 && error === "consent_denied" && state === undefined) return phase === "view" ? unknown : "invalid";
  return unknown;
}
export const stagingCopy: Record<Locale, StagingCopy> = { en, sv };

// The wall-clock reading of an instant in a zone, to the minute.
const wall = (timeZone: string, at: Date) => new Intl.DateTimeFormat("en-GB", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(at);

/**
 * True when the same local date and time also names another instant in this zone: the hour that
 * repeats when clocks go back (30-minute and 2-hour shifts included). Both instants would otherwise
 * read the same on the page although the proposal binds one of them.
 */
export function isAmbiguousLocalTime(timeZone: string, at: Date) {
  const shown = wall(timeZone, at);
  return [30, 60, 120].some(minutes => [-1, 1].some(sign => wall(timeZone, new Date(+at + sign * minutes * 60_000)) === shown));
}

/** The zone's offset from UTC at this instant, as "+02:00" or "-03:30". */
export function utcOffset(timeZone: string, at: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(at).map(p => [p.type, p.value]));
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const minutes = Math.round((local - Math.floor(+at / 1000) * 1000) / 60_000);
  const sign = minutes < 0 ? "-" : "+", abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

/** One formatter for the page and the staging runner, so both read the same displayed terms. */
export function formatStagingTerms(locale: Locale, timeZone: string, terms: { start: string; expiresAt: string; amountMinor: number; currency: string }) {
  const tag = intlLocale(locale);
  const at = new Date(terms.start), until = new Date(terms.expiresAt);
  // Only a repeated local time carries its offset; every other time reads as before.
  const exact = (text: string, instant: Date) => isAmbiguousLocalTime(timeZone, instant)
    ? stagingCopy[locale].ambiguousTime.replace("{time}", text).replace("{offset}", utcOffset(timeZone, instant)) : text;
  // Seconds are shown when the instant has any: an expiry of 10:15:30 must not read "10:15", a
  // deadline that would look already passed. Shown seconds are rounded down, never later than real.
  const style = (instant: Date) => instant.getUTCSeconds() || instant.getUTCMilliseconds() ? "medium" as const : "short" as const;
  return {
    date: new Intl.DateTimeFormat(tag, { timeZone, dateStyle: "full" }).format(at),
    time: exact(new Intl.DateTimeFormat(tag, { timeZone, timeStyle: style(at) }).format(at), at),
    expires: exact(new Intl.DateTimeFormat(tag, { timeZone, dateStyle: "medium", timeStyle: style(until) }).format(until), until),
    price: new Intl.NumberFormat(tag, { style: "currency", currency: terms.currency }).format(terms.amountMinor / 100),
  };
}
