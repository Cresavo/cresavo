import { bookingPage } from "../concept/booking/links";
import type { Booking, DemoState } from "../concept/data/types";
import { productDomain } from "../concept/page/address";
import { bookingTokenExpiry, mintBookingToken } from "./booking-token";

/** The booking link of a confirmation e-mail, token in the fragment. The one place the link's path and id are chosen. */
export function bookingLink(tenantId: string, state: DemoState, booking: Booking): string {
  const token = mintBookingToken({ tenantId, bookingId: booking.id, customerId: booking.customerId, purpose: "manage" }, bookingTokenExpiry(booking));
  return `https://${productDomain()}${bookingPage(state.salon.slug, booking.id)}#t=${token}`;
}
