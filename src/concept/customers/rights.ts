import { normalizePhone } from "../booking/lookup";
import { isEmail } from "../connections/core";
import { fromKey, toKey } from "../data/dates";
import type { Customer, DateKey, DemoState, StaffId } from "../data/types";
import { salonClock } from "../tools/clock";
import { FIELD_LIMIT, normalizeEmail } from "./csv";

// Customer rights in the reducer: correction (GDPR art. 16) of every personal
// field of a customer's card, and the owner's "keep" decision after a retention
// review. Export is in `export.ts`, erasure in `erase.ts`.

/** The fields of a customer's card an owner may correct. A field that is left out stays as it is. */
export interface CustomerPatch {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  /** Null removes the date of birth. */
  birthday?: DateKey | null;
  /** A `ServiceCategory` id, or "both". */
  category?: string;
  preferredStaff?: StaffId;
  tags?: string[];
  isRegular?: boolean;
  /** The customer's waiting-list opt-in: the one consent the customer card holds. */
  waitlist?: boolean;
}

/** Every personal field of a customer, and how it is corrected. A test keeps this list in step with `Customer`. */
export const CUSTOMER_FIELD_EDITS: Record<Exclude<keyof Customer, "id" | "since" | "example" | "keptOn" | "earlier">, "update" | "note"> = {
  firstName: "update", lastName: "update", phone: "update", email: "update", birthday: "update", category: "update", preferredStaff: "update",
  isRegular: "update", tags: "update", waitlist: "update", note: "note",
};

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && toKey(fromKey(value)) === value && Number(value.slice(0, 4)) >= 1900;

/** The tags as stored: trimmed, without empty or repeated ones. Null when one is too long or there are too many. */
function cleanTags(tags: string[]): string[] | null {
  const clean = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  return clean.length <= MAX_TAGS && clean.every((tag) => tag.length <= MAX_TAG_LENGTH) ? clean : null;
}

export type PatchProblem = "firstName" | "lastName" | "phone" | "phoneTaken" | "email" | "emailTaken" | "birthday" | "category" | "staff" | "tags" | "flag" | "unknown";

/** The corrected customer, or why the correction is refused. A phone or e-mail that another customer already has is refused. */
export function correctedCustomer(state: DemoState, id: string, patch: CustomerPatch): { customer: Customer } | { problem: PatchProblem } {
  const current = state.customers.find((c) => c.id === id);
  if (!current || !patch || typeof patch !== "object") return { problem: "unknown" };
  const next: Customer = { ...current };
  const others = state.customers.filter((c) => c.id !== id);
  const text = (value: unknown, max: number) => (typeof value === "string" && value.length <= max ? value.trim() : null);

  if (patch.firstName !== undefined) {
    const value = text(patch.firstName, FIELD_LIMIT.firstName);
    if (!value) return { problem: "firstName" };
    next.firstName = value;
  }
  if (patch.lastName !== undefined) {
    const value = text(patch.lastName, FIELD_LIMIT.lastName);
    if (value === null) return { problem: "lastName" };
    next.lastName = value;
  }
  if (patch.phone !== undefined) {
    const value = text(patch.phone, FIELD_LIMIT.phone);
    // A card created without a number may stay without one; a number that is given must be one.
    if (value === null || (value && normalizePhone(value).length < 7)) return { problem: "phone" };
    if (value && others.some((c) => normalizePhone(c.phone) === normalizePhone(value))) return { problem: "phoneTaken" };
    next.phone = value;
  }
  if (patch.email !== undefined) {
    const value = text(patch.email, FIELD_LIMIT.email)?.toLowerCase();
    if (value === undefined || (value && !isEmail(value))) return { problem: "email" };
    if (value && others.some((c) => normalizeEmail(c.email) === value)) return { problem: "emailTaken" };
    next.email = value;
  }
  if (patch.birthday !== undefined) {
    if (patch.birthday !== null && (typeof patch.birthday !== "string" || !validDate(patch.birthday))) return { problem: "birthday" };
    if (patch.birthday === null) delete next.birthday;
    else next.birthday = patch.birthday;
  }
  if (patch.category !== undefined) {
    if (typeof patch.category !== "string" || (patch.category !== "both" && !state.categories.some((c) => c.id === patch.category))) return { problem: "category" };
    next.category = patch.category;
  }
  if (patch.preferredStaff !== undefined) {
    const staff = state.staff.find((s) => s.id === patch.preferredStaff);
    if (!staff) return { problem: "staff" };
    next.preferredStaff = staff.id;
  }
  if (patch.tags !== undefined) {
    const tags = Array.isArray(patch.tags) && patch.tags.every((tag) => typeof tag === "string") ? cleanTags(patch.tags) : null;
    if (!tags) return { problem: "tags" };
    next.tags = tags;
  }
  for (const flag of ["isRegular", "waitlist"] as const) {
    if (patch[flag] === undefined) continue;
    if (typeof patch[flag] !== "boolean") return { problem: "flag" };
    next[flag] = patch[flag];
  }
  return { customer: next };
}

