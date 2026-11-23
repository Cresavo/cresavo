import { normalizePhone } from "../booking/lookup";
import { returnRedemptions } from "../giftcards/cards";
import { normalizeEmail } from "./csv";
import type { Booking, Customer, DemoState } from "../data/types";
import { t } from "../i18n";
import type { LogEntry } from "../log/types";
import type { CheckoutHold } from "../booking/protection";

// Erasure of one customer (GDPR art. 17), the final form of `customer/delete`.
// `customer/delete` moves a customer and their records to the trash for 30
// days so the owner can restore them. `customer/erase` removes the customer
// and their records for good, wherever they are (live or in the trash), takes
// the text and undo data out of every activity log entry that concerns them,
// and replaces their name, phone or email in other free text. Ids, slugs and
// settings are never rewritten. The erasure itself is not undoable.

/** The stable marker for redacted values in the store's audit data (`tenant_action`, `tenant_effect`); never shown in the studio. */
export const REDACTED = "[redacted]";

type Identity = Pick<Customer, "id" | "firstName" | "lastName" | "phone" | "email"> & Partial<Pick<Customer, "earlier">>;

/** Identifiers shorter than this are not scrubbed from free text, so a scrub never eats ordinary words. */
const MIN_IDENTIFIER = 5;

/**
 * The strings that identify a customer in free text: full name, phone (as
 * stored and as normalized digits) and email. Matching is case-insensitive.
 */
export function customerIdentifiers(customer: Identity): string[] {
  const name = `${customer.firstName} ${customer.lastName}`.trim().replace(/\s+/g, " ");
  const phone = customer.phone.trim();
  const digits = normalizePhone(phone);
  const earlier = (customer.earlier ?? []).flatMap((value) => [value.trim(), phoneDigits(value)]);
  const values = [name, phone, digits.length >= 7 ? digits : "", customer.email.trim(), ...earlier];
  // Longest first, so a full phone is replaced before its digits.
  return [...new Set(values.filter((value) => value.length >= MIN_IDENTIFIER))].sort((a, b) => b.length - a.length);
}

/** The normalized digits of every phone number the card has had. */
export function customerPhoneDigits(customer: Identity): Set<string> {
  return new Set([customer.phone, ...(customer.earlier ?? [])].map(phoneDigits).filter(Boolean));
}

/**
 * True when an online checkout in progress is this customer's: its phone is one
 * of theirs and either its address is theirs or its name is. A hold that only
 * shares a phone number (a family line) is someone else's and stays out of both
 * the export and the erasure.
 */
export function holdIsTheirs(hold: Pick<CheckoutHold, "guest">, customer: Identity): boolean {
  if (!customerPhoneDigits(customer).has(phoneDigits(hold.guest.phone))) return false;
  const emails = new Set([customer.email, ...(customer.earlier ?? [])].map(normalizeEmail).filter(Boolean));
  const names = new Set([`${customer.firstName} ${customer.lastName}`, ...(customer.earlier ?? [])].map((n) => n.trim().replace(/\s+/g, " ").toLowerCase()).filter(Boolean));
  const guestEmail = normalizeEmail(hold.guest.email);
  return (!!guestEmail && emails.has(guestEmail)) || names.has(hold.guest.name.trim().replace(/\s+/g, " ").toLowerCase());
}

/** The customer, live or in the trash. */
export function findErasable(state: DemoState, id: string): Customer | undefined {
  return state.customers.find((c) => c.id === id) ??
    state.trash.flatMap((entry) => (entry.kind === "customer" && entry.customer.id === id ? [entry.customer] : []))[0];
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matcher(identifiers: readonly string[]): RegExp | null {
  return identifiers.length ? new RegExp(identifiers.map(escapeRegExp).join("|"), "gi") : null;
}

/** Replaces every identifier in a string. */
export function scrubText(text: string, identifiers: readonly string[], replacement = REDACTED): string {
  const pattern = matcher(identifiers);
  return pattern ? text.replace(pattern, replacement) : text;
}

/** Replaces identifiers in every string of a JSON-like value. Unchanged parts keep their identity. */
export function scrubDeep<T>(value: T, identifiers: readonly string[], replacement = REDACTED): T {
  const pattern = matcher(identifiers);
  if (!pattern) return value;
  const walk = (item: unknown, depth: number): unknown => {
    if (typeof item === "string") return item.replace(pattern, replacement);
    if (!item || typeof item !== "object" || depth > 32) return item;
    if (Array.isArray(item)) {
      const next = item.map((entry) => walk(entry, depth + 1));
      return next.some((entry, i) => entry !== item[i]) ? next : item;
    }
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(item)) {
      const mapped = walk(entry, depth + 1);
      if (mapped !== entry) changed = true;
      next[key] = mapped;
    }
    return changed ? next : item;
  };
  return walk(value, 0) as T;
}

