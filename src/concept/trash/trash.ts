import { refundCancellation } from "../booking/settlement";
import { demoPayments } from "../connections/demo";
import { t } from "../i18n";
import { diffDays } from "../data/dates";
import { isFree, pickResource } from "../data/slots";
import { cardsCovered, returnRedemptions } from "../giftcards/cards";
import type { Booking, Customer, DateKey, DemoState, InboxItem, JournalEntry, ProductSale, Review, ServicePackage } from "../data/types";

/** Days a deleted or cancelled item stays restorable. */
export const TRASH_DAYS = 30;

/** What went with a deleted customer, so restoring brings everything back. */
export interface CustomerBundle {
  customer: Customer;
  bookings: Booking[];
  journals: JournalEntry[];
  sales: ProductSale[];
  reviews: Review[];
  inbox: InboxItem[];
  /** Optional for customers already in the trash when packages were bundled. */
  packages?: ServicePackage[];
}

export type TrashEntry =
  | { id: string; kind: "booking"; deletedOn: DateKey; bookingId: string }
  | ({ id: string; kind: "customer"; deletedOn: DateKey } & CustomerBundle);

/** Days left before the entry is removed for good. */
export function daysLeft(entry: TrashEntry, today: DateKey): number {
  return Math.max(0, TRASH_DAYS - diffDays(today, entry.deletedOn));
}

/** Drops entries older than 30 days. A cancelled booking stays in the history; a deleted customer is gone. */
export function purgeExpired(state: DemoState, today: DateKey): DemoState {
  const legacyCustomers = new Set<string>();
  const trash = state.trash.flatMap((entry) => {
    if (entry.kind === "customer" && !entry.packages) {
      const customerId = entry.customer.id;
      legacyCustomers.add(customerId);
      entry = { ...entry, packages: state.packages.filter((pkg) => pkg.customerId === customerId) };
    }
    return daysLeft(entry, today) > 0 ? [entry] : [];
  });
  if (trash.length === state.trash.length && legacyCustomers.size === 0) return state;
  return { ...state, trash, packages: state.packages.filter((pkg) => !legacyCustomers.has(pkg.customerId)) };
}

/** A booking is added to the trash when it is cancelled. */
export function trashBooking(state: DemoState, bookingId: string): DemoState {
  return { ...state, seq: state.seq + 1, trash: [{ id: `t-${state.seq}`, kind: "booking", deletedOn: state.generatedFor, bookingId }, ...state.trash] };
}

/** Removes a customer with everything that belongs to them and keeps it all in the trash. */
export function deleteCustomer(state: DemoState, id: string): DemoState {
  const customer = state.customers.find((c) => c.id === id);
  if (!customer) return state;
  const mine = (item: { customerId?: string }) => item.customerId === id;
  const rest = <T extends { customerId?: string }>(items: T[]) => items.filter((item) => !mine(item));
  const bundle: CustomerBundle = {
    customer,
    bookings: state.bookings.filter(mine),
    journals: state.journals.filter(mine),
    sales: state.sales.filter(mine),
    reviews: state.reviews.filter(mine),
    inbox: state.inbox.filter(mine),
    packages: state.packages.filter(mine),
  };
  return {
    ...state,
    seq: state.seq + 1,
    customers: state.customers.filter((c) => c.id !== id),
    bookings: rest(state.bookings),
    journals: rest(state.journals),
    sales: rest(state.sales),
    reviews: rest(state.reviews),
    inbox: rest(state.inbox),
    packages: rest(state.packages),
    trash: [{ id: `t-${state.seq}`, kind: "customer", deletedOn: state.generatedFor, ...bundle }, ...state.trash],
  };
}

export type RestoreBlockReason = "missing" | "time-taken" | "gift-card";

/** Puts a booking back as booked, in a free room. */
const rebook = (state: DemoState, booking: Booking): Booking => ({
  ...booking,
  status: "booked",
  cancelReason: undefined,
  resourceId: pickResource(state, booking, booking.date, booking.start, booking.id),
});

/** Why a cancelled booking cannot come back: its time was taken, or its gift card balance was spent meanwhile. */
export function restoreBlockReason(state: DemoState, entry: TrashEntry): RestoreBlockReason | undefined {
  if (entry.kind === "customer") return undefined;
  const booking = state.bookings.find((b) => b.id === entry.bookingId);
  if (!booking) return "missing";
  if (!isFree(state, booking.staffId, booking.date, booking.start, booking, booking.id)) return "time-taken";
  const back = { ...state, bookings: state.bookings.map((b) => (b.id === booking.id ? rebook(state, b) : b)) };
  return cardsCovered(back) ? undefined : "gift-card";
}

/** A cancelled booking can come back only if its time is still free and its gift card payment is still covered. */
export function canRestore(state: DemoState, entry: TrashEntry): boolean {
  return !restoreBlockReason(state, entry);
}

/** Puts an item back. Returns the same state when it cannot be restored (the time was taken meanwhile). */
export function restoreEntry(state: DemoState, id: string, payments = demoPayments): DemoState {
  const entry = state.trash.find((e) => e.id === id);
  if (!entry || !canRestore(state, entry)) return state;
  const trash = state.trash.filter((e) => e.id !== id);
  if (entry.kind === "booking") {
    const bookings = state.bookings.map((b) => (b.id === entry.bookingId ? rebook(state, b) : b));
    return { ...state, bookings, trash };
  }
  const restored: DemoState = {
    ...state,
    customers: [...state.customers, entry.customer],
    journals: [...state.journals, ...entry.journals],
    sales: [...state.sales, ...entry.sales],
    reviews: [...state.reviews, ...entry.reviews],
    inbox: [...state.inbox, ...entry.inbox],
    packages: [...state.packages, ...(entry.packages ?? [])],
    trash,
  };
  // A time taken while the customer was in the trash must not be double-booked,
  // and a gift card balance spent meanwhile must not be spent twice.
  for (const booking of entry.bookings) {
    if (booking.status !== "booked") {
      restored.bookings = [...restored.bookings, booking];
      continue;
    }
    const available = isFree(restored, booking.staffId, booking.date, booking.start, booking, booking.id);
    if (available) {
      const bookings = [...restored.bookings, rebook(restored, booking)];
      if (cardsCovered({ ...restored, bookings })) {
        restored.bookings = bookings;
        continue;
      }
    }
    const refunded = refundCancellation(booking, payments);
    if (!refunded) return state;
    if (refunded.protection?.refund) restored.giftCards = returnRedemptions(restored.giftCards, new Set([booking.id]));
    restored.bookings = [...restored.bookings, { ...refunded, status: "cancelled",
      cancelReason: t(available ? "trash.giftCardUsed" : "trash.timeTaken") }];
  }
  return restored;
}
