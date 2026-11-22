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
}

function mac(scope: BookingTokenScope, exp: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const key = createHmac("sha256", secret).update("booking-link:v1").digest();
  return createHmac("sha256", key).update([scope.tenantId, scope.bookingId, scope.customerId, scope.purpose, exp].join("|")).digest("hex");
}

/** The end of the visit plus a week, as epoch seconds. */
export const bookingTokenExpiry = (booking: Pick<Booking, "date" | "start" | "duration">) =>
  Math.floor(visitTime(booking).plus({ minutes: booking.duration, days: GRACE_DAYS }).toMillis() / 1000);

export const mintBookingToken = (scope: BookingTokenScope, exp: number) => `v1.${scope.ref}.${exp}.${mac(scope, exp)}`;

/** True when the token was minted for exactly this scope and has not expired at `now` (epoch milliseconds). */
export function verifyBookingToken(token: string, scope: BookingTokenScope, now = Date.now()): boolean {
  const match = /^v1\.(.+)\.(\d{1,12})\.([a-f0-9]{64})$/.exec(token);
  if (!match || match[1] !== scope.ref) return false;
  const exp = Number(match[2]);
  const expected = Buffer.from(mac(scope, exp));
  const given = Buffer.from(match[3]);
  return given.length === expected.length && timingSafeEqual(given, expected) && exp * 1000 > now;
}
