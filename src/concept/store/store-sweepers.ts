import type { PrismaClient } from "@prisma/client";
import { RATE_LIMIT_MS } from "../privacy/retention";
import { databaseClock } from "./effect-outbox";
import { scoped, SWEEP_SCOPE } from "./tenant-scope";

// The store sweeps are fixed SECURITY DEFINER functions (store_sweep_* in
// migration store_rls_policies) with the retention cutoffs inside: the sweeper
// login has no privilege on the store tables, and a clock it passes can only
// make a sweep do less (the functions never judge by a time later than the
// database clock, except for the table owner, whose tests replay a fixed one).
// Each call runs in the sweep scope and removes one batch. The rate-limit table
// has no row-level security and is swept directly.

interface SweepOptions {
  prisma: PrismaClient;
  /** Overrides the database clock for tests. */
  now?: () => Promise<number>;
  batch?: number;
}

function batchSize(batch = 500) {
  if (!Number.isSafeInteger(batch) || batch <= 0) throw new RangeError("Invalid sweep batch size");
  return batch;
}

async function sweepRows(limit: number, remove: () => Promise<number>) {
  let total = 0;
  let deleted: number;
  do {
    deleted = await remove();
    total += deleted;
  } while (deleted === limit);
  return total;
}

type StoreSweep = "idempotency" | "demo_actions" | "outbox_bodies" | "activity_keys" | "activity_redact" | "journal_views";

/** Runs one store sweep function until a batch comes back short. */
async function storeSweep(sweep: StoreSweep, { prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const at = await (now ? now() : databaseClock(prisma));
  const call = (db: Parameters<Parameters<typeof scoped>[2]>[0]) => {
    const time = Math.floor(at);
    switch (sweep) {
      case "idempotency": return db.$queryRaw<Array<{ n: number }>>`SELECT store_sweep_idempotency(to_timestamp(${time}::float8 / 1000), ${limit}::int) AS n`;
      case "demo_actions": return db.$queryRaw<Array<{ n: number }>>`SELECT store_sweep_demo_actions(to_timestamp(${time}::float8 / 1000), ${limit}::int) AS n`;
      case "outbox_bodies": return db.$queryRaw<Array<{ n: number }>>`SELECT store_sweep_outbox_bodies(to_timestamp(${time}::float8 / 1000), ${limit}::int) AS n`;
      case "activity_keys": return db.$queryRaw<Array<{ n: number }>>`SELECT store_sweep_activity_keys(to_timestamp(${time}::float8 / 1000), ${limit}::int) AS n`;
      case "activity_redact": return db.$queryRaw<Array<{ n: number }>>`SELECT store_sweep_activity_redact(to_timestamp(${time}::float8 / 1000), ${limit}::int) AS n`;
      case "journal_views": return db.$queryRaw<Array<{ n: number }>>`SELECT store_sweep_journal_views(to_timestamp(${time}::float8 / 1000), ${limit}::int) AS n`;
    }
  };
  return sweepRows(limit, async () => (await scoped(prisma, SWEEP_SCOPE, call))[0].n);
}

/** Deletes expired idempotency keys. */
export const sweepExpiredIdempotency = (options: SweepOptions) => storeSweep("idempotency", options);

/** Deletes demo audit rows older than seven days. */
export const sweepDemoActions = (options: SweepOptions) => storeSweep("demo_actions", options);

/**
 * Blanks the body, subject and address of messages in the outbox that are no
 * longer pending and were committed more than `RETENTION.outboxBodyDays` ago.
 * The row, its status, its provider key and the delivery outcome stay, so the
 * delivery history, reconciliation and the idempotency of retries are untouched. A recipient that is only an opaque
 * `customer:<id>` reference stays. Safe to run any time and again.
 */
export const sweepOutboxBodies = (options: SweepOptions) => storeSweep("outbox_bodies", options);

/**
 * Replaces the personal fields (`PERSONAL_FIELDS`) of audit rows older than
 * `RETENTION.activityPersonalDataMonths` with `[redacted]`, the same way an
 * erasure does, marks them (`retentionRedacted`) and sets `redacted_at`. Every
 * old row loses its informational idempotency key, which can embed an address.
 */
export async function sweepActivityPersonalData(options: SweepOptions): Promise<number> {
  return (await storeSweep("activity_keys", options)) + (await storeSweep("activity_redact", options));
}

/**
 * Deletes the audit copies of `journal/view` older than `RETENTION.journalAccessLogMonths`: the studio's own
 * log (`journalAccess`) is pruned the same way, so the two never disagree about what is still kept.
 */
export const sweepJournalAccessRows = (options: SweepOptions) => storeSweep("journal_views", options);

interface SandboxSweepCounts {
  tenants: number;
  actions: number;
  effects: number;
  idempotencyKeys: number;
}

/** Deletes expired sandboxes and all their rows, a batch of tenants at a time under their locks. */
export async function sweepExpiredSandboxes({ prisma, now, batch }: SweepOptions): Promise<SandboxSweepCounts> {
  const limit = batchSize(batch);
  const at = Math.floor(await (now ? now() : databaseClock(prisma)));
  const counts = { tenants: 0, actions: 0, effects: 0, idempotencyKeys: 0 };
  counts.tenants = await sweepRows(limit, async () => {
    const [{ deleted }] = await scoped(prisma, SWEEP_SCOPE, (db) => db.$queryRaw<Array<{ deleted: SandboxSweepCounts }>>`
      SELECT store_sweep_sandboxes(to_timestamp(${at}::float8 / 1000), ${limit}::int) AS deleted`);
    counts.actions += deleted.actions;
    counts.effects += deleted.effects;
    counts.idempotencyKeys += deleted.idempotencyKeys;
    return deleted.tenants;
  });
  return counts;
}

/**
 * Deletes expired owner sign-in lock state and reset-mail quota rows (the `acct:`, `strike:`, `lock:` and `mbx:`
 * keys of owner-guard-store.ts, kept in the shared rate-limit table). Active rows are never touched.
 */
export async function sweepOwnerGuardBuckets({ prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const cutoff = await (now ? now() : databaseClock(prisma));
  return sweepRows(limit, () => prisma.$executeRaw`
    DELETE FROM "RateLimitBucket" WHERE "key" IN (
      SELECT "key" FROM "RateLimitBucket"
      WHERE "expiresAt" <= to_timestamp(${cutoff}::float8 / 1000)
        AND ("key" LIKE 'acct:%' OR "key" LIKE 'strike:%' OR "key" LIKE 'lock:%' OR "key" LIKE 'mbx:%')
      ORDER BY "expiresAt", "key" LIMIT ${limit}
    )
    -- Repeated in the delete itself: a row renewed since the selection survives.
    AND "expiresAt" <= to_timestamp(${cutoff}::float8 / 1000)`);
}

/** Deletes rate-limit rows that expired more than `RETENTION.rateLimitDays` ago. */
export async function sweepRateLimits({ prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const cutoff = await (now ? now() : databaseClock(prisma)) - RATE_LIMIT_MS;
  return sweepRows(limit, () => prisma.$executeRaw`
    WITH expired AS (
      SELECT "key" FROM "RateLimitBucket"
      WHERE "expiresAt" < to_timestamp(${cutoff}::float8 / 1000)
      ORDER BY "expiresAt", "key" LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM "RateLimitBucket" r USING expired e WHERE r."key" = e."key"`);
}
