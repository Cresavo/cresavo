import { normalizePhone } from "../booking/lookup";
import type { Customer, DemoState } from "../data/types";
import { t } from "../i18n";
import type { LogEntry } from "../log/types";

// Erasure of one customer (GDPR art. 17), the final form of `customer/delete`.
// `customer/delete` moves a customer and their records to the trash for 30
// days so the owner can restore them. `customer/erase` removes the customer
// and their records for good, wherever they are (live or in the trash), takes
// their name, phone and email out of the activity log and drops the undo data
// of every log entry that held them. The erasure itself is not undoable.

/** What redacted text reads in stored data that is not shown as a sentence. */
export const REDACTED = "[redacted]";

type Identity = Pick<Customer, "id" | "firstName" | "lastName" | "phone" | "email">;

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
  const values = [name, phone, digits.length >= 7 ? digits : "", customer.email.trim()];
  // Longest first, so a full phone is replaced before its digits.
  return [...new Set(values.filter((value) => value.length >= MIN_IDENTIFIER))].sort((a, b) => b.length - a.length);
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

/** True when a value names the customer: a record of theirs, a `customerId`, or one of their identifiers in text. */
export function mentionsCustomer(value: unknown, id: string, identifiers: readonly string[]): boolean {
  const pattern = matcher(identifiers);
  const walk = (item: unknown, depth: number): boolean => {
    if (typeof item === "string") return !!pattern && item.search(pattern) >= 0;
    if (!item || typeof item !== "object" || depth > 32) return false;
    if (Array.isArray(item)) return item.some((entry) => walk(entry, depth + 1));
    const record = item as Record<string, unknown>;
    if (record.customerId === id || (record.id === id && "firstName" in record)) return true;
    return Object.values(record).some((entry) => walk(entry, depth + 1));
  };
  return walk(value, 0);
}

/** A log entry without the customer: names become "someone" and its undo data is dropped. */
function scrubLogEntry(entry: LogEntry, id: string, identifiers: readonly string[]): LogEntry {
  if (!mentionsCustomer(entry, id, identifiers)) return entry;
  const someone = t("log.someone");
  const rest: LogEntry = { ...entry };
  delete rest.patch;
  return {
    ...rest,
    summary: scrubText(entry.summary, identifiers, someone),
    ...(entry.before === undefined ? {} : { before: scrubText(entry.before, identifiers, someone) }),
    ...(entry.after === undefined ? {} : { after: scrubText(entry.after, identifiers, someone) }),
  };
}

/**
 * Removes a customer for good: their record and every record of theirs in any
 * list (bookings, journals, sales, reviews, inbox, packages, checkout holds by
 * phone), the trash entries for them and their bookings, their identifiers
 * from the activity log, and the undo data of log entries that held them.
 * Any identifier left elsewhere in free text (assistant memory, a gift card
 * recipient) is replaced by `[redacted]`. Returns the same state for an
 * unknown customer.
 */
export function eraseCustomer(state: DemoState, id: string): DemoState {
  const customer = findErasable(state, id);
  if (!customer) return state;
  const identifiers = customerIdentifiers(customer);
  const phone = normalizePhone(customer.phone);
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
  erased.customers = state.customers.filter((c) => c.id !== id);
  erased.checkoutHolds = erased.checkoutHolds.filter((hold) => !phone || normalizePhone(hold.guest.phone) !== phone);
  erased.trash = state.trash.filter((entry) =>
    entry.kind === "customer" ? entry.customer.id !== id : !bookingIds.has(entry.bookingId));
  erased.log = state.log.map((entry) => scrubLogEntry(entry, id, identifiers));
  return scrubDeep(erased, identifiers);
}
