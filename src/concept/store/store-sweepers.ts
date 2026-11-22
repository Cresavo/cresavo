import type { PrismaClient } from "@prisma/client";
import { databaseClock } from "./effect-outbox";

const DEMO_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

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

export async function sweepExpiredIdempotency({ prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const cutoff = await (now ? now() : databaseClock(prisma));
  return sweepRows(limit, () => prisma.$executeRaw`
    WITH expired AS (
      SELECT tenant_id, key FROM tenant_idempotency
      WHERE expires_at <= to_timestamp(${cutoff}::float8 / 1000)
      ORDER BY expires_at, tenant_id, key LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM tenant_idempotency i USING expired e
    WHERE i.tenant_id = e.tenant_id AND i.key = e.key`);
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
    )`);
}

export async function sweepDemoActions({ prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const cutoff = await (now ? now() : databaseClock(prisma)) - DEMO_LOG_RETENTION_MS;
  return sweepRows(limit, () => prisma.$executeRaw`
    WITH expired AS (
      SELECT a.tenant_id, a.seq FROM tenant_action a JOIN tenant_state s USING (tenant_id)
      WHERE s.kind = 'demo' AND a.at < to_timestamp(${cutoff}::float8 / 1000)
      ORDER BY a.at, a.tenant_id, a.seq LIMIT ${limit}
      FOR UPDATE OF a SKIP LOCKED
    )
    DELETE FROM tenant_action a USING expired e
    WHERE a.tenant_id = e.tenant_id AND a.seq = e.seq`);
}

interface SandboxSweepCounts {
  tenants: number;
  actions: number;
  effects: number;
  idempotencyKeys: number;
}

export async function sweepExpiredSandboxes({ prisma, now, batch }: SweepOptions): Promise<SandboxSweepCounts> {
  const limit = batchSize(batch);
  const cutoff = await (now ? now() : databaseClock(prisma));
  const counts = { tenants: 0, actions: 0, effects: 0, idempotencyKeys: 0 };
  counts.tenants = await sweepRows(limit, async () => {
    const deleted = await prisma.$transaction(async (tx) => {
      // Hold the tenant locks through all four deletes so applies cannot
      // append rows to a sandbox left behind by this batch.
      const rows = await tx.$queryRaw<Array<{ tenant_id: string }>>`
        SELECT tenant_id FROM tenant_state
        WHERE kind = 'sandbox' AND expires_at <= to_timestamp(${cutoff}::float8 / 1000)
        ORDER BY expires_at, tenant_id LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`;
      const ids = rows.map((row) => row.tenant_id);
      if (!ids.length) return { tenants: 0, actions: 0, effects: 0, idempotencyKeys: 0 };
      const actions = await tx.$executeRaw`DELETE FROM tenant_action WHERE tenant_id = ANY(${ids}::text[])`;
      const effects = await tx.$executeRaw`DELETE FROM tenant_effect WHERE tenant_id = ANY(${ids}::text[])`;
      const idempotencyKeys = await tx.$executeRaw`DELETE FROM tenant_idempotency WHERE tenant_id = ANY(${ids}::text[])`;
      const tenants = await tx.$executeRaw`DELETE FROM tenant_state WHERE tenant_id = ANY(${ids}::text[])`;
      return { tenants, actions, effects, idempotencyKeys };
    }, { timeout: 15_000 });
    counts.actions += deleted.actions;
    counts.effects += deleted.effects;
    counts.idempotencyKeys += deleted.idempotencyKeys;
    return deleted.tenants;
  });
  return counts;
}
