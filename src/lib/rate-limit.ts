import { isIP } from "node:net";
import { DomainError } from "./errors";

// One bounded map per process. No persistence or cross-worker guarantee.
const buckets = new Map<string, { count: number; until: number }>();
const windowMs = 15 * 60_000;

export function clientIp(headers: Headers) {
  // Enable only behind a proxy that overwrites this header and blocks direct access.
  const ip = headers.get("x-real-ip");
  return process.env.TRUST_PROXY_IP === "1" && ip && isIP(ip)
    ? ip
    : "local-shared";
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
  if (
    bucket.count >= (route === "login" ? 5 : 30) ||
    (!buckets.has(key) && buckets.size >= 10000)
  )
    throw new DomainError(
      "För många försök. Försök igen senare.",
      429,
      Math.max(1, Math.ceil((bucket.until - now) / 1000)),
    );
  if (consume) {
    bucket.count++;
    buckets.set(key, bucket);
  }
}

export function recordFailedLogin(ip: string) {
  checkRateLimit("login", ip);
}
