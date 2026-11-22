import type { Prisma, PrismaClient } from "@prisma/client";
import type { OutboxEntry } from "../connections/simulated/outbox";
import { detach, effectOf, type StoreEffect, type TenantId } from "./studio-store";

// Delivery of the `tenant_effect` outbox (docs/design/STUDIO_STORE.md, step 2,
// item 4). The in-apply drain of `PostgresStudioStore` and the poller
// (`drainPendingEffects`, run by scripts/drain-effects.mts) share this code, so
// both claim by the same rule:
//
//   - the row is pending and due: `next_attempt_at` has passed, which also
//     means no other deliverer holds a lease on it (a claim moves
//     `next_attempt_at` forward by the lease);
//   - a payment waits while an earlier payment of its tenant is pending or
//     failed, so a refund never overtakes (or outlives) its checkout;
//   - rows are taken in commit order, `(tenant_id, seq, n)`;
//   - `FOR UPDATE SKIP LOCKED`, so concurrent deliverers never take one row twice.
//
// One row is claimed per statement and acknowledged on its own, and no
// connection is held while a sink runs. A failed send backs off exponentially;
// after `maxAttempts` the row becomes `failed` for an operator to look at.

export type TenantKind = "salon" | "demo" | "sandbox";

/** One committed effect handed to a sink. `id` is stable and unique: use it as the provider's idempotency key. */
export interface EffectDelivery {
  id: string;
  tenantId: TenantId;
  tenantKind: TenantKind;
  seq: number;
  n: number;
  /** Which claim this is (the row's attempt count). A sink that must not run for a stale claim guards its writes by it. */
  attempt: number;
  effect: StoreEffect;
}

/**
 * Delivers one effect. Throwing leaves it pending for a retry; it may be called again for the same `id`.
 * Returning `"failed"` marks it failed at once, for a permanent error a retry cannot fix (a bad address).
 * Returning `"deferred"` leaves it pending without using up an attempt (delivery is paused).
 * Returning `"skipped"` acknowledges that there was nothing to send (an erased or cancelled booking): the row becomes
 * `delivered` only if it is still pending under this claim, so an erasure's `cancelled` stands.
 * `signal` aborts when the sink timeout is over: check it before anything that cannot be undone.
 */
export type SinkOutcome = void | "failed" | "deferred" | "skipped";
export type EffectSink = (delivery: EffectDelivery, signal: AbortSignal) => SinkOutcome | Promise<SinkOutcome>;

export type EffectSinks = Record<StoreEffect["kind"], EffectSink>;

/** How long a claimed effect is reserved for one deliverer before another may retry it. Sinks must give up well before it. */
export const EFFECT_LEASE_MS = 60_000;
/** Longest a sink may run before the send counts as failed and is retried. */
export const EFFECT_SINK_TIMEOUT_MS = 10_000;
/** Slack added to the sink timeout when it is longer than the lease, so no second deliverer can claim an effect a sink may still be sending. */
const LEASE_MARGIN_MS = 5_000;
/** Wait before a deferred effect is looked at again. */
const DEFER_MS = 60_000;
/** Attempts before an effect is marked `failed`. */
export const EFFECT_MAX_ATTEMPTS = 10;
/** Longest wait between two attempts. */
export const EFFECT_MAX_BACKOFF_MS = 3_600_000;

/** Wait before the next attempt after `attempts` failed ones: 2 s, 4 s, 8 s… up to an hour. */
export function effectBackoffMs(attempts: number): number {
  return Math.min(EFFECT_MAX_BACKOFF_MS, 1000 * 2 ** Math.max(1, attempts));
}

/** Simulated delivery: nothing leaves the process, the row is simply acknowledged. */
const acknowledge: EffectSink = () => {};
export const SIMULATED_SINKS: EffectSinks = { payment: acknowledge, message: acknowledge };

/** Epoch milliseconds from the database clock. */
export async function databaseClock(db: Prisma.TransactionClient): Promise<number> {
  const [row] = await db.$queryRaw<Array<{ ms: number }>>`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms`;
  return Math.floor(row.ms);
}

