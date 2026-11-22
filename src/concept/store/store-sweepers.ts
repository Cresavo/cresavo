import type { PrismaClient } from "@prisma/client";
import type { DemoAction } from "../actions";
import { activityCutoff, monthsBefore, OUTBOX_BODY_MS, RATE_LIMIT_MS, RETENTION } from "../privacy/retention";
import { databaseClock } from "./effect-outbox";
import { PERSONAL_FIELDS, redactAction } from "./erasure";

/** Set in an audit row's action once the age-based redaction has run on it. `redacted_at` is also set by an erasure, which only covers one customer. */
const RETENTION_MARK = "retentionRedacted";

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
    )
    -- Repeated in the delete itself: a row renewed since the selection survives.
    AND "expiresAt" <= to_timestamp(${cutoff}::float8 / 1000)`);
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

/**
 * Blanks the body, subject and address of messages in the outbox that are no
 * longer pending and were committed more than `RETENTION.outboxBodyDays` ago.
 * The row, its status, its provider key and the delivery outcome stay, so the
 * delivery history, reconciliation and the idempotency of retries are untouched. A recipient that is only an opaque
 * `customer:<id>` reference stays. Safe to run any time and again.
 */
export async function sweepOutboxBodies({ prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const cutoff = await (now ? now() : databaseClock(prisma)) - OUTBOX_BODY_MS;
  return sweepRows(limit, () => prisma.$executeRaw`
    WITH due AS (
      SELECT e.tenant_id, e.seq, e.n FROM tenant_effect e
      LEFT JOIN tenant_action a ON a.tenant_id = e.tenant_id AND a.seq = e.seq
      WHERE e.kind = 'message' AND e.status <> 'pending'
        AND coalesce(a.at, e.delivered_at, e.next_attempt_at) < to_timestamp(${cutoff}::float8 / 1000)
        -- Each private field is judged on its own: a body that was blanked does not clear a subject, an address or a stored copy.
        AND (e.payload ->> 'body' IS DISTINCT FROM '[redacted]'
          OR (e.payload ? 'subject' AND e.payload ->> 'subject' IS DISTINCT FROM '[redacted]')
          OR (e.payload ? 'to' AND e.payload ->> 'to' IS DISTINCT FROM '[redacted]'
              AND coalesce(e.payload ->> 'to', '') !~ '^customer:[A-Za-z0-9_.:-]+(, *customer:[A-Za-z0-9_.:-]+)*$')
          OR e.payload #> '{delivery,mail}' IS NOT NULL)
      ORDER BY e.tenant_id, e.seq, e.n LIMIT ${limit}
      FOR UPDATE OF e SKIP LOCKED
    )
    UPDATE tenant_effect e SET payload =
      (e.payload - 'delivery') || jsonb_build_object('body', '[redacted]')
      -- The stored copy of the mail goes; the outcome (sent, reason) stays for whoever reconciles an uncertain send.
      || CASE WHEN jsonb_typeof(e.payload -> 'delivery') = 'object' THEN jsonb_build_object('delivery', (e.payload -> 'delivery') - 'mail') ELSE '{}'::jsonb END
      || CASE WHEN e.payload ? 'subject' THEN jsonb_build_object('subject', '[redacted]') ELSE '{}'::jsonb END
      || CASE WHEN e.payload ? 'to' AND coalesce(e.payload ->> 'to', '') !~ '^customer:[A-Za-z0-9_.:-]+(, *customer:[A-Za-z0-9_.:-]+)*$'
              THEN jsonb_build_object('to', '[redacted]') ELSE '{}'::jsonb END
    FROM due d WHERE e.tenant_id = d.tenant_id AND e.seq = d.seq AND e.n = d.n`);
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

/**
 * Replaces the personal fields (`PERSONAL_FIELDS`) of audit rows older than
 * `RETENTION.activityPersonalDataMonths` with `[redacted]`, the same way an
 * erasure does, and sets `redacted_at`. The informational idempotency key
 * column, which can embed an address, is cleared. Needs UPDATE on the
 * `action`, `idempotency_key` and `redacted_at` columns of `tenant_action`
 * (see docs/design/STUDIO_STORE.md, Retention).
 */
export async function sweepActivityPersonalData({ prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const at = await (now ? now() : databaseClock(prisma));
  const cutoff = activityCutoff(at);
  const types = Object.keys(PERSONAL_FIELDS);
  // A caller's key can embed an address, whatever the action was: every old row loses it.
  const keys = await sweepRows(limit, () => prisma.$executeRaw`
    WITH old AS (
      SELECT tenant_id, seq FROM tenant_action
      WHERE at < to_timestamp(${cutoff}::float8 / 1000) AND idempotency_key IS NOT NULL
      ORDER BY at, tenant_id, seq LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE tenant_action a SET idempotency_key = NULL FROM old o WHERE a.tenant_id = o.tenant_id AND a.seq = o.seq`);
  const redacted = await sweepRows(limit, () => prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ tenant_id: string; seq: bigint; action: DemoAction }>>`
      SELECT tenant_id, seq, action FROM tenant_action
      WHERE at < to_timestamp(${cutoff}::float8 / 1000) AND NOT (action ? ${RETENTION_MARK}) AND action ->> 'type' = ANY(${types}::text[])
      ORDER BY at, tenant_id, seq LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    for (const row of rows) {
      await tx.$executeRaw`
        UPDATE tenant_action SET action = ${JSON.stringify({ ...redactAction(row.action), [RETENTION_MARK]: true })}::jsonb, idempotency_key = NULL,
          redacted_at = coalesce(redacted_at, to_timestamp(${at}::float8 / 1000))
        WHERE tenant_id = ${row.tenant_id} AND seq = ${row.seq}`;
    }
    return rows.length;
  }, { timeout: 15_000 }));
  return keys + redacted;
}

/**
 * Deletes the audit copies of `journal/view` older than `RETENTION.journalAccessLogMonths`: the studio's own
 * log (`journalAccess`) is pruned the same way, so the two never disagree about what is still kept.
 */
export async function sweepJournalAccessRows({ prisma, now, batch }: SweepOptions): Promise<number> {
  const limit = batchSize(batch);
  const cutoff = monthsBefore(await (now ? now() : databaseClock(prisma)), RETENTION.journalAccessLogMonths);
  return sweepRows(limit, () => prisma.$executeRaw`
    WITH old AS (
      SELECT tenant_id, seq FROM tenant_action
      WHERE action ->> 'type' = 'journal/view' AND at < to_timestamp(${cutoff}::float8 / 1000)
      ORDER BY at, tenant_id, seq LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    DELETE FROM tenant_action a USING old o WHERE a.tenant_id = o.tenant_id AND a.seq = o.seq`);
}
