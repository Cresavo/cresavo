import { createHmac, timingSafeEqual } from "node:crypto";
import { visitTime } from "../concept/booking/policy";
import type { Booking } from "../concept/data/types";

// The link in a customer's confirmation e-mail: `v1.<ref>.<exp>.<mac>`, where
// `ref` is the booking's public reference. The mac covers the internal booking
// id, which never leaves the store. It proves the holder got the e-mail, for
// one booking of one customer and one purpose, until `exp` (epoch seconds). It is minted when the e-mail is sent
// and never stored, so it is in no log.

const GRACE_DAYS = 7;

export interface BookingTokenScope {
  tenantId: string;
  /** The internal id, covered by the mac. */
  bookingId: string;
  /** The public reference, carried in the token. */
  ref: string;
  customerId: string;
  purpose: string;
  /**
   * The address the booking's messages go to, as the booking holds it now. The mac covers it, so a link sent to an
   * address stops working when the owner corrects or removes that address, whatever the public reference is.
   */
  contactEmail?: string;
}

function mac(scope: BookingTokenScope, exp: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const key = createHmac("sha256", secret).update("booking-link:v1").digest();
  return createHmac("sha256", key).update([scope.tenantId, scope.bookingId, scope.ref, scope.customerId, scope.purpose, scope.contactEmail ?? "", exp].join("|")).digest("hex");
}

/** The end of the visit plus a week, as epoch seconds. */
export const bookingTokenExpiry = (booking: Pick<Booking, "date" | "start" | "duration">) =>
  Math.floor(visitTime(booking).plus({ minutes: booking.duration, days: GRACE_DAYS }).toMillis() / 1000);

export const mintBookingToken = (scope: BookingTokenScope, exp: number) => `v1.${scope.ref}.${exp}.${mac(scope, exp)}`;

/**
 * True when the token opens this booking at `now`: valid for its scope, and not
 * past its signed expiry nor a week after the visit as it stands. One rule for
 * the view, cancel and move, so a link that opens nothing says nothing else.
 */
export const verifyBookingLink = (token: string, scope: BookingTokenScope, booking: Pick<Booking, "date" | "start" | "duration">, now = Date.now()) =>
  now < bookingTokenExpiry(booking) * 1000 && verifyBookingToken(token, scope, now);

/** True when the token was minted for exactly this scope and has not expired at `now` (epoch milliseconds). */
export function verifyBookingToken(token: string, scope: BookingTokenScope, now = Date.now()): boolean {
  const match = /^v1\.(.+)\.(\d{1,12})\.([a-f0-9]{64})$/.exec(token);
  if (!match || match[1] !== scope.ref) return false;
  const exp = Number(match[2]);
  const expected = Buffer.from(mac(scope, exp));
  const given = Buffer.from(match[3]);
  return given.length === expected.length && timingSafeEqual(given, expected) && exp * 1000 > now;
}
