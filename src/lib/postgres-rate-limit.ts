import { createHmac, randomUUID } from "node:crypto";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { DomainError } from "./errors";
import { RATE_POLICY, type RateRoute } from "./rate-limit-policy";

// Separate, one-connection pool: booking transactions may already own every
// connection in the domain pool. A rejected booking must still consume a try.
export const rateLimitDatabase = createDatabaseClient(undefined, 1);
export type Reservation = { key: string; generation: string; count: number };

function bucketKey(route: RateRoute, identity: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_CONFIG_INVALID");
  const digest = createHmac("sha256", secret)
    .update(`rate-limit:v1:${route}:${identity}`)
    .digest("hex");
  // Account locks carry a prefix: they are exempt from the capacity limit and from eviction below.
  return route === "login-lock" ? `${LOCK_PREFIX}${digest}` : digest;
}

const LOCK_PREFIX = "lock:";

export async function reserveRateLimit(
  route: RateRoute,
  identity: string,
  consume = true,
  windowMs?: number,
): Promise<Reservation> {
  const key = bucketKey(route, identity);
  const { limit, windowMs: defaultWindowMs } = RATE_POLICY[route];
  return rateLimitDatabase.$transaction(async (tx) => {
    // Small bounded preview store. This lock has no domain/session dependencies;
    // it is released before credential verification or booking processing.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking-lab:rate-store:v1'))`;
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
      SELECT clock_timestamp() AS now`;
    await tx.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" IN (
      SELECT "key" FROM "RateLimitBucket" WHERE "expiresAt" <= ${now}
      ORDER BY "expiresAt", "key" LIMIT 100
    )`;
    const previous = await tx.rateLimitBucket.findUnique({ where: { key } });
    const active = previous && previous.expiresAt > now ? previous : null;
    if (active && active.count >= limit)
      throw new DomainError(
        "Too many attempts. Please try again later.",
        429,
        Math.max(1, Math.ceil((active.expiresAt.getTime() - now.getTime()) / 1000)),
      );
    if (!consume)
      return { key, generation: active?.generation ?? "", count: active?.count ?? 0 };
    const evictable = { key: { not: { startsWith: LOCK_PREFIX } } };
    if (!previous && route !== "login-lock" && (await tx.rateLimitBucket.count({ where: evictable })) >= 10000) {
      const oldest = await tx.rateLimitBucket.findFirstOrThrow({
        where: evictable,
        orderBy: [{ expiresAt: "asc" }, { key: "asc" }],
      });
      await tx.rateLimitBucket.delete({ where: { key: oldest.key } });
    }
    const value = {
      generation: active?.generation ?? randomUUID(),
      expiresAt: active?.expiresAt ?? new Date(now.getTime() + (windowMs ?? defaultWindowMs)),
      count: (active?.count ?? 0) + 1,
    };
    await tx.rateLimitBucket.upsert({
      where: { key }, create: { key, ...value }, update: value,
    });
    return { key, generation: value.generation, count: value.count };
  }, { maxWait: 30000, timeout: 10000 });
}

export async function decrementRateLimit(route: RateRoute, identity: string) {
  const key = bucketKey(route, identity);
  await rateLimitDatabase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking-lab:rate-store:v1'))`;
    await tx.rateLimitBucket.updateMany({ where: { key, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
  }, { maxWait: 30000, timeout: 10000 });
}

export async function clearRateLimit(route: RateRoute, identity: string) {
  const key = bucketKey(route, identity);
  await rateLimitDatabase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking-lab:rate-store:v1'))`;
    await tx.rateLimitBucket.deleteMany({ where: { key } });
  }, { maxWait: 30000, timeout: 10000 });
}

export async function refundRateLimit(reservation: Reservation) {
  // An old, expired or evicted reservation can never lower a new window.
  await rateLimitDatabase.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking-lab:rate-store:v1'))`;
    await tx.rateLimitBucket.updateMany({
      where: {
        key: reservation.key, generation: reservation.generation, count: { gt: 0 },
      },
      data: { count: { decrement: 1 } },
    });
  }, { maxWait: 30000, timeout: 10000 });
}