/** The normalized digits of a phone, or "" when too short to identify anyone. */
export function phoneDigits(phone: string): string {
  const digits = normalizePhone(phone);
  return digits.length >= 7 ? digits : "";
}

/**
 * True when a value names the customer: a record of theirs, a `customerId`,
 * a `phone` field with the same number in any format (as the booking lookup
 * normalizes it), or one of their identifiers in text.
 */
export function mentionsCustomer(value: unknown, id: string, identifiers: readonly string[], digits: string | ReadonlySet<string> = ""): boolean {
  const pattern = matcher(identifiers);
  const numbers = typeof digits === "string" ? new Set([digits].filter(Boolean)) : digits;
  const walk = (item: unknown, depth: number): boolean => {
    if (typeof item === "string") return !!pattern && item.search(pattern) >= 0;
    if (!item || typeof item !== "object" || depth > 32) return false;
    if (Array.isArray(item)) return item.some((entry) => walk(entry, depth + 1));
    const record = item as Record<string, unknown>;
    if (record.customerId === id || (record.id === id && "firstName" in record)) return true;
    if (numbers.size && typeof record.phone === "string" && numbers.has(normalizePhone(record.phone))) return true;
    return Object.values(record).some((entry) => walk(entry, depth + 1));
  };
  return walk(value, 0);
}

/** The marker the studio shows where erased text was, in the salon's language. */
export const erasedMarker = () => t("log.redacted");

/** Applies `edit` to the strings at a dot path (`*` = every array element). Unchanged parts keep their identity. */
function editAt(value: unknown, path: readonly string[], edit: (text: string) => string): unknown {
  if (!path.length) return typeof value === "string" ? edit(value) : value;
  if (!value || typeof value !== "object") return value;
  const [head, ...rest] = path;
  if (head === "*") {
    if (!Array.isArray(value)) return value;
    const next = value.map((item) => editAt(item, rest, edit));
    return next.some((item, i) => item !== value[i]) ? next : value;
  }
  if (Array.isArray(value) || !(head in value)) return value;
  const record = value as Record<string, unknown>;
  const mapped = editAt(record[head], rest, edit);
  return mapped === record[head] ? value : { ...record, [head]: mapped };
}

const INBOX_TEXT = ["title", "body", "fromName", "reply", "draftReply"];
const JOURNAL_TEXT = ["treatment", "observations", "advice", "nextVisit"];
const JOURNAL_FIELDS = [...JOURNAL_TEXT, ...JOURNAL_TEXT.map((field) => `versions.*.${field}`)];

/**
 * The free-text fields of the document that can mention a customer who is not
 * their owner: other customers' notes and journals, the name of the person a
 * visit or a checkout in progress is for, inbox text, reviews,
 * assistant memory, gift card recipients, support tickets, the booking page's
 * About text, and the same fields inside other customers' trash bundles. Only these are scrubbed;
 * ids, slugs, settings and other customers' contact fields never are.
 */
export const DOCUMENT_FREE_TEXT: Partial<Record<keyof DemoState, readonly string[]>> = {
  customers: ["*.note"],
  bookings: ["*.note", "*.cancelReason", "*.protection.decision.reason", "*.visitFor"],
  checkoutHolds: ["*.guest.visitFor"],
  journals: JOURNAL_FIELDS.map((field) => `*.${field}`),
  reviews: ["*.text", "*.reply"],
  inbox: INBOX_TEXT.map((field) => `*.${field}`),
  memory: ["*.text"],
  giftCards: ["*.recipient", "*.message"],
  tickets: ["*.question", "*.screen.*", "*.activity.*.summary"],
  page: ["about.heading", "about.text"],
  trash: [
    "*.customer.note", "*.bookings.*.note", "*.bookings.*.cancelReason", "*.bookings.*.visitFor", "*.reviews.*.text", "*.reviews.*.reply",
    ...JOURNAL_FIELDS.map((field) => `*.journals.*.${field}`), ...INBOX_TEXT.map((field) => `*.inbox.*.${field}`),
  ],
};

/**
 * A log entry that concerns the customer keeps only its type, time and actor:
 * its text becomes a generic sentence (a cancellation reason or an inbox title
 * is personal too) and its undo data is dropped.
 */
