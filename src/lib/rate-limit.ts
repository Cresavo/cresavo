import { isPublicReadonly } from "./public-readonly";
import { setTimeout as delay } from "node:timers/promises";
import { verifiedClientAddress } from "../../scripts/client-address.mjs";
import { DomainError, PasswordCapacityError } from "./errors";

// One bounded map per process. No persistence or cross-worker guarantee.
const buckets = new Map<string, { count: number; until: number }>();
const windowMs = 15 * 60_000;

function postgresStore() {
  if (isPublicReadonly()) return false;
  const mode = process.env.RATE_LIMIT_STORE ?? "memory";
  if (!["memory", "postgres"].includes(mode) ||
      (process.env.VERCEL === "1" && mode !== "postgres"))
    throw new Error("RATE_LIMIT_CONFIG_INVALID");
  return mode === "postgres";
}

export function clientIp(headers: Headers) {
  return verifiedClientAddress(headers, process.env.BOOKING_ADDRESS_SECRET);
}

export function checkRateLimit(
  route: "login" | "bookings" | "admin-bookings" | "agent-api",
  ip: string,
  consume = true,
  now = Date.now(),
) {
  if (postgresStore())
    return import("./postgres-rate-limit").then(async (store) =>
      (await store.reserveRateLimit(route, ip, consume)).count,
    );
  for (const [key, bucket] of buckets)
    if (bucket.until <= now) buckets.delete(key);
  const key = `${route}:${ip}`;
  const bucket = buckets.get(key) ?? { count: 0, until: now + windowMs };
  const limit = route === "login" ? 5 : route === "admin-bookings" ? 60 : route === "agent-api" ? 300 : 30;
  if (bucket.count >= limit)
    throw new DomainError(
      "Too many attempts. Please try again later.",
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
