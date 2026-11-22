import { bookingPage } from "../concept/booking/links";
import type { Booking, DemoState } from "../concept/data/types";
import { productDomain } from "../concept/page/address";
import { bookingTokenExpiry, mintBookingToken } from "./booking-token";

/** What stands in the link of a message that is only simulated: it opens nothing. */
export const SIMULATED_TOKEN = "simulated";

/**
 * The booking link of a confirmation e-mail, token in the fragment, or
 * undefined for a visit without a public reference. A message that is not
 * really sent gets a placeholder, never a token that opens the booking. The
 * one place the link's path and id are chosen.
 */
export function bookingLink(tenantId: string, state: DemoState, booking: Booking, redeemable: boolean): string | undefined {
  if (!booking.publicRef) return undefined;
  const scope = { tenantId, bookingId: booking.id, ref: booking.publicRef, customerId: booking.customerId, purpose: "manage", contactEmail: booking.contactEmail ?? "" };
  const token = redeemable ? mintBookingToken(scope, bookingTokenExpiry(booking)) : SIMULATED_TOKEN;
  return `https://${productDomain()}${bookingPage(state.salon.slug, booking.publicRef)}#t=${token}`;
}
