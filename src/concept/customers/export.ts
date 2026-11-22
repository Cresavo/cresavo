import type { CheckoutHold } from "../booking/protection";
import type { Booking, Customer, DemoState, GiftCard, InboxItem, JournalAccess, JournalEntry, ProductSale, Review, ServicePackage } from "../data/types";
import type { LogEntry } from "../log/types";
import { defuseFormula, toCsv } from "../studio/more/export";
import { customerIdentifiers, customerPhoneDigits, findErasable, holdIsTheirs, mentionsCustomer, phoneDigits } from "./erase";

// Export of one customer's data (GDPR art. 15 and 20) as JSON and CSV.
//
// The export is built from what `eraseCustomer` removes: the customer card,
// every record of theirs in any list of the document (`customerId`), the same
// records inside their trash bundle, the checkout holds made with their phone,
// and the activity entries that name them. A list the export does not know by
// name still appears under `other`, so a new kind of record is never silently
// left out; a test enforces that against `eraseCustomer`. Nothing about other
// customers is included: records are selected by this customer's id, and an
// activity entry that also names someone else is left out.

export const EXPORT_FORMAT = "salon-customer-export/1";

/** What the customer agreed to or accepted, as far as the studio records it. */
export interface CustomerConsents {
  /** The customer's opt-in to be offered freed slots (the waiting list). */
  waitlistOptIn: boolean;
  /** The booking and cancellation terms accepted with each visit booked on the public page (or set by the owner). */
  bookingTerms: Array<{ bookingId: string } & NonNullable<Booking["protection"]>["terms"]>;
}

/** An activity entry without its undo data: what happened, when and who did it. */
export type ExportedActivity = Pick<LogEntry, "id" | "type" | "at" | "actor" | "source" | "summary">;

export interface CustomerExport {
  format: typeof EXPORT_FORMAT;
  /** ISO 8601, when the export was made. */
  exportedAt: string;
  /** The controller: the salon the data belongs to. */
  salon: { name: string; slug: string };
  /** True when the customer was deleted to the trash and can still be restored. */
  inTrash: boolean;
  profile: Customer;
  /** A visit's typed address is left out (`contactEmailOmitted`) when it is not one of the customer's own: it may belong to someone who booked for them. */
  bookings: Array<Booking & { contactEmailOmitted?: true }>;
  journal: JournalEntry[];
  /** Messages to and from the customer in the studio's inbox, including the confirmations and reminders sent to them. */
  messages: InboxItem[];
  consents: CustomerConsents;
  reviews: Review[];
  productSales: ProductSale[];
  packages: ServicePackage[];
  /** Who read their journal and when. */
  journalAccess: JournalAccess[];
  /** Online bookings still in checkout that are theirs: their phone number and either their address or their name. A hold that only shares the phone is left out. */
  checkoutHolds: CheckoutHold[];
  /** Gift cards whose recipient or message names them. */
  giftCardMentions: Array<Pick<GiftCard, "id" | "soldOn" | "recipient" | "message">>;
  /**
   * Records whose text also names another customer (a note, a journal entry, a message). The owner reads these before the file goes to the customer:
   * the export copies free text as it was written.
   */
  needsReview: Array<{ section: "profile" | "journal" | "messages" | "checkout_holds"; id: string }>;
  activity: ExportedActivity[];
  /** Records of any other list that belong to them. Empty unless a new kind of record has no section of its own. */
  other: Record<string, unknown[]>;
}

/** The lists of the document that hold records by `customerId`, and the section each is exported in. */
const SECTIONS = {
  bookings: "bookings",
  journals: "journal",
  inbox: "messages",
  reviews: "reviews",
  sales: "productSales",
  packages: "packages",
  journalAccess: "journalAccess",
} as const satisfies Partial<Record<keyof DemoState, keyof CustomerExport>>;

/** Lists that are not records of a customer: the customer cards themselves, and the log and trash (handled apart). */
const HANDLED_APART = new Set<string>(["customers", "log", "trash", "checkoutHolds"]);

type Lists = Record<string, unknown[]>;

function listsOf(state: DemoState, id: string): Lists {
  const lists: Lists = {};
  const add = (key: string, items: unknown[]) => { if (items.length) lists[key] = [...(lists[key] ?? []), ...items]; };
  const theirs = (item: unknown) => !!item && typeof item === "object" && (item as { customerId?: unknown }).customerId === id;
  for (const [key, value] of Object.entries(state)) {
    if (Array.isArray(value) && !HANDLED_APART.has(key)) add(key, value.filter(theirs));
  }
  // A deleted customer's records wait in their trash bundle under the same list names (`inbox`, `journals`, ...).
  const bundle = state.trash.find((entry) => entry.kind === "customer" && entry.customer.id === id);
  if (bundle?.kind === "customer") {
    for (const [key, value] of Object.entries(bundle)) {
      if (Array.isArray(value)) add(key, value.filter(theirs));
    }
  }
  return lists;
}

