import { createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { DemoAction } from "../actions";
import { DEMO_CHANNEL_CURRENCY, withDemoChannels } from "../connections/demo";
import type { OutboxEntry } from "../connections/simulated/outbox";
import { withSlotClock } from "../data/slots";
import type { DemoState } from "../data/types";
import { withTenantPresentation } from "../i18n/presentation";
import { defaultMeta, prepareAction } from "../log/capture";
import type { LogActor, LogSource } from "../log/types";
import { effectId, requestFingerprint, stagedChannels } from "./staged-channels";
import {
  actionFingerprint,
  detach,
  effectOf,
  HISTORY_MAX_LIMIT,
  migrateSaved,
  notifyAll,
  sameContent,
  withTrustedTimes,
  type ApplyMeta,
  type ApplyOptions,
  type ApplyResult,
  type HistoryPage,
  type HistoryQuery,
  type StoreChange,
  type StoreEffect,
  type StoreSnapshot,
  type StudioStore,
  type TenantAction,
  type TenantId,
} from "./studio-store";

// StudioStore over Postgres (docs/design/STUDIO_STORE.md, step 2). Staging
// only: nothing in the app constructs it yet. One interactive transaction per
// apply:
//
//   1. SELECT … FROM tenant_state FOR UPDATE (the row lock serializes applies)
//   2. read the clock after the lock; the entry's `at` is clamped to the
//      previous entry's, while key expiry uses the clock itself
//   3. idempotency lookup in tenant_idempotency (24 h by that clock)
//   4. expectedVersion check
//   5. the reducer, staged as in MemoryStudioStore, with the tenant's language
//      and currency and the store's clock for eligibility checks
//   6. write doc + version, append tenant_action, insert staged effects into
//      tenant_effect, remember the key — then COMMIT
//
// After the commit the tenant's due effects are delivered one row at a time:
// each is claimed with a short lease, sent, and acknowledged on its own. A
// payment is never claimed while an earlier payment of the same tenant is
// still pending, so a refund cannot overtake its checkout. Anything left is
// for the outbox poller (step 2, item 4).

/** Idempotency keys are forgotten this long after their commit (by the store clock). */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** Longest accepted idempotency key (the HTTP layer adds a caller prefix). */
export const IDEMPOTENCY_KEY_MAX = 200;
/** How long a claimed effect is reserved for one deliverer before another may retry it. */
export const EFFECT_LEASE_MS = 60_000;
/** Most effects one apply's drain delivers, its own and any earlier ones it unblocks. */
const DRAIN_LIMIT = 100;
const TRANSACTION = { maxWait: 5_000, timeout: 15_000 } as const;

export type TenantKind = "salon" | "demo" | "sandbox";

/** One committed effect handed to a sink. `id` is stable and unique: use it as the provider's idempotency key. */
export interface EffectDelivery {
  id: string;
  tenantId: TenantId;
  /** Sinks for live providers must refuse anything but `salon` (enforced fully in step 2, item 9). */
  tenantKind: TenantKind;
  seq: number;
  n: number;
  effect: StoreEffect;
}

/** Delivers one effect. Throwing leaves it pending for a retry; it may be called again for the same `id`. */
export type EffectSink = (delivery: EffectDelivery) => void | Promise<void>;

export interface PostgresStudioStoreOptions {
  prisma: PrismaClient;
  /** Server secret for idempotency fingerprints (HMAC-SHA256). At least 32 characters. Never logged or stored. */
  hmacSecret: string;
  /** Epoch milliseconds. Defaults to the database's `clock_timestamp()`, read after the row lock. Tests only. */
  now?: () => Promise<number>;
  sinks: Record<StoreEffect["kind"], EffectSink>;
  /** Use `meta.at` and the action's own times when given instead of the clock. Tests and imports only. */
  trustCallerClock?: boolean;
}

interface Replay {
  state: DemoState;
  version: number;
  entry: TenantAction;
  effects: StoreEffect[];
}

type Committed = { done: ApplyResult } | { commit: Replay };

type Tx = Prisma.TransactionClient;

const isThenable = (value: unknown): boolean =>
  !!value && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";

/** Every `customerId` / `customerIds` value anywhere in a value. */
function namedCustomers(value: unknown, into: Set<string>, depth = 0) {
  if (depth > 12 || !value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) namedCustomers(item, into, depth + 1);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (key === "customerId" && typeof item === "string") into.add(item);
    else if (key === "customerIds" && Array.isArray(item)) item.forEach((id) => { if (typeof id === "string") into.add(id); });
    else namedCustomers(item, into, depth + 1);
  }
}

