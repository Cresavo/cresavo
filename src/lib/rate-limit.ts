import { isPublicReadonly } from "./public-readonly";
import { setTimeout as delay } from "node:timers/promises";
import { verifiedClientAddress } from "../../scripts/client-address.mjs";
import { DomainError, PasswordCapacityError } from "./errors";
import { RATE_POLICY, type RateRoute } from "./rate-limit-policy";

// One bounded map per process. No persistence or cross-worker guarantee.
const buckets = new Map<string, { count: number; until: number }>();
// Limits and windows: rate-limit-policy.ts. "public-tenant" is the writes one salon takes from the public, whoever sends them: 60 per hour.

function postgresStore() {
  if (isPublicReadonly()) return false;
  const mode = process.env.RATE_LIMIT_STORE ?? "memory";
  if (!["memory", "postgres"].includes(mode) ||
      (process.env.VERCEL === "1" && mode !== "postgres"))
    throw new Error("RATE_LIMIT_CONFIG_INVALID");
  return mode === "postgres";
}

const isLock = (route: RateRoute) => route === "login-lock";
const lockBuckets = new Map<string, { count: number; until: number }>();

export function clientIp(headers: Headers) {
  return verifiedClientAddress(headers, process.env.BOOKING_ADDRESS_SECRET);
}

export function checkRateLimit(
  route: RateRoute,
  ip: string,
  consume = true,
  now = Date.now(),
  /** Length of a new window, when it should not be the route's default. */
  windowMs?: number,
) {
  if (postgresStore())
    return import("./postgres-rate-limit").then(async (store) =>
      (await store.reserveRateLimit(route, ip, consume, windowMs)).count,
    );
  for (const [key, bucket] of buckets)
    if (bucket.until <= now) buckets.delete(key);
  for (const [key, bucket] of lockBuckets)
    if (bucket.until <= now) lockBuckets.delete(key);
  // Account locks live apart from the capped map: evicting one would unlock an account early.
  const store = isLock(route) ? lockBuckets : buckets;
  const key = `${route}:${ip}`;
  const policy = RATE_POLICY[route];
  const bucket = store.get(key) ?? { count: 0, until: now + (windowMs ?? policy.windowMs) };
  const limit = policy.limit;
  if (bucket.count >= limit)
    throw new DomainError(
      "Too many attempts. Please try again later.",
      429,
      Math.max(1, Math.ceil((bucket.until - now) / 1000)),
    );
  if (consume) {
    if (store === buckets && !store.has(key) && store.size >= 10000)
      store.delete(store.keys().next().value!);
    bucket.count++;
    store.set(key, bucket);
  }
  return bucket.count;
}

/** Gives back one use of a bucket, for an attempt that was reserved but never judged (the password check had no capacity). */
export async function refundBucketUse(route: RateRoute, identity: string) {
  if (postgresStore()) return (await import("./postgres-rate-limit")).decrementRateLimit(route, identity);
  const bucket = (isLock(route) ? lockBuckets : buckets).get(`${route}:${identity}`);
  if (bucket && bucket.count > 0) bucket.count--;
}

/** Forgets one identity's bucket: a successful login clears its failures, a password reset its lock. */
export async function clearRateLimit(route: RateRoute, identity: string) {
  if (postgresStore()) return (await import("./postgres-rate-limit")).clearRateLimit(route, identity);
  (isLock(route) ? lockBuckets : buckets).delete(`${route}:${identity}`);
}

export const LOGIN_FAILURE_DELAY_MS = 100;

// Reserve synchronously before checking credentials, including concurrent requests.
export async function checkLoginAttempt(
  ip: string,
  verify: () => boolean | Promise<boolean>,
) {
  let accepted = false;
  let refund: (() => void | Promise<void>) | undefined;
  try {
    if (postgresStore()) {
      const store = await import("./postgres-rate-limit");
      const reservation = await store.reserveRateLimit("login", ip);
      refund = () => store.refundRateLimit(reservation);
    } else {
      checkRateLimit("login", ip);
      const reservation = buckets.get(`login:${ip}`)!;
      refund = () => { reservation.count--; };
    }
    accepted = await verify();
    if (accepted) await refund();
    return accepted;
  } catch (error) {
    // Capacity denial made no guess; refund only this request's original bucket.
    if (error instanceof PasswordCapacityError && refund) await refund();
    throw error;
  } finally {
    // Locked requests never evaluate verify(), and get the same minimum delay.
    if (!accepted) await delay(LOGIN_FAILURE_DELAY_MS);
  }
}
