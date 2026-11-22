import { bookingPage } from "../concept/booking/links";
import type { Booking, DemoState } from "../concept/data/types";
import { productDomain } from "../concept/page/address";
import { bookingTokenExpiry, mintBookingToken } from "./booking-token";

/** What stands in the link of a message that is only simulated: it opens nothing. */
export const SIMULATED_TOKEN = "simulated";

/** The booking link before its token: the address and the token's expiry (epoch seconds). It holds no secret, so it can be stored with the message. */
export interface BookingLinkBase {
  url: string;
  exp: number;
}

/** The link of a booking for the message about it, or undefined for a visit without a public reference. The one place the link's path and expiry are chosen. */
export function bookingLinkBase(state: DemoState, booking: Booking): BookingLinkBase | undefined {
  if (!booking.publicRef) return undefined;
  return { url: `https://${productDomain()}${bookingPage(state.salon.slug, booking.publicRef)}`, exp: bookingTokenExpiry(booking) };
}

/**
 * The finished link, token in the fragment. A message that is not really sent
 * gets a placeholder, never a token that opens the booking. The token follows
 * from the booking and the frozen expiry, so a retry makes the same link.
 */
export function bookingLink(tenantId: string, booking: Booking, base: BookingLinkBase, redeemable: boolean): string {
  const scope = { tenantId, bookingId: booking.id, ref: booking.publicRef!, customerId: booking.customerId, purpose: "manage" };
  return `${base.url}#t=${redeemable ? mintBookingToken(scope, base.exp) : SIMULATED_TOKEN}`;
}
