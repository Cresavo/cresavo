import type { Booking, DemoState, InboxEvent, InboxItem } from "../../data/types";
import { canChangeBooking, canOpen, type Role } from "../../ops/access";
import { findCustomer, findService, inboxItemVisible } from "../../selectors";

/** One thing a customer did on the booking page that the studio has not looked at yet. */
export interface BookingNotice {
  id: string;
  event: InboxEvent;
  bookingId: string;
  /** The customer's first name, or empty when their card is gone. */
  name: string;
  service: string;
  /** The visit's day and start as it stands now (after a move, the new time). */
  date: Booking["date"];
  start: number;
  /** Paid when booking, in minor units; 0 when nothing was paid. */
  paidMinor: number;
  currency: string;
  /** When it happened, salon time. */
  at: Pick<InboxItem, "date" | "time">;
}

/**
 * Unread inbox items for online bookings, cancellations and moves, newest first, read from the
 * booking and the customer they point at. An item whose booking is gone is left out.
 */
export function bookingNotices(state: DemoState): BookingNotice[] {
  return state.inbox.flatMap((item): BookingNotice[] => {
    if (!item.event || item.read || !item.bookingId || !inboxItemVisible(state, item)) return [];
    const booking = state.bookings.find((b) => b.id === item.bookingId);
    if (!booking) return [];
    const protection = booking.protection;
    return [{
      id: item.id, event: item.event, bookingId: booking.id,
      name: findCustomer(state, booking.customerId)?.firstName ?? "",
      service: findService(state, booking.serviceId)?.name ?? "",
      date: item.visitDate ?? booking.date, start: item.visitStart ?? booking.start,
      paidMinor: item.event === "booked" && protection?.deposit ? protection.terms.depositMinor : 0,
      currency: protection?.terms.currency ?? state.localization.currency,
      at: { date: item.date, time: item.time },
    }];
  });
}

/** Where a notice leads: the visit, open in the calendar on its day. */
export const noticeHref = (bookingId: string) => `/studio/calendar?booking=${encodeURIComponent(bookingId)}`;

/** The owner’s “New since last time” and its toast; staff do not see the inbox, so they do not see these either. */
export function canSeeBookingNotices(role: Role): boolean {
  return canOpen(role, "/studio/inbox") && canOpen(role, "/studio/calendar");
}

/** Notices this role may recap or toast: none in staff view, and never a visit they cannot open. */
export function visibleBookingNotices(state: DemoState, role: Role): BookingNotice[] {
  if (!canSeeBookingNotices(role)) return [];
  return bookingNotices(state).filter((notice) => canChangeBooking(state, role, notice.bookingId));
}
