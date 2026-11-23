import { createHash } from "node:crypto";
import type { DemoAction } from "../actions";
import type { OutboxEntry } from "../connections/simulated/outbox";
import { mentionsCustomer, phoneDigits, REDACTED, scrubDeep } from "../customers/erase";

// Redaction of the studio store's audit data for one erased customer
// (docs/design/STUDIO_STORE.md, step 2 decision 3, item 7). The document is
// the source of truth and `customer/erase` removes the customer from it; the
// `tenant_action` log and the `tenant_effect` outbox are redacted in place.
//
// PERSONAL_FIELDS lists, per action type, the fields that can hold personal
// data. A path is dot-separated; `*` stands for every element of an array.
// Array fields are redacted for every element, not only the erased
// customer's: the log is audit only and never rebuilds state, so redacting a
// little more is the safe side. prisma/grants/erase-subject.sql embeds the
// same map; a unit test keeps the two identical.

const NOTICE = (at: string) => [`${at}.title`, `${at}.body`, `${at}.draftReply`, `${at}.fromName`, `${at}.reply`];
const GUEST = ["guest.name", "guest.phone", "guest.email", ...NOTICE("notice")];
const JOURNAL = (at: string) => [`${at}.treatment`, `${at}.observations`, `${at}.advice`, `${at}.nextVisit`, `${at}.photos`, `${at}.versions`];

export const PERSONAL_FIELDS = {
  "online/hold": GUEST,
  "online/book": GUEST,
  "online/waitlist": GUEST,
  "booking/create": ["newCustomer.name", "newCustomer.phone", "newCustomer.email", "fictionalCustomer.name"],
  "booking/move": NOTICE("notice"),
  "booking/fee": ["reason"],
  "booking/update": ["patch.contactEmail", "patch.note", "patch.cancelReason"],
  "booking/cancel": ["reason", ...NOTICE("notice")],
  "customers/import": ["firstName", "lastName", "phone", "email", "birthday", "note"].map((field) => `customers.*.${field}`),
  "customer/note": ["note"],
  "customer/update": ["firstName", "lastName", "phone", "email", "birthday", "tags"].map((field) => `patch.${field}`),
  "customers/message": ["texts.*.title", "texts.*.body"],
  "inbox/add": NOTICE("item"),
  "inbox/reply": ["reply"],
  "review/submit": ["text"],
  "review/reply": ["reply"],
  "journal/add": JOURNAL("entry"),
  "journal/edit": JOURNAL("content"),
  "giftcard/sell": ["recipient", "message"],
  "memory/add": ["item.text"],
  "memory/edit": ["text"],
  "ticket/create": ["ticket.question", "ticket.screen", "ticket.activity.*.summary"],
} as const satisfies Partial<Record<DemoAction["type"], readonly string[]>>;

/** Replaces the value at a path (with `*` for array elements) by `[redacted]`. Missing fields stay missing. */
function redactPath(value: unknown, path: readonly string[]): unknown {
  if (!path.length) return value === undefined || value === null ? value : REDACTED;
  if (!value || typeof value !== "object") return value;
  const [head, ...rest] = path;
  if (head === "*") return Array.isArray(value) ? value.map((item) => redactPath(item, rest)) : value;
  if (Array.isArray(value) || !(head in value)) return value;
  return { ...(value as Record<string, unknown>), [head]: redactPath((value as Record<string, unknown>)[head], rest) };
}

/** The action with its personal fields (by PERSONAL_FIELDS) replaced by `[redacted]`. */
export function redactAction(action: DemoAction): DemoAction {
  const paths: readonly string[] = (PERSONAL_FIELDS as Partial<Record<string, readonly string[]>>)[action.type] ?? [];
  return paths.reduce<unknown>((value, path) => redactPath(value, path.split(".")), action) as DemoAction;
}

/** The outbox recipient of a message to this customer (see `sendDemoMessage`). */
export const customerRecipient = (customerId: string) => `customer:${customerId}`;

/** True when a message effect is addressed to the customer (an email may list several recipients). */
export function addressedTo(record: OutboxEntry, customerId: string): boolean {
  return record.port !== "payments" && typeof record.to === "string" &&
    record.to.split(",").map((to) => to.trim()).includes(customerRecipient(customerId));
}