/**
 * Customer ids an action names or touches; computed at commit for erasure
 * lookups (`subject_ids`). Covers ids named anywhere in the action (nested
 * entries, multi-recipient texts), `customer/*` targets, changed customers, and
 * the customer of every changed record in the state's lists (bookings,
 * journals, inbox, sales…).
 */
export function subjectIds(action: DemoAction, before: DemoState, after: DemoState): string[] {
  const ids = new Set<string>();
  namedCustomers(action, ids);
  const named = action as unknown as Record<string, unknown>;
  if (action.type.startsWith("customer/") && typeof named.id === "string") ids.add(named.id);
  const lists = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of lists) {
    const was = (before as unknown as Record<string, unknown>)[key];
    const now = (after as unknown as Record<string, unknown>)[key];
    if (was === now || !Array.isArray(was) || !Array.isArray(now)) continue;
    // The reducer shares untouched objects, so a changed reference is a changed record.
    const old = new Map<unknown, unknown>(was.map((item) => [(item as { id?: unknown })?.id ?? item, item]));
    const touched: unknown[] = [];
    for (const item of now) {
      const id = (item as { id?: unknown })?.id ?? item;
      if (old.get(id) !== item) touched.push(item);
      old.delete(id);
    }
    touched.push(...old.values());
    for (const item of touched) {
      if (!item || typeof item !== "object") continue;
      if (key === "customers" && typeof (item as { id?: unknown }).id === "string") ids.add((item as { id: string }).id);
      const customerId = (item as { customerId?: unknown }).customerId;
      if (typeof customerId === "string") ids.add(customerId);
    }
  }
  return [...ids].sort();
}

export class PostgresStudioStore implements StudioStore {
  private readonly prisma: PrismaClient;
  private readonly hmacSecret: string;
  private readonly now?: () => Promise<number>;
  private readonly sinks: PostgresStudioStoreOptions["sinks"];
  private readonly trustCallerClock: boolean;
  private readonly listeners = new Map<TenantId, Set<(change: StoreChange) => void>>();

  constructor(options: PostgresStudioStoreOptions) {
    if (typeof options.hmacSecret !== "string" || options.hmacSecret.length < 32) throw new Error("STUDIO_STORE_SECRET_INVALID");
    this.prisma = options.prisma;
    this.hmacSecret = options.hmacSecret;
    this.now = options.now;
    this.sinks = options.sinks;
    this.trustCallerClock = options.trustCallerClock === true;
  }

  private fingerprint(action: DemoAction): string {
    return createHmac("sha256", this.hmacSecret).update(actionFingerprint(action)).digest("hex");
  }

  /** Epoch milliseconds: the injected clock, or the database clock at this point. */
  private async clock(db: Tx | PrismaClient): Promise<number> {
    if (this.now) return Math.floor(await this.now());
    const [row] = await db.$queryRaw<Array<{ ms: number }>>`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms`;
    return Math.floor(row.ms);
  }

  /** True while the tenant exists and has not expired, by the store clock. */
  private async live(tenantId: TenantId, now: number): Promise<{ doc: unknown; version: number } | undefined> {
    const [row] = await this.prisma.$queryRaw<Array<{ doc: unknown; version: number }>>`
      SELECT doc, version FROM tenant_state
      WHERE tenant_id = ${tenantId} AND (expires_at IS NULL OR expires_at > to_timestamp(${now}::float8 / 1000))`;
    return row;
  }

  async load(tenantId: TenantId): Promise<StoreSnapshot | null> {
    const row = await this.live(tenantId, await this.clock(this.prisma));
    if (!row) return null;
    const state = migrateSaved(row.doc);
    return state ? { state, version: row.version } : null;
  }

  async apply(tenantId: TenantId, action: DemoAction, meta: ApplyMeta = {}, options: ApplyOptions = {}): Promise<ApplyResult> {
    const key = options.idempotencyKey;
    if (key !== undefined && (key.length === 0 || key.length > IDEMPOTENCY_KEY_MAX)) return { ok: false, reason: "rejected" };
    const own = detach(action);
    const result = await this.prisma.$transaction((tx) => this.applyInTransaction(tx, tenantId, own, meta, options), TRANSACTION);
    if ("done" in result) return result.done;
    const { commit } = result;
    await this.drain(tenantId);
    notifyAll(this.listeners.get(tenantId) ?? [], { tenantId, version: commit.version, entry: commit.entry, effects: commit.effects });
    return { ok: true, ...detach(commit), replayed: false };
  }

