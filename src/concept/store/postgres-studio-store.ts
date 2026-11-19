import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { DemoAction } from "../actions";
import { DEMO_CHANNEL_CURRENCY, withDemoChannels } from "../connections/demo";
import { channelLedger } from "../connections/simulated/adapters";
import { createOutbox, type OutboxEntry } from "../connections/simulated/outbox";
import { withSlotClock } from "../data/slots";
import type { DemoState } from "../data/types";
import { defaultMeta, prepareAction } from "../log/capture";
import type { LogActor, LogSource } from "../log/types";
import {
  actionFingerprint,
  detach,
  effectOf,
  HISTORY_MAX_LIMIT,
  migrateSaved,
  notifyAll,
  sameContent,
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
//   2. read the clock after the lock and clamp it to the previous entry's `at`
//   3. idempotency lookup in tenant_idempotency (24 h, judged by that clock)
//   4. expectedVersion check
//   5. the reducer, staged exactly as in MemoryStudioStore
//   6. write doc + version, append tenant_action, insert staged effects into
//      tenant_effect, remember the key — then COMMIT
//
// After the commit this apply's own effects are delivered to the injected
// sinks and marked delivered. Anything left pending (a sink failed, the
// process died) is for the outbox poller (step 2, item 4).

/** Idempotency keys are forgotten this long after their commit. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** Longest accepted idempotency key (the HTTP layer adds a caller prefix). */
export const IDEMPOTENCY_KEY_MAX = 200;
const TRANSACTION = { maxWait: 5_000, timeout: 15_000 } as const;
const DRAIN_TRANSACTION = { maxWait: 5_000, timeout: 30_000 } as const;

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
  /** Use `meta.at` when given instead of the clock. Tests and imports only. */
  trustCallerClock?: boolean;
}

interface Replay {
  state: DemoState;
  version: number;
  entry: TenantAction;
  effects: StoreEffect[];
}

type Committed =
  | { done: ApplyResult }
  | { commit: Replay; kind: TenantKind; deliveries: EffectDelivery[] };

type Tx = Prisma.TransactionClient;

const isThenable = (value: unknown): boolean =>
  !!value && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";