/** The customer's data as one object. An unknown customer gives null. */
export function customerExport(state: DemoState, id: string, exportedAt: string): CustomerExport | null {
  const profile = findErasable(state, id);
  if (!profile) return null;
  const identifiers = customerIdentifiers(profile);
  const digits = phoneDigits(profile.phone);
  const ownAddresses = new Set([profile.email, ...(profile.earlier ?? [])].map((a) => a.trim().toLowerCase()).filter(Boolean));
  const lists = listsOf(state, id);
  const trashed = state.trash.flatMap((entry) => (entry.kind === "customer" ? [entry.customer] : []));
  const others = [...state.customers, ...trashed].filter((c) => c.id !== id);
  const otherNames = others.map((c) => ({ id: c.id, identifiers: customerIdentifiers(c), digits: phoneDigits(c.phone) }));

  const sections: Record<(typeof SECTIONS)[keyof typeof SECTIONS], unknown[]> = { bookings: [], journal: [], messages: [], reviews: [], productSales: [], packages: [], journalAccess: [] };
  const other: Record<string, unknown[]> = {};
  for (const [key, items] of Object.entries(lists)) {
    const section = (SECTIONS as Record<string, keyof typeof sections | undefined>)[key];
    if (section) sections[section].push(...items);
    else other[key] = items;
  }
  const namesOther = (value: unknown) => otherNames.some((o) => mentionsCustomer(value, "", o.identifiers, ""));
  const bookings = (sections.bookings as Booking[]).map((b): CustomerExport["bookings"][number] => {
    if (!b.contactEmail || ownAddresses.has(b.contactEmail.trim().toLowerCase())) return b;
    const omitted: CustomerExport["bookings"][number] = { ...b, contactEmailOmitted: true };
    delete omitted.contactEmail;
    return omitted;
  });
  const journal = sections.journal as JournalEntry[];
  const messages = sections.messages as InboxItem[];
  return {
    format: EXPORT_FORMAT,
    exportedAt,
    salon: { name: state.salon.name, slug: state.salon.slug },
    inTrash: !state.customers.some((c) => c.id === id),
    profile,
    bookings,
    journal,
    messages,
    consents: {
      waitlistOptIn: profile.waitlist,
      bookingTerms: bookings.flatMap((b) => (b.protection ? [{ bookingId: b.id, ...b.protection.terms }] : [])),
    },
    reviews: sections.reviews as Review[],
    productSales: sections.productSales as ProductSale[],
    packages: sections.packages as ServicePackage[],
    journalAccess: sections.journalAccess as JournalAccess[],
    checkoutHolds: state.checkoutHolds.filter((hold) => holdIsTheirs(hold, profile)),
    giftCardMentions: state.giftCards
      .filter((card) => mentionsCustomer({ recipient: card.recipient, message: card.message }, "", identifiers, ""))
      .map(({ id: cardId, soldOn, recipient, message }) => ({ id: cardId, soldOn, recipient, message })),
    needsReview: [
      ...state.checkoutHolds.filter((hold) => !holdIsTheirs(hold, profile) && customerPhoneDigits(profile).has(phoneDigits(hold.guest.phone))).map((h) => ({ section: "checkout_holds" as const, id: h.id })),
      ...(namesOther(profile.note) ? [{ section: "profile" as const, id: profile.id }] : []),
      ...journal.filter(namesOther).map((j) => ({ section: "journal" as const, id: j.id })),
      ...messages.filter(namesOther).map((m) => ({ section: "messages" as const, id: m.id })),
    ],
    activity: state.log
      .filter((entry) => mentionsCustomer(entry, id, identifiers, digits) && !otherNames.some((o) => mentionsCustomer(entry, o.id, o.identifiers, o.digits)))
      .map(({ id: entryId, type, at, actor, source, summary }) => ({ id: entryId, type, at, actor, source, summary })),
    other,
  };
}

/** The export as pretty-printed JSON. */
export const customerExportJson = (data: CustomerExport) => JSON.stringify(data, null, 2);

/** Rows of `[path, value]` for every leaf of a value; arrays of plain values are joined, other arrays are indexed. */
function leaves(value: unknown, path: string, into: Array<[string, string | number]>) {
  if (value === undefined || value === null) return;
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.every((item) => item === null || typeof item !== "object")) {
        if (value.length) into.push([path, value.join("; ")]);
        return;
      }
      value.forEach((item, index) => leaves(item, `${path}.${index}`, into));
      return;
    }
    for (const [key, item] of Object.entries(value)) leaves(item, path ? `${path}.${key}` : key, into);
    return;
  }
  into.push([path, typeof value === "number" ? value : String(value)]);
}

/**
 * The export as CSV in long form, one row per field: `section, record_id,
 * field, value`. It carries the same data as the JSON, in one file that opens
 * in a spreadsheet. Text that would run as a formula is defused.
 */
export function customerExportCsv(data: CustomerExport): string {
  const rows: (string | number | undefined)[][] = [["section", "record_id", "field", "value"]];
  const add = (section: string, recordId: string, record: unknown) => {
    const found: Array<[string, string | number]> = [];
    leaves(record, "", found);
    for (const [field, value] of found) rows.push([section, defuseFormula(recordId), defuseFormula(field), typeof value === "string" ? defuseFormula(value) : value]);
  };
  add("export", data.format, { exportedAt: data.exportedAt, salon: data.salon, inTrash: data.inTrash });
  add("profile", data.profile.id, data.profile);
  for (const [section, records] of [
    ["bookings", data.bookings], ["journal", data.journal], ["messages", data.messages], ["reviews", data.reviews],
    ["product_sales", data.productSales], ["packages", data.packages], ["journal_access", data.journalAccess],
    ["checkout_holds", data.checkoutHolds], ["gift_card_mentions", data.giftCardMentions], ["activity", data.activity],
  ] as const) {
    (records as Array<{ id: string }>).forEach((record, index) => add(section, record.id ?? String(index), record));
  }
  add("consents", data.profile.id, { waitlistOptIn: data.consents.waitlistOptIn });
  data.consents.bookingTerms.forEach((terms) => add("consents", terms.bookingId, terms));
  for (const [section, records] of Object.entries(data.other)) records.forEach((record, index) => add(section, (record as { id?: string }).id ?? String(index), record));
  return toCsv(rows);
}

/** A file name that holds the customer's id, never their name. */
export const customerExportFilename = (data: CustomerExport, extension: "json" | "csv") =>
  `${data.salon.slug}-customer-${data.profile.id}-${data.exportedAt.slice(0, 10)}.${extension}`;