  private async applyInTransaction(tx: Tx, tenantId: TenantId, requested: DemoAction, meta: ApplyMeta, options: ApplyOptions): Promise<Committed> {
    // 1. The row lock. Everything below reads after it, so it sees every earlier commit.
    const [locked] = await tx.$queryRaw<Array<{ doc: unknown; version: number; expires_ms: number | null }>>`
      SELECT doc, version, (extract(epoch FROM expires_at) * 1000)::float8 AS expires_ms
      FROM tenant_state WHERE tenant_id = ${tenantId} FOR UPDATE`;
    if (!locked) return { done: { ok: false, reason: "not-found" } };

    // 2. The clock, after the lock. `at` (the event stamp) never goes before the previous entry.
    const clock = await this.clock(tx);
    if (locked.expires_ms !== null && locked.expires_ms <= clock) return { done: { ok: false, reason: "not-found" } };
    const [last] = await tx.$queryRaw<Array<{ seq: bigint; at_ms: number }>>`
      SELECT seq, (extract(epoch FROM at) * 1000)::float8 AS at_ms FROM tenant_action
      WHERE tenant_id = ${tenantId} ORDER BY seq DESC LIMIT 1`;
    const stamp = this.trustCallerClock && meta.at !== undefined && Number.isFinite(meta.at) ? Math.floor(meta.at) : clock;
    const at = Math.max(stamp, last ? Math.round(last.at_ms) : -Infinity);
    const seq = last ? Number(last.seq) + 1 : 1;

    // 3. Idempotency, judged by the clock, not by the (possibly imported or clamped) event stamp.
    const key = options.idempotencyKey;
    const fingerprint = key === undefined ? "" : this.fingerprint(requested);
    if (key !== undefined) {
      const [known] = await tx.$queryRaw<Array<{ fingerprint_hmac: string; result: Replay }>>`
        SELECT fingerprint_hmac, result FROM tenant_idempotency
        WHERE tenant_id = ${tenantId} AND key = ${key} AND expires_at > to_timestamp(${clock}::float8 / 1000)`;
      if (known) {
        const a = Buffer.from(known.fingerprint_hmac, "hex");
        const b = Buffer.from(fingerprint, "hex");
        if (a.length !== b.length || !timingSafeEqual(a, b)) return { done: { ok: false, reason: "idempotency-mismatch", version: locked.version } };
        return { done: { ok: true, ...known.result, replayed: true } };
      }
    }

    // 4. Optimistic concurrency.
    if (options.expectedVersion !== undefined && options.expectedVersion !== locked.version) {
      return { done: { ok: false, reason: "conflict", version: locked.version } };
    }

    // 5. The reducer. Times that decide eligibility or access come from the store clock.
    const state = migrateSaved(locked.doc);
    if (!state) return { done: { ok: false, reason: "not-found" } };
    // The reducer's `now` (hold expiry, fees, grants) is the clock itself unless the caller's clock is trusted;
    // only the tenant_action stamp is clamped.
    const action = this.trustCallerClock ? requested : withTrustedTimes(requested, clock);
    const now = this.trustCallerClock ? at : clock;
    const defaults = defaultMeta(action, now);
    const logMeta = { actor: meta.actor ?? defaults.actor, source: meta.source ?? defaults.source, at: now };
    const stage = stagedChannels(DEMO_CHANNEL_CURRENCY);
    const next: unknown = withTenantPresentation(state, () =>
      withSlotClock(now, () => withDemoChannels(stage, () => prepareAction(state, action, logMeta, stage))));
    // The staging above is ambient and only holds for a synchronous reducer.
    if (isThenable(next)) throw new Error("STUDIO_STORE_ASYNC_REDUCER");
    const reduced = next as DemoState;
    if (reduced === state || sameContent(reduced, state)) return { done: { ok: false, reason: "rejected", version: locked.version } };

    // Effects: one row per distinct provider request. A request an earlier
    // apply already made is not a new effect; the same key with other content
    // would be refused by the provider, so the change is refused too.
    const staged = new Map<string, { fingerprint: string; record: OutboxEntry }>();
    for (const request of stage.requests()) {
      const id = effectId(tenantId, request);
      const print = requestFingerprint(request);
      const seen = staged.get(id);
      if (seen && seen.fingerprint !== print) return { done: { ok: false, reason: "rejected", version: locked.version } };
      if (!seen) staged.set(id, { fingerprint: print, record: JSON.parse(JSON.stringify(request.record)) as OutboxEntry });
    }
    if (staged.size) {
      const existing = await tx.$queryRaw<Array<{ id: string; fingerprint: string }>>`
        SELECT id, fingerprint FROM tenant_effect WHERE id = ANY(${[...staged.keys()]}::text[])`;
      for (const row of existing) {
        if (row.fingerprint !== staged.get(row.id)!.fingerprint) return { done: { ok: false, reason: "rejected", version: locked.version } };
        staged.delete(row.id);
      }
    }

    // 6. Commit: state, log entry, effects and the key in one transaction.
    const version = locked.version + 1;
    const [written] = await tx.$queryRaw<Array<{ doc: DemoState }>>`
      UPDATE tenant_state SET doc = ${JSON.stringify(reduced)}::jsonb, version = ${version}, updated_at = to_timestamp(${clock}::float8 / 1000)
      WHERE tenant_id = ${tenantId} RETURNING doc`;
    const entry: TenantAction = {
      seq,
      tenantId,
      action,
      actor: logMeta.actor,
      source: logMeta.source,
      at,
      ...(key === undefined ? {} : { idempotencyKey: key }),
      resultingVersion: version,
    };
    await tx.$executeRaw`
      INSERT INTO tenant_action (tenant_id, seq, action, actor, source, at, idempotency_key, resulting_version, subject_ids)
      VALUES (${tenantId}, ${seq}::bigint, ${JSON.stringify(action)}::jsonb, ${entry.actor}, ${entry.source},
              to_timestamp(${at}::float8 / 1000), ${key ?? null}, ${version}, ${subjectIds(action, state, reduced)}::text[])`;
    const effects: StoreEffect[] = [];
    for (const [id, { fingerprint: print, record }] of staged) {
      const effect = effectOf(record);
      await tx.$executeRaw`
        INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, next_attempt_at)
        VALUES (${tenantId}, ${seq}::bigint, ${effects.length}, ${id}, ${print}, ${effect.kind}, ${JSON.stringify(record)}::jsonb,
                to_timestamp(${clock}::float8 / 1000))`;
      effects.push(effect);
    }
    const commit: Replay = { state: written.doc, version, entry, effects };
    if (key !== undefined) {
      await tx.$executeRaw`
        INSERT INTO tenant_idempotency (tenant_id, key, fingerprint_hmac, seq, result, expires_at)
        VALUES (${tenantId}, ${key}, ${fingerprint}, ${seq}::bigint, ${JSON.stringify(commit)}::jsonb, to_timestamp(${clock + IDEMPOTENCY_TTL_MS}::float8 / 1000))
        ON CONFLICT (tenant_id, key) DO UPDATE
        SET fingerprint_hmac = EXCLUDED.fingerprint_hmac, seq = EXCLUDED.seq, result = EXCLUDED.result, expires_at = EXCLUDED.expires_at`;
    }
    return { commit };
  }

