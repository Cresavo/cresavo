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
// after `maxAttempts` the row becomes `failed` for an operator to look at
// (`npm run effects:reconcile`, docs/operations/INCIDENT_RUNBOOK.md).
//
// `CONCEPT_EMAIL_PAUSED=1` holds e-mail: no deliverer, poller or in-apply
// drain, claims an e-mail row while it is set, so due rows stay pending with
// their attempts untouched and go out once it is unset. Staging is unchanged.
// A row claimed just before the switch is released before its sink runs (or,
// from the message sink, right before the provider call) without spending its
// attempt. `attempts` only ever grows: it is also a claim's identity, so what
// does not count is kept in `delivery.attemptBase` instead.

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
 * Returning `"held"` is a deferral the sink decided after it marked the message `dispatched` but before any request
 * left: the outbox drops that marker (`delivery.dispatched`, `provider`, `account`, and a `submittedAt` this claim set)
 * in the same guarded write that releases the row, so a paused send can never look like one that may have gone out.
 * Returning `"skipped"` acknowledges that there was nothing to send (an erased or cancelled booking): the row becomes
 * `delivered` only if it is still pending under this claim, so an erasure's `cancelled` stands.
 * `signal` aborts when the sink timeout is over: check it before anything that cannot be undone.
 */
export type SinkOutcome = void | "failed" | "deferred" | "held" | "skipped";
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

/** E-mail delivery is paused (`CONCEPT_EMAIL_PAUSED=1`): read on every claim, so a long drain notices too. */
export const emailDeliveryPaused = () => process.env.CONCEPT_EMAIL_PAUSED === "1";

/**
 * The error codes a message row keeps (`delivery.lastError`) for whoever reconciles it. Only these: any other
 * error is kept as `OTHER_ERROR`, so no exception text (which may hold personal data) is ever stored.
 */
export const EFFECT_ERROR_CODES = new Set([
  "EMAIL_NOT_CONFIGURED", "EMAIL_RETRYABLE", "EMAIL_UNCERTAIN", "EMAIL_TIMEOUT", "EMAIL_CLAIM_LOST",
  "STUDIO_STORE_SINK_TIMEOUT", "STUDIO_STORE_NO_SINK", "OTHER_ERROR",
]);

/** Whether a claimed row is an e-mail that the pause holds. */
const heldByPause = (row: { kind: string; payload: OutboxEntry }) => row.kind === "message" && row.payload?.port === "email" && emailDeliveryPaused();

/**
 * Attempts that do not count toward `maxAttempts`: the deferrals, and everything before an operator's retry.
 * `attempts` itself only ever grows, because it is also the identity of a claim: a stale deliverer's guarded
 * writes (`attempts = <its claim>`) can never match a later claim.
 */
const attemptBase = (row: { payload: OutboxEntry }) => {
  const base = row.payload?.delivery?.attemptBase;
  return typeof base === "number" && Number.isInteger(base) && base >= 0 ? base : 0;
};

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
  const paused = emailDeliveryPaused();
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
        AND NOT (${paused}::boolean AND e.kind = 'message' AND e.payload->>'port' = 'email')
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

export type DeliveryOutcome = "delivered" | "retry" | "failed" | "skipped";

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

type Failure = "retry" | "permanent" | "timeout" | "deferred" | "held";

/**
 * Records a failed send for that row only. Only the deliverer that holds the
 * latest claim (same `attempts`) decides what happens next. A row an erasure
 * stopped meanwhile is cancelled, never retried; a permanent failure, or the
 * last attempt, makes it `failed`. After a timeout the claim is kept until its
 * lease runs out, because the send may still be running. A deferred row waits:
 * its attempt is added to `delivery.attemptBase`, so it does not count, and
 * `attempts` is never lowered. A message row keeps the error's code
 * (`delivery.lastError`, allowlisted).
 */
