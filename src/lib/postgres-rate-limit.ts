import { createHmac, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { DomainError } from "./errors";
import { GUARD_PREFIXES } from "./owner-guard-keys";
import { RATE_LIMITS, type RateLimitRoute as Route } from "./rate-limit-policy";

// Separate, one-connection pool: booking transactions may already own every
// connection in the domain pool. A rejected booking must still consume a try.
export const rateLimitDatabase = createDatabaseClient(undefined, 1);
export type Reservation = { key: string; generation: string; count: number };

type Tx = Prisma.TransactionClient;

/** One reservation inside a transaction: the bounded store's single implementation, under its one lock. */
async function reserveIn(tx: Tx, route: Route, key: string, consume: boolean): Promise<Reservation> {
  const { limit, minutes } = RATE_LIMITS[route];
  // Small bounded preview store. This lock has no domain/session dependencies;
  // it is released before credential verification or booking processing.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking-lab:rate-store:v1'))`;
  const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`
    SELECT clock_timestamp() AS now`;
  await tx.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" IN (
    SELECT "key" FROM "RateLimitBucket" WHERE "expiresAt" <= ${now}
      AND "key" NOT LIKE 'acct:%' AND "key" NOT LIKE 'strike:%' AND "key" NOT LIKE 'lock:%' AND "key" NOT LIKE 'mbx:%'
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
  // Owner guard rows have their own caps and never count towards this one or get evicted for it.
  const ordinary = { NOT: GUARD_PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })) };
  if (!previous && (await tx.rateLimitBucket.count({ where: ordinary })) >= 10000) {
    // The normal sweep is bounded; finish it before refusing a new identity.
    await tx.rateLimitBucket.deleteMany({ where: { ...ordinary, expiresAt: { lte: now } } });
    if ((await tx.rateLimitBucket.count({ where: ordinary })) >= 10000)
      throw new DomainError("Too many attempts. Please try again later.", 429, 1);
  }
  const value = {
    generation: active?.generation ?? randomUUID(),
    expiresAt: active?.expiresAt ?? new Date(now.getTime() + minutes * 60_000),
    count: (active?.count ?? 0) + 1,
  };
  await tx.rateLimitBucket.upsert({
    where: { key }, create: { key, ...value }, update: value,
  });
  return { key, generation: value.generation, count: value.count };
}

/**
 * Takes one unit of a bucket inside the caller's own transaction, so the unit is kept only when that
 * transaction commits: a booking that fails after its allowance was taken gives it back by rolling
 * back. It is the same bounded reservation, under the same lock, held until the caller's transaction
 * ends; the caller has taken its own row locks first and the rate store takes none of them. At the
 * limit this throws the same 429 as `reserveRateLimit`.
 */
export async function reserveRateLimitIn(tx: Tx, route: Route, identity: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_CONFIG_INVALID");
  const key = createHmac("sha256", secret)
    .update(`rate-limit:v1:${route}:${identity}`)
    .digest("hex");
  await reserveIn(tx, route, key, true);
}

export async function reserveRateLimit(
  route: Route,
  identity: string,
  consume = true,
): Promise<Reservation> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_CONFIG_INVALID");
  const key = createHmac("sha256", secret)
    .update(`rate-limit:v1:${route}:${identity}`)
    .digest("hex");
  return rateLimitDatabase.$transaction((tx) => reserveIn(tx, route, key, consume), { maxWait: 30000, timeout: 10000 });
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

/** Shared, non-sensitive deployment quota; no client identity or secret is stored. */
export async function reserveReceptionistCall(identity = "all", database = rateLimitDatabase) {
  const key = `receptionist:daily:v1:${identity}`;
  return database.$transaction(
    (tx) => reserveIn(tx, "receptionist-daily", key, true),
    { maxWait: 30000, timeout: 10000 },
  );
}