  /**
   * Delivers the tenant's due effects in commit order, this apply's included.
   * Each row is claimed with a lease, sent and acknowledged in its own
   * statement, so a slow or failing later send never undoes an earlier one and
   * no connection is held while a sink runs.
   */
  private async drain(tenantId: TenantId) {
    try {
      // Rows committed meanwhile (a refund another apply queued behind this
      // apply's checkout) are picked up by another pass once this one made progress.
      let budget = DRAIN_LIMIT;
      for (let pass = 0; pass < 5 && budget > 0; pass++) {
        const delivered = await this.drainPass(tenantId, budget);
        if (delivered === 0) break;
        budget -= delivered;
      }
    } catch {
      // The change is committed and its effects are in the outbox; the poller delivers what is left.
    }
  }

  /** One pass over the tenant's due effects in commit order; returns how many were delivered. */
  private async drainPass(tenantId: TenantId, limit: number): Promise<number> {
    const now = await this.clock(this.prisma);
    const due = await this.prisma.$queryRaw<Array<{ id: string; seq: bigint; n: number; kind: StoreEffect["kind"]; payload: OutboxEntry; tenant_kind: TenantKind | null }>>`
      SELECT e.id, e.seq, e.n, e.kind, e.payload, s.kind::text AS tenant_kind
      FROM tenant_effect e LEFT JOIN tenant_state s ON s.tenant_id = e.tenant_id
      WHERE e.tenant_id = ${tenantId} AND e.status = 'pending' AND e.next_attempt_at <= to_timestamp(${now}::float8 / 1000)
      ORDER BY e.seq, e.n LIMIT ${limit}`;
    let delivered = 0;
    let paymentsBlocked = false;
    for (const row of due) {
      if (row.kind === "payment" && paymentsBlocked) continue;
      const claimed = await this.claim(row.id);
      if (!claimed) {
        if (row.kind === "payment") paymentsBlocked = true;
        continue;
      }
      const delivery: EffectDelivery = {
        id: row.id, tenantId, tenantKind: row.tenant_kind ?? "salon", seq: Number(row.seq), n: row.n, effect: effectOf(row.payload),
      };
      if (await this.send(delivery, claimed.attempts)) delivered++;
      else if (row.kind === "payment") paymentsBlocked = true;
    }
    return delivered;
  }