export const MAX_EARLIER = 20;

/** Remembers the name, phone number and address a correction replaces, so an erasure can still find them in older records. */
function withEarlier(before: Customer, after: Customer): Customer {
  const fullName = (c: Customer) => `${c.firstName} ${c.lastName}`.trim();
  const replaced = [
    fullName(before) !== fullName(after) ? fullName(before) : "",
    before.phone !== after.phone ? before.phone : "",
    before.email !== after.email ? before.email : "",
  ].filter(Boolean);
  if (!replaced.length) return after;
  const earlier = [...new Set([...(after.earlier ?? []), ...replaced])].slice(-MAX_EARLIER);
  return { ...after, earlier };
}

/** Applies a correction. A refused one, or one that alters nothing, returns the same state. */
export function updateCustomer(state: DemoState, id: string, patch: CustomerPatch): DemoState {
  const corrected = correctedCustomer(state, id, patch);
  const current = state.customers.find((c) => c.id === id);
  if ("problem" in corrected || !current) return state;
  const customer = withEarlier(current, corrected.customer);
  const keys = new Set([...Object.keys(current), ...Object.keys(customer)]) as Set<keyof Customer>;
  const changed = [...keys].some((key) => JSON.stringify(customer[key]) !== JSON.stringify(current[key]));
  return changed ? { ...state, customers: state.customers.map((c) => (c.id === id ? customer : c)) } : state;
}

/** Records that the owner reviewed this customer and keeps them. They come up for review again after `RETENTION.reviewAgainMonths`. */
export function keepCustomer(state: DemoState, id: string, now: number): DemoState {
  // The decision is stamped with the salon's day from the store's clock; whatever date the caller sent is ignored.
  const on = salonClock(new Date(now)).today;
  const customer = state.customers.find((c) => c.id === id);
  if (!customer || customer.keptOn === on) return state;
  return { ...state, customers: state.customers.map((c) => (c.id === id ? { ...c, keptOn: on } : c)) };
}

/** The personal text fields of a visit. Null removes a value. */
export interface BookingPatch {
  /** The address typed on the public booking page; where this visit's confirmation goes. */
  contactEmail?: string | null;
  note?: string | null;
  /** Only on a cancelled visit. */
  cancelReason?: string | null;
}

export const MAX_BOOKING_TEXT = 500;

/** Corrects the personal text fields of a visit (GDPR art. 16). A refused or unchanged correction returns the same state. */
export function updateBooking(state: DemoState, id: string, patch: BookingPatch): DemoState {
  const current = state.bookings.find((b) => b.id === id);
  if (!current || !patch || typeof patch !== "object") return state;
  const next = { ...current };
  const text = (value: unknown) => (typeof value === "string" && value.length <= MAX_BOOKING_TEXT ? value.trim() : null);
  if (patch.contactEmail !== undefined) {
    const value = patch.contactEmail === null ? "" : typeof patch.contactEmail === "string" && patch.contactEmail.length <= FIELD_LIMIT.email ? patch.contactEmail.trim().toLowerCase() : null;
    if (value === null || (value && !isEmail(value))) return state;
    if (value) next.contactEmail = value;
    else delete next.contactEmail;
    // A link sent to the old address stops working by itself: the booking token's mac covers the address (src/lib/booking-token.ts).
  }
  for (const field of ["note", "cancelReason"] as const) {
    if (patch[field] === undefined) continue;
    const value = patch[field] === null ? "" : text(patch[field]);
    if (value === null || (field === "cancelReason" && current.status !== "cancelled")) return state;
    if (value) next[field] = value;
    else delete next[field];
  }
  const changed = (["contactEmail", "note", "cancelReason"] as const).some((key) => next[key] !== current[key]);
  return changed ? { ...state, seq: state.seq + 1, bookings: state.bookings.map((b) => (b.id === id ? next : b)) } : state;
}