/** `%…%` LIKE patterns that find a customer's id in a stored result (jsonb text form). */
export function customerIdPatterns(customerId: string): string[] {
  const id = JSON.stringify(customerId).replace(/[\\%_]/g, "\\$&");
  return [`%"customerId": ${id}%`, `%"id": ${id}%`];
}

/** `%…%` ILIKE patterns that find an identifier in plain text (an idempotency key). */
export function plainTextPatterns(identifiers: readonly string[]): string[] {
  return identifiers.map((value) => `%${value.replace(/[\\%_]/g, "\\$&")}%`);
}

/** A message's recipient, subject and text are personal; a payment keeps its amount and reference. */
export function redactEffectPayload(record: OutboxEntry, identifiers: readonly string[]): OutboxEntry {
  const rest = { ...record, delivery: undefined };
  const redacted: OutboxEntry = record.port === "payments" ? { ...record } : {
    ...rest,
    body: REDACTED,
    ...(record.to === undefined ? {} : { to: REDACTED }),
    ...(record.subject === undefined ? {} : { subject: REDACTED }),
  };
  return scrubDeep(redacted, identifiers);
}

/** `%…%` ILIKE patterns that find an identifier inside a jsonb value's text. */
export function jsonTextPatterns(identifiers: readonly string[]): string[] {
  return identifiers.map((value) => `%${JSON.stringify(value).slice(1, -1).replace(/[\\%_]/g, "\\$&")}%`);
}

/** The key a stored replay is kept under once its own key held an identifier: a hash, so a retry with the same key still finds it. */
export const erasedKey = (key: string) => `erased-${createHash("sha256").update(key, "utf8").digest("hex")}`;

/** True when an idempotency key holds one of the identifiers (a caller can embed an address in it). */
export const keyHoldsIdentifier = (key: string, identifiers: readonly string[]) => identifiers.some((value) => key.toLowerCase().includes(value.toLowerCase()));

/**
 * A stored replay result (`{ state, version, entry, effects }`) after an erasure: the erased customer's records
 * (their card, trash entry and checkout holds by phone) are removed from its salon snapshot and their identifiers replaced in every
 * string. The result still replays, so a retry of a change that was already committed is answered, not applied again.
 */
export function redactReplay<T>(result: T, customerId: string, identifiers: readonly string[], phones: ReadonlySet<string> = new Set(), contacts: readonly string[] = []): T {
  const replay = result as unknown as { state?: Record<string, unknown>; entry?: { action?: DemoAction } };
  let next: unknown = result;
  // The action of the replayed entry: when it concerns the customer, every personal field of its type goes (PERSONAL_FIELDS), not only what matches an identifier.
  const action = replay?.entry?.action as (DemoAction & { id?: unknown }) | undefined;
  // As `subjectIds` names the subject of an action: a `customer/*` action targets the customer by its `id`.
  const targeted = !!action && action.type.startsWith("customer/") && action.id === customerId;
  if (action && (targeted || mentionsCustomer(action, customerId, contacts, phones))) {
    next = { ...replay, entry: { ...replay.entry, action: redactAction(action) } };
  }
  const base = next as typeof replay;
  if (base && typeof base === "object" && base.state && typeof base.state === "object") {
    const state: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base.state)) {
      if (!Array.isArray(value)) state[key] = value;
      // The undo data of a replayed snapshot's history holds whole records (the customer's included); a replay never needs it.
      else if (key === "log") state[key] = value.map((item) => { const entry = { ...(item as Record<string, unknown>) }; delete entry.patch; delete entry.before; delete entry.after; return entry; });
      else if (key === "customers") state[key] = value.filter((item) => (item as { id?: unknown })?.id !== customerId);
      else if (key === "checkoutHolds") state[key] = value.filter((item) => !phones.has(phoneDigits((item as { guest?: { phone?: string } })?.guest?.phone ?? "")));
      else if (key === "trash") state[key] = value.filter((item) => !((item as { kind?: unknown })?.kind === "customer" && (item as { customer?: { id?: unknown } }).customer?.id === customerId));
      else state[key] = value.filter((item) => (item as { customerId?: unknown })?.customerId !== customerId);
    }
    next = { ...base, state };
  }
  return scrubDeep(next, identifiers) as T;
}