  /** Reserves one pending, due effect. A payment waits while an earlier payment of its tenant is pending. */
  private async claim(id: string): Promise<{ attempts: number } | undefined> {
    const now = await this.clock(this.prisma);
    const [row] = await this.prisma.$queryRaw<Array<{ attempts: number }>>`
      UPDATE tenant_effect e SET attempts = e.attempts + 1, next_attempt_at = to_timestamp(${now + EFFECT_LEASE_MS}::float8 / 1000)
      WHERE e.id = ${id} AND e.status = 'pending' AND e.next_attempt_at <= to_timestamp(${now}::float8 / 1000)
        AND (e.kind <> 'payment' OR NOT EXISTS (
          SELECT 1 FROM tenant_effect p
          WHERE p.tenant_id = e.tenant_id AND p.kind = 'payment' AND p.status = 'pending' AND (p.seq, p.n) < (e.seq, e.n)))
      RETURNING e.attempts`;
    return row;
  }

  /** Calls the sink and records the outcome for this one row. */
  private async send(delivery: EffectDelivery, attempts: number): Promise<boolean> {
    try {
      await this.sinks[delivery.effect.kind](detach(delivery));
    } catch {
      // Never log the payload: it holds personal data. The poller retries after the backoff.
      const retry = (await this.clock(this.prisma)) + Math.min(3_600_000, 1000 * 2 ** attempts);
      await this.prisma.$executeRaw`
        UPDATE tenant_effect SET next_attempt_at = to_timestamp(${retry}::float8 / 1000) WHERE id = ${delivery.id} AND status = 'pending'`;
      return false;
    }
    const at = await this.clock(this.prisma);
    await this.prisma.$executeRaw`
      UPDATE tenant_effect SET status = 'delivered', delivered_at = to_timestamp(${at}::float8 / 1000) WHERE id = ${delivery.id} AND status = 'pending'`;
    return true;
  }

  subscribe(tenantId: TenantId, listener: (change: StoreChange) => void): () => void {
    // In-process only for now; LISTEN/NOTIFY across instances is step 2, item 6.
    const listeners = this.listeners.get(tenantId) ?? new Set();
    this.listeners.set(tenantId, listeners);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  async history(tenantId: TenantId, query: HistoryQuery): Promise<HistoryPage> {
    // An unknown, deleted or expired tenant has no readable history, by the same clock as `load`.
    if (!(await this.live(tenantId, await this.clock(this.prisma)))) return { entries: [], next: null };
    const limit = Math.max(1, Math.min(HISTORY_MAX_LIMIT, Math.floor(query.limit) || 1));
    const after = Math.max(0, Math.floor(query.after ?? 0));
    const rows = await this.prisma.$queryRaw<Array<{
      seq: bigint; action: DemoAction; actor: string; source: string; at_ms: number; idempotency_key: string | null; resulting_version: number;
    }>>`
      SELECT a.seq, a.action, a.actor, a.source, (extract(epoch FROM a.at) * 1000)::float8 AS at_ms, a.idempotency_key, a.resulting_version
      FROM tenant_action a
      WHERE a.tenant_id = ${tenantId} AND a.seq > ${after}::bigint
      ORDER BY a.seq LIMIT ${limit + 1}`;
    const entries = rows.slice(0, limit).map((row): TenantAction => ({
      seq: Number(row.seq),
      tenantId,
      action: row.action,
      actor: row.actor as LogActor,
      source: row.source as LogSource,
      at: Math.round(row.at_ms),
      ...(row.idempotency_key === null ? {} : { idempotencyKey: row.idempotency_key }),
      resultingVersion: row.resulting_version,
    }));
    return { entries, next: rows.length > limit ? entries.at(-1)!.seq : null };
  }
}