interface ClaimedRow {
  id: string;
  tenant_id: string;
  seq: bigint;
  n: number;
  kind: StoreEffect["kind"];
  payload: OutboxEntry;
  attempts: number;
  tenant_kind: TenantKind | null;
}

export interface DeliveryContext {
  db: PrismaClient;
  clock: () => Promise<number>;
  /** Live sinks, for `salon` tenants. Without them, salon effects are not claimed at all. */
  sinks?: EffectSinks;
  /** Sinks for `demo` and `sandbox` tenants. They never reach the live sinks, whatever these do. */
  simulatedSinks: EffectSinks;
  leaseMs: number;
  maxAttempts: number;
  /** A sink that runs longer counts as failed (and is retried). Default: no limit. */
  sinkTimeoutMs?: number;
  /** Total time `deliverDue` may spend claiming effects; past it, the rest is left to the poller. Default: no limit. */
  budgetMs?: number;
  /** Only these tenants' effects (the in-apply drain passes its own). */
  tenants?: readonly TenantId[];
}

/** Claims the next due effect by the shared rule, or returns undefined when there is none. */
async function claimNext(ctx: DeliveryContext): Promise<ClaimedRow | undefined> {
  const now = await ctx.clock();
  // A message's claim outlives the sink timeout, so a timed-out send is never raced by a second deliverer.
  // Other kinds (a refund behind a checkout) keep the plain lease and backoff.
  const messageLeaseMs = Math.max(ctx.leaseMs, (ctx.sinkTimeoutMs ?? 0) + LEASE_MARGIN_MS);
  const kinds = ctx.sinks ? null : ["demo", "sandbox"];
  const tenants = ctx.tenants ? [...ctx.tenants] : null;
  const [row] = await ctx.db.$queryRaw<ClaimedRow[]>`
    WITH next AS (
      SELECT e.tenant_id, e.seq, e.n
      FROM tenant_effect e
      LEFT JOIN tenant_state s ON s.tenant_id = e.tenant_id
      WHERE e.status = 'pending' AND e.next_attempt_at <= to_timestamp(${now}::float8 / 1000)
        AND e.erased_at IS NULL
        AND (s.expires_at IS NULL OR s.expires_at > to_timestamp(${now}::float8 / 1000))
        AND (${tenants}::text[] IS NULL OR e.tenant_id = ANY(${tenants}::text[]))
        AND (${kinds}::text[] IS NULL OR s.kind::text = ANY(${kinds}::text[]))
        AND (e.kind <> 'payment' OR NOT EXISTS (
          SELECT 1 FROM tenant_effect p
          WHERE p.tenant_id = e.tenant_id AND p.kind = 'payment' AND p.status IN ('pending', 'failed')
            AND (p.seq, p.n) < (e.seq, e.n)))
      ORDER BY e.tenant_id, e.seq, e.n
      LIMIT 1
      FOR UPDATE OF e SKIP LOCKED
    )
    UPDATE tenant_effect e
    SET attempts = e.attempts + 1,
        next_attempt_at = to_timestamp((${now}::float8 + CASE WHEN e.kind = 'message' THEN ${messageLeaseMs}::float8 ELSE ${ctx.leaseMs}::float8 END) / 1000),
        leased_until = to_timestamp((${now}::float8 + CASE WHEN e.kind = 'message' THEN ${messageLeaseMs}::float8 ELSE ${ctx.leaseMs}::float8 END) / 1000)
    FROM next
    WHERE e.tenant_id = next.tenant_id AND e.seq = next.seq AND e.n = next.n AND e.status = 'pending'
    RETURNING e.id, e.tenant_id, e.seq, e.n, e.kind, e.payload, e.attempts,
      (SELECT s.kind::text FROM tenant_state s WHERE s.tenant_id = e.tenant_id) AS tenant_kind`;
  return row;
}

