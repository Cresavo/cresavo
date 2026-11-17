import { diffDays } from "../data/dates";
import { isFree, pickResource } from "../data/slots";
import type { Booking, Customer, DateKey, DemoState, InboxItem, JournalEntry, ProductSale, Review } from "../data/types";

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
  const trash = state.trash.filter((entry) => daysLeft(entry, today) > 0);
  return trash.length === state.trash.length ? state : { ...state, trash };
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
    trash: [{ id: `t-${state.seq}`, kind: "customer", deletedOn: state.generatedFor, ...bundle }, ...state.trash],
  };
}

/** A cancelled booking can come back only if its time is still free. */
export function canRestore(state: DemoState, entry: TrashEntry): boolean {
  if (entry.kind === "customer") return true;
  const booking = state.bookings.find((b) => b.id === entry.bookingId);
  return !!booking && isFree(state, booking.staffId, booking.date, booking.start, booking, booking.id);
}

/** Puts an item back. Returns the same state when it cannot be restored (the time was taken meanwhile). */
export function restoreEntry(state: DemoState, id: string): DemoState {
  const entry = state.trash.find((e) => e.id === id);
  if (!entry || !canRestore(state, entry)) return state;
  const trash = state.trash.filter((e) => e.id !== id);
  if (entry.kind === "booking") {
    const bookings = state.bookings.map((b) =>
      b.id === entry.bookingId ? { ...b, status: "booked" as const, cancelReason: undefined, resourceId: pickResource(state, b, b.date, b.start, b.id) } : b,
    );
    return { ...state, bookings, trash };
  }
  const restored: DemoState = {
    ...state,
    customers: [...state.customers, entry.customer],
    journals: [...state.journals, ...entry.journals],
    sales: [...state.sales, ...entry.sales],
    reviews: [...state.reviews, ...entry.reviews],
    inbox: [...state.inbox, ...entry.inbox],
    trash,
  };
  // A time taken while the customer was in the trash must not be double-booked.
  return entry.bookings.reduce<DemoState>((acc, booking) => {
    const clash = booking.status === "booked" && !isFree(acc, booking.staffId, booking.date, booking.start, booking, booking.id);
    const back = booking.status === "booked" ? { ...booking, resourceId: pickResource(acc, booking, booking.date, booking.start, booking.id) } : booking;
    return { ...acc, bookings: [...acc.bookings, clash ? { ...booking, status: "cancelled" as const, cancelReason: "Time taken" } : back] };
  }, restored);
}