async function recordFailure(ctx: DeliveryContext, row: ClaimedRow, kind: Failure, code?: string): Promise<DeliveryOutcome> {
  const now = await ctx.clock();
  const permanent = kind === "permanent";
  const held = kind === "held";
  const deferred = kind === "deferred" || held;
  const lastError = row.kind === "message" && code ? (EFFECT_ERROR_CODES.has(code) ? code : "OTHER_ERROR") : null;
  const base = attemptBase(row);
  const counted = row.attempts - base;
  const patch = { ...(deferred ? { attemptBase: base + 1 } : {}), ...(lastError ? { lastError } : {}) };
  // A held send never left: the marker this claim set goes. A first-submission time from an earlier claim stays.
  const drop = held ? ["dispatched", "provider", "account", ...(row.payload?.delivery?.submittedAt === undefined ? ["submittedAt"] : [])] : [];
  const [outcome] = await ctx.db.$queryRaw<Array<{ status: string }>>`
    UPDATE tenant_effect SET
      payload = CASE WHEN ${Object.keys(patch).length === 0 && drop.length === 0}::boolean THEN payload
        ELSE jsonb_set(payload, '{delivery}', (coalesce(payload->'delivery', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb) - ${drop}::text[]) END,
      leased_until = CASE WHEN ${kind === "timeout"}::boolean THEN leased_until END,
      status = CASE WHEN erased_at IS NOT NULL THEN 'cancelled' WHEN ${permanent}::boolean OR (NOT ${deferred}::boolean AND ${counted}::int >= ${ctx.maxAttempts}) THEN 'failed' ELSE status END,
      next_attempt_at = CASE WHEN ${kind === "timeout"}::boolean THEN next_attempt_at
        ELSE to_timestamp(${now + (deferred ? DEFER_MS : effectBackoffMs(counted))}::float8 / 1000) END
    WHERE id = ${row.id} AND status = 'pending' AND attempts = ${row.attempts}
    RETURNING status`;
  return outcome?.status === "failed" ? "failed" : "retry";
}

/** Sends one claimed row and records the outcome for that row only. */
async function deliver(ctx: DeliveryContext, row: ClaimedRow, timeoutMs: number | undefined): Promise<DeliveryOutcome> {
  // Paused after this row was claimed: released untouched, before any sink (simulated ones too) runs.
  if (heldByPause(row)) return recordFailure(ctx, row, "deferred");
  const sink = sinkFor(ctx, row);
  let result: SinkOutcome;
  try {
    if (!sink) throw new Error("STUDIO_STORE_NO_SINK");
    const delivery: EffectDelivery = {
      id: row.id, tenantId: row.tenant_id, tenantKind: row.tenant_kind!, seq: Number(row.seq), n: row.n, attempt: row.attempts, effect: effectOf(row.payload),
    };
    result = await runSink(sink, delivery, timeoutMs);
  } catch (error) {
    // Never log the payload or the error: both may hold personal data. Only a plain code is kept.
    const code = error instanceof Error ? error.message : undefined;
    // A timed-out send may still be running, so it keeps its claim even when paused; any other failure under the pause waits.
    if (code === TIMEOUT && row.kind === "message") return recordFailure(ctx, row, "timeout", code);
    return recordFailure(ctx, row, heldByPause(row) ? "deferred" : "retry", code);
  }
  // The pause beats a failure: the row waits, and a reason the sink saved still decides once delivery resumes.
  if (result === "held") return recordFailure(ctx, row, "held");
  if (result === "deferred" || (result === "failed" && heldByPause(row))) return recordFailure(ctx, row, "deferred");
  if (result === "failed") return recordFailure(ctx, row, "permanent");
  if (result === "skipped") {
    const skippedAt = await ctx.clock();
    const changed = await ctx.db.$executeRaw`
      UPDATE tenant_effect SET status = 'delivered', leased_until = NULL, delivered_at = to_timestamp(${skippedAt}::float8 / 1000)
      WHERE id = ${row.id} AND status = 'pending' AND attempts = ${row.attempts}`;
    // Nothing was sent, and a row that was cancelled meanwhile (an erasure) stays so.
    return changed ? "delivered" : "skipped";
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
  /** Effects with nothing left to send (an erased booking) that were already cancelled. Absent when there were none. */
  skipped?: number;
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
    else if (outcome === "skipped") report.skipped = (report.skipped ?? 0) + 1;
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
