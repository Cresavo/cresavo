import { bookingPage } from "../concept/booking/links";
import type { Booking, DemoState } from "../concept/data/types";
import { productDomain } from "../concept/page/address";
import { bookingTokenExpiry, mintBookingToken } from "./booking-token";

/** The booking link of a confirmation e-mail, token in the fragment, or undefined for a visit without a public reference. The one place the link's path and id are chosen. */
export function bookingLink(tenantId: string, state: DemoState, booking: Booking): string | undefined {
  if (!booking.publicRef) return undefined;
  const scope = { tenantId, bookingId: booking.id, ref: booking.publicRef, customerId: booking.customerId, purpose: "manage" };
  return `https://${productDomain()}${bookingPage(state.salon.slug, booking.publicRef)}#t=${mintBookingToken(scope, bookingTokenExpiry(booking))}`;
}