/** The sink for a tenant: live only for a `salon`. A tenant whose row is gone gets none (the send fails and is retried). */
function sinkFor(ctx: DeliveryContext, row: ClaimedRow): EffectSink | undefined {
  if (row.tenant_kind === "demo" || row.tenant_kind === "sandbox") return ctx.simulatedSinks[row.kind];
  if (row.tenant_kind === "salon") return ctx.sinks?.[row.kind];
  return undefined;
}

export type DeliveryOutcome = "delivered" | "retry" | "failed";

const TIMEOUT = "STUDIO_STORE_SINK_TIMEOUT";

/** Runs the sink with a signal that aborts at the timeout, and rejects then; the sink itself is not stopped. */
function runSink(sink: EffectSink, delivery: EffectDelivery, ms: number | undefined) {
  const controller = new AbortController();
  const work = Promise.resolve(sink(detach(delivery), controller.signal));
  if (!ms) return work;
  let timer: ReturnType<typeof setTimeout>;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error(TIMEOUT)); }, ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

type Failure = "retry" | "permanent" | "timeout" | "deferred";

/**
 * Records a failed send for that row only. Only the deliverer that holds the
 * latest claim (same `attempts`) decides what happens next. A row an erasure
 * stopped meanwhile is cancelled, never retried; a permanent failure, or the
 * last attempt, makes it `failed`. After a timeout the claim is kept until its
 * lease runs out, because the send may still be running. A deferred row waits
 * and keeps its attempt.
 */
async function recordFailure(ctx: DeliveryContext, row: ClaimedRow, kind: Failure): Promise<DeliveryOutcome> {
  const now = await ctx.clock();
  const permanent = kind === "permanent";
  const deferred = kind === "deferred";
  const [outcome] = await ctx.db.$queryRaw<Array<{ status: string }>>`
    UPDATE tenant_effect SET
      leased_until = CASE WHEN ${kind === "timeout"}::boolean THEN leased_until END,
      attempts = CASE WHEN ${deferred}::boolean THEN greatest(attempts - 1, 0) ELSE attempts END,
      status = CASE WHEN erased_at IS NOT NULL THEN 'cancelled' WHEN ${permanent}::boolean OR (NOT ${deferred}::boolean AND attempts >= ${ctx.maxAttempts}) THEN 'failed' ELSE status END,
      next_attempt_at = CASE WHEN ${kind === "timeout"}::boolean THEN next_attempt_at
        ELSE to_timestamp(${now + (deferred ? DEFER_MS : effectBackoffMs(row.attempts))}::float8 / 1000) END
    WHERE id = ${row.id} AND status = 'pending' AND attempts = ${row.attempts}
    RETURNING status`;
  return outcome?.status === "failed" ? "failed" : "retry";
}

/** Sends one claimed row and records the outcome for that row only. */
async function deliver(ctx: DeliveryContext, row: ClaimedRow, timeoutMs: number | undefined): Promise<DeliveryOutcome> {
  const sink = sinkFor(ctx, row);
  let result: SinkOutcome;
  try {
    if (!sink) throw new Error("STUDIO_STORE_NO_SINK");
    const delivery: EffectDelivery = {
      id: row.id, tenantId: row.tenant_id, tenantKind: row.tenant_kind!, seq: Number(row.seq), n: row.n, attempt: row.attempts, effect: effectOf(row.payload),
    };
    result = await runSink(sink, delivery, timeoutMs);
  } catch (error) {
    // Never log the payload or the error: both may hold personal data.
    return recordFailure(ctx, row, error instanceof Error && error.message === TIMEOUT && row.kind === "message" ? "timeout" : "retry");
  }
  if (result === "failed") return recordFailure(ctx, row, "permanent");
  if (result === "deferred") return recordFailure(ctx, row, "deferred");
  if (result === "skipped") {
    const skippedAt = await ctx.clock();
    await ctx.db.$executeRaw`
      UPDATE tenant_effect SET status = 'delivered', leased_until = NULL, delivered_at = to_timestamp(${skippedAt}::float8 / 1000)
      WHERE id = ${row.id} AND status = 'pending' AND attempts = ${row.attempts}`;
    return "delivered";
  }
  // The send happened, so it is recorded as delivered whatever happened to the
  // row meanwhile (a lease that ran out, an erasure that tried to cancel it).
  const at = await ctx.clock();
  await ctx.db.$executeRaw`
    UPDATE tenant_effect SET status = 'delivered', leased_until = NULL, delivered_at = to_timestamp(${at}::float8 / 1000)
    WHERE id = ${row.id} AND status <> 'delivered'`;
  return "delivered";
}

