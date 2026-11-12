import { setTimeout as delay } from "node:timers/promises";
import { verifiedClientAddress } from "../../scripts/client-address.mjs";
import { DomainError, PasswordCapacityError } from "./errors";

// One bounded map per process. No persistence or cross-worker guarantee.
const buckets = new Map<string, { count: number; until: number }>();
const windowMs = 15 * 60_000;

export function clientIp(headers: Headers) {
  return verifiedClientAddress(headers, process.env.BOOKING_ADDRESS_SECRET);
}

export function checkRateLimit(
  route: "login" | "bookings",
  ip: string,
  consume = true,
  now = Date.now(),
) {
  for (const [key, bucket] of buckets)
    if (bucket.until <= now) buckets.delete(key);
  const key = `${route}:${ip}`;
  const bucket = buckets.get(key) ?? { count: 0, until: now + windowMs };
  if (bucket.count >= (route === "login" ? 5 : 30))
    throw new DomainError(
      "För många försök. Försök igen senare.",
      429,
      Math.max(1, Math.ceil((bucket.until - now) / 1000)),
    );
  if (consume) {
    if (!buckets.has(key) && buckets.size >= 10000)
      buckets.delete(buckets.keys().next().value!);
    bucket.count++;
    buckets.set(key, bucket);
  }
  return bucket.count;
}

export const LOGIN_FAILURE_DELAY_MS = 100;

// Reserve synchronously before checking credentials, including concurrent requests.
export async function checkLoginAttempt(
  ip: string,
  verify: () => boolean | Promise<boolean>,
) {
  let accepted = false;
  let reservation: { count: number } | undefined;
  try {
    checkRateLimit("login", ip);
    reservation = buckets.get(`login:${ip}`)!;
    accepted = await verify();
    if (accepted) reservation.count--;
    return accepted;
  } catch (error) {
    // Capacity denial made no guess; refund only this request's original bucket.
    if (error instanceof PasswordCapacityError && reservation)
      reservation.count--;
    throw error;
  } finally {
    // Locked requests never evaluate verify(), and get the same minimum delay.
    if (!accepted) await delay(LOGIN_FAILURE_DELAY_MS);
  }
}