function scrubLogEntry(entry: LogEntry, id: string, identifiers: readonly string[], digits: ReadonlySet<string>): LogEntry {
  if (!mentionsCustomer(entry, id, identifiers, digits)) return entry;
  const rest: LogEntry = { ...entry, summary: t("log.erasedEntry") };
  delete rest.patch;
  delete rest.before;
  delete rest.after;
  return rest;
}

/** The delivery address of a visit is a field, not free text: it is cleared only where it is exactly one of these addresses (normalized), never by a substring. */
function withoutAddresses<T extends Pick<Booking, "contactEmail">>(bookings: T[], addresses: ReadonlySet<string>): T[] {
  if (!bookings.some((b) => b.contactEmail !== undefined && addresses.has(normalizeEmail(b.contactEmail)))) return bookings;
  return bookings.map((b) => (b.contactEmail !== undefined && addresses.has(normalizeEmail(b.contactEmail)) ? { ...b, contactEmail: undefined } : b));
}

/**
 * Removes a customer for good: their record and every record of theirs in any
 * list (bookings, journals, sales, reviews, inbox, packages, checkout holds by
 * phone), the trash entries for them and their bookings, and the text and undo
 * data of log entries that concern them. Their name, phone or email left in
 * other free text (DOCUMENT_FREE_TEXT) is replaced by the localized marker.
 * Returns the same state for an unknown customer.
 */
export function eraseCustomer(state: DemoState, id: string): DemoState {
  const customer = findErasable(state, id);
  if (!customer) return state;
  const identifiers = customerIdentifiers(customer);
  const phones = customerPhoneDigits(customer);
  const theirs = (item: unknown) => !!item && typeof item === "object" && (item as { customerId?: unknown }).customerId === id;

  const bundle = state.trash.find((entry) => entry.kind === "customer" && entry.customer.id === id);
  const bookingIds = new Set([
    ...state.bookings.filter(theirs).map((b) => b.id),
    ...(bundle?.kind === "customer" ? bundle.bookings.map((b) => b.id) : []),
  ]);

  const next: Record<string, unknown> = { ...state };
  for (const [key, value] of Object.entries(state)) {
    if (!Array.isArray(value) || key === "log" || key === "trash") continue;
    const kept = value.filter((item) => !theirs(item));
    if (kept.length !== value.length) next[key] = kept;
  }
  const erased = next as unknown as DemoState;
  // The customer's own visits are gone. Their account address leaves every other visit; an address typed on their visits may belong to someone else, so it stays there.
  // Their earlier addresses go too: an address from before a correction can still be the delivery address of another visit.
  const addresses = new Set([customer.email, ...(customer.earlier ?? [])].map(normalizeEmail).filter((address) => address.includes("@")));
  erased.bookings = withoutAddresses(erased.bookings, addresses);
  // A cancelled visit's gift-card credit is only returned while the visit exists with that status; its redemption stays for the card's books, so the return is written into it before the visit goes.
  const cancelled = new Set([...state.bookings, ...(bundle?.kind === "customer" ? bundle.bookings : [])].filter((b) => theirs(b) && b.status === "cancelled").map((b) => b.id));
  if (cancelled.size) erased.giftCards = returnRedemptions(erased.giftCards, cancelled);
  erased.customers = state.customers.filter((c) => c.id !== id);
  // By phone alone, as the booking lookup identifies customers: a hold in checkout is transient, so erasing one that only shares the number is the safe side. The export is stricter (`holdIsTheirs`) and sends those holds to the owner's review.
  erased.checkoutHolds = erased.checkoutHolds.filter((hold) => !phones.has(phoneDigits(hold.guest.phone)));
  erased.trash = state.trash
    .filter((entry) => entry.kind === "customer" ? entry.customer.id !== id : !bookingIds.has(entry.bookingId))
    .map((entry) => entry.kind === "customer" ? { ...entry, bookings: withoutAddresses(entry.bookings, addresses) } : entry);
  erased.log = state.log.map((entry) => scrubLogEntry(entry, id, identifiers, phones));
  const marker = erasedMarker();
  const scrub = (text: string) => scrubText(text, identifiers, marker);
  for (const [key, paths] of Object.entries(DOCUMENT_FREE_TEXT) as Array<[keyof DemoState, readonly string[]]>) {
    const value = paths.reduce<unknown>((current, path) => editAt(current, path.split("."), scrub), erased[key]);
    (erased as unknown as Record<string, unknown>)[key] = value;
  }
  return erased;
}