export interface DrainReport {
  delivered: number;
  retried: number;
  failed: number;
}

/** Claims, sends and acknowledges due effects one at a time until none is due or `limit` rows were claimed. */
export async function deliverDue(ctx: DeliveryContext, limit: number): Promise<DrainReport> {
  const report: DrainReport = { delivered: 0, retried: 0, failed: 0 };
  // Rows an erasure stopped while a deliverer held them: once that lease is over
  // with no outcome (the deliverer died), they are cancelled, never sent again.
  const now = await ctx.clock();
  const tenants = ctx.tenants ? [...ctx.tenants] : null;
  await ctx.db.$executeRaw`
    UPDATE tenant_effect SET status = 'cancelled', leased_until = NULL
    WHERE status = 'pending' AND erased_at IS NOT NULL
      AND (leased_until IS NULL OR leased_until <= to_timestamp(${now}::float8 / 1000))
      AND (${tenants}::text[] IS NULL OR tenant_id = ANY(${tenants}::text[]))`;
  const started = performance.now();
  for (let claimed = 0; claimed < limit && (ctx.budgetMs === undefined || performance.now() - started < ctx.budgetMs); claimed++) {
    const row = await claimNext(ctx);
    if (!row) break;
    // A send near the end of the budget gets only what is left of it, not a full timeout.
    const left = ctx.budgetMs === undefined ? undefined : Math.max(1, ctx.budgetMs - (performance.now() - started));
    const outcome = await deliver(ctx, row, left === undefined ? ctx.sinkTimeoutMs : Math.min(left, ctx.sinkTimeoutMs ?? left));
    if (outcome === "delivered") report.delivered++;
    else if (outcome === "retry") report.retried++;
    else report.failed++;
  }
  return report;
}

export interface DrainPendingEffectsOptions {
  prisma: PrismaClient;
  /** Live sinks for `salon` tenants. Omit them and only demo and sandbox effects are delivered (to `simulatedSinks`). */
  sinks?: EffectSinks;
  /** Defaults to acknowledging without sending anything. */
  simulatedSinks?: EffectSinks;
  /** Epoch milliseconds. Defaults to the database clock. */
  now?: () => Promise<number>;
  /** Most rows claimed in this run. Default 100. */
  limit?: number;
  /** Default `EFFECT_LEASE_MS`. */
  leaseMs?: number;
  /** Default `EFFECT_MAX_ATTEMPTS`. */
  maxAttempts?: number;
  /** Only these tenants' effects (an operator draining one salon, or tests that share a database). */
  tenants?: readonly TenantId[];
}

/**
 * The outbox poller: one run over every tenant's due effects, for a cron or a
 * worker loop. Safe to run several at once; they never take the same row.
 * Effects of demo and sandbox tenants go to the simulated sinks only.
 */
export async function drainPendingEffects(options: DrainPendingEffectsOptions): Promise<DrainReport> {
  const { prisma } = options;
  const limit = positive(options.limit, 100);
  return deliverDue({
    db: prisma,
    clock: options.now ? async () => Math.floor(await options.now!()) : () => databaseClock(prisma),
    sinks: options.sinks,
    simulatedSinks: options.simulatedSinks ?? SIMULATED_SINKS,
    leaseMs: positive(options.leaseMs, EFFECT_LEASE_MS),
    maxAttempts: positive(options.maxAttempts, EFFECT_MAX_ATTEMPTS),
    sinkTimeoutMs: EFFECT_SINK_TIMEOUT_MS,
    tenants: options.tenants,
  }, limit);
}

function positive(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
}