/** Customer ids an action names or touches; computed at commit for erasure lookups (`subject_ids`). */
export function subjectIds(action: DemoAction, before: DemoState, after: DemoState): string[] {
  const ids = new Set<string>();
  const named = action as unknown as Record<string, unknown>;
  if (typeof named.customerId === "string") ids.add(named.customerId);
  if (Array.isArray(named.customerIds)) for (const id of named.customerIds) if (typeof id === "string") ids.add(id);
  if (action.type.startsWith("customer/") && typeof named.id === "string") ids.add(named.id);
  // The reducer shares untouched objects, so a changed reference is a changed record.
  const changed = <T extends { id: string }>(was: readonly T[], now: readonly T[], each: (item: T) => void) => {
    const old = new Map(was.map((item) => [item.id, item]));
    for (const item of now) {
      if (old.get(item.id) !== item) each(item);
      old.delete(item.id);
    }
    old.forEach(each);
  };
  changed(before.customers, after.customers, (customer) => ids.add(customer.id));
  changed(before.bookings, after.bookings, (booking) => { if (booking.customerId) ids.add(booking.customerId); });
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

  /** Epoch milliseconds: the injected clock, or the database clock at this point in the transaction. */
  private async clock(db: Tx | PrismaClient): Promise<number> {
    if (this.now) return Math.floor(await this.now());
    const [row] = await db.$queryRaw<Array<{ ms: number }>>`SELECT (extract(epoch FROM clock_timestamp()) * 1000)::float8 AS ms`;
    return Math.floor(row.ms);
  }

  async load(tenantId: TenantId): Promise<StoreSnapshot | null> {
    const now = await this.clock(this.prisma);
    const [row] = await this.prisma.$queryRaw<Array<{ doc: unknown; version: number }>>`
      SELECT doc, version FROM tenant_state
      WHERE tenant_id = ${tenantId} AND (expires_at IS NULL OR expires_at > to_timestamp(${now}::float8 / 1000))`;
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
    const { commit, kind, deliveries } = result;
    await this.deliver(kind, deliveries);
    notifyAll(this.listeners.get(tenantId) ?? [], { tenantId, version: commit.version, entry: commit.entry, effects: commit.effects });
    return { ok: true, ...detach(commit), replayed: false };
  }

  private async applyInTransaction(tx: Tx, tenantId: TenantId, action: DemoAction, meta: ApplyMeta, options: ApplyOptions): Promise<Committed> {
    // 1. The row lock. Everything below reads after it, so it sees every earlier commit.
    const [locked] = await tx.$queryRaw<Array<{ doc: unknown; version: number; kind: TenantKind; expires_ms: number | null }>>`
      SELECT doc, version, kind::text AS kind, (extract(epoch FROM expires_at) * 1000)::float8 AS expires_ms
      FROM tenant_state WHERE tenant_id = ${tenantId} FOR UPDATE`;
    if (!locked) return { done: { ok: false, reason: "not-found" } };

    // 2. The clock, after the lock, never before the previous entry.
    const clock = await this.clock(tx);
    if (locked.expires_ms !== null && locked.expires_ms <= clock) return { done: { ok: false, reason: "not-found" } };
    const [last] = await tx.$queryRaw<Array<{ seq: bigint; at_ms: number }>>`
      SELECT seq, (extract(epoch FROM at) * 1000)::float8 AS at_ms FROM tenant_action
      WHERE tenant_id = ${tenantId} ORDER BY seq DESC LIMIT 1`;
    const requested = this.trustCallerClock && meta.at !== undefined && Number.isFinite(meta.at) ? Math.floor(meta.at) : clock;
    const at = Math.max(requested, last ? Math.round(last.at_ms) : -Infinity);
    const seq = last ? Number(last.seq) + 1 : 1;

    // 3. Idempotency: a live key replays or mismatches; an expired one is forgotten.
    const key = options.idempotencyKey;
    const fingerprint = key === undefined ? "" : this.fingerprint(action);
    if (key !== undefined) {
      const [known] = await tx.$queryRaw<Array<{ fingerprint_hmac: string; result: Replay }>>`
        SELECT fingerprint_hmac, result FROM tenant_idempotency
        WHERE tenant_id = ${tenantId} AND key = ${key} AND expires_at > to_timestamp(${at}::float8 / 1000)`;
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

    // 5. The reducer, staged as in MemoryStudioStore. A fresh ledger per apply: sends are recorded, not sent.
    const state = migrateSaved(locked.doc);
    if (!state) return { done: { ok: false, reason: "not-found" } };
    const defaults = defaultMeta(action, at);
    const logMeta = { actor: meta.actor ?? defaults.actor, source: meta.source ?? defaults.source, at };
    const stage = channelLedger(createOutbox(Infinity), DEMO_CHANNEL_CURRENCY).stage();
    const next: unknown = withSlotClock(at, () => withDemoChannels(stage, () => prepareAction(state, action, logMeta, stage)));
    // The staging above is ambient and only holds for a synchronous reducer.
    if (isThenable(next)) throw new Error("STUDIO_STORE_ASYNC_REDUCER");
    const reduced = next as DemoState;
    if (reduced === state || sameContent(reduced, state)) return { done: { ok: false, reason: "rejected", version: locked.version } };

    // 6. Commit: state, log entry, effects and the key in one transaction.
    const version = locked.version + 1;
    const [written] = await tx.$queryRaw<Array<{ doc: DemoState }>>`
      UPDATE tenant_state SET doc = ${JSON.stringify(reduced)}::jsonb, version = ${version}, updated_at = to_timestamp(${at}::float8 / 1000)
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

    const deliveries: EffectDelivery[] = [];
    for (const staged of stage.outbox.list()) {
      const record = JSON.parse(JSON.stringify(staged)) as OutboxEntry;
      const effect = effectOf(record);
      const id = `eff_${createHash("sha256").update(`${tenantId}\n${record.id}`).digest("hex")}`;
      const n = deliveries.length;
      // A record already published by an earlier apply is not a new effect (the outbox is idempotent by id).
      const inserted = await tx.$executeRaw`
        INSERT INTO tenant_effect (tenant_id, seq, n, id, kind, payload, next_attempt_at)
        VALUES (${tenantId}, ${seq}::bigint, ${n}, ${id}, ${effect.kind}, ${JSON.stringify(record)}::jsonb, to_timestamp(${at}::float8 / 1000))
        ON CONFLICT (id) DO NOTHING`;
      if (inserted === 1) deliveries.push({ id, tenantId, tenantKind: locked.kind, seq, n, effect });
    }
    const commit: Replay = { state: written.doc, version, entry, effects: deliveries.map((d) => d.effect) };
    if (key !== undefined) {
      await tx.$executeRaw`
        INSERT INTO tenant_idempotency (tenant_id, key, fingerprint_hmac, seq, result, expires_at)
        VALUES (${tenantId}, ${key}, ${fingerprint}, ${seq}::bigint, ${JSON.stringify(commit)}::jsonb, to_timestamp(${at + IDEMPOTENCY_TTL_MS}::float8 / 1000))
        ON CONFLICT (tenant_id, key) DO UPDATE
        SET fingerprint_hmac = EXCLUDED.fingerprint_hmac, seq = EXCLUDED.seq, result = EXCLUDED.result, expires_at = EXCLUDED.expires_at`;
    }
    return { commit, kind: locked.kind, deliveries };
  }

  /**
   * Delivers this apply's effects after the commit. Each row is claimed with
   * SKIP LOCKED, so the outbox poller (item 4) never delivers it at the same
   * time; a sink error leaves the row pending with a backoff.
   */
  private async deliver(kind: TenantKind, deliveries: EffectDelivery[]) {
    if (deliveries.length === 0) return;
    try {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.$queryRaw<Array<{ id: string; attempts: number }>>`
          SELECT id, attempts FROM tenant_effect
          WHERE id = ANY(${deliveries.map((d) => d.id)}::text[]) AND status = 'pending'
          ORDER BY seq, n FOR UPDATE SKIP LOCKED`;
        const attempts = new Map(claimed.map((row) => [row.id, row.attempts]));
        for (const delivery of deliveries) {
          if (!attempts.has(delivery.id)) continue;
          try {
            await this.sinks[delivery.effect.kind](detach({ ...delivery, tenantKind: kind }));
            const at = await this.clock(tx);
            await tx.$executeRaw`
              UPDATE tenant_effect SET status = 'delivered', attempts = attempts + 1, delivered_at = to_timestamp(${at}::float8 / 1000)
              WHERE id = ${delivery.id}`;
          } catch {
            // Never log the payload: it holds personal data. The poller retries.
            const tries = (attempts.get(delivery.id) ?? 0) + 1;
            const at = (await this.clock(tx)) + Math.min(3_600_000, 1000 * 2 ** tries);
            await tx.$executeRaw`
              UPDATE tenant_effect SET attempts = attempts + 1, next_attempt_at = to_timestamp(${at}::float8 / 1000)
              WHERE id = ${delivery.id}`;
          }
        }
      }, DRAIN_TRANSACTION);
    } catch {
      // The change is committed and its effects are in the outbox; the poller delivers what is left.
    }
  }

  subscribe(tenantId: TenantId, listener: (change: StoreChange) => void): () => void {
    // In-process only for now; LISTEN/NOTIFY across instances is step 2, item 6.
    const listeners = this.listeners.get(tenantId) ?? new Set();
    this.listeners.set(tenantId, listeners);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  async history(tenantId: TenantId, query: HistoryQuery): Promise<HistoryPage> {
    const limit = Math.max(1, Math.min(HISTORY_MAX_LIMIT, Math.floor(query.limit) || 1));
    const after = Math.max(0, Math.floor(query.after ?? 0));
    const rows = await this.prisma.$queryRaw<Array<{
      seq: bigint; action: DemoAction; actor: string; source: string; at_ms: number; idempotency_key: string | null; resulting_version: number;
    }>>`
      SELECT seq, action, actor, source, (extract(epoch FROM at) * 1000)::float8 AS at_ms, idempotency_key, resulting_version
      FROM tenant_action WHERE tenant_id = ${tenantId} AND seq > ${after}::bigint
      ORDER BY seq LIMIT ${limit + 1}`;
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
