import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { DemoAction } from "../actions";
import { DEMO_CHANNEL_CURRENCY, withDemoChannels } from "../connections/demo";
import type { OutboxEntry } from "../connections/simulated/outbox";
import { createDemoState } from "../data/generate";
import { withSlotClock } from "../data/slots";
import type { Customer, DateKey, DemoState } from "../data/types";
import { customerIdentifiers, findErasable, mentionsCustomer, phoneDigits, scrubDeep, scrubText } from "../customers/erase";
import { withTenantPresentation } from "../i18n/presentation";
import { defaultMeta, prepareAction } from "../log/capture";
import { salonClock } from "../tools/clock";
import {
  databaseClock,
  deliverDue,
  EFFECT_LEASE_MS,
  EFFECT_MAX_ATTEMPTS,
  SIMULATED_SINKS,
  type EffectSinks,
  type TenantKind,
} from "./effect-outbox";
import {
  addressedTo,
  customerIdPatterns,
  customerRecipient,
  jsonTextPatterns,
  plainTextPatterns,
  redactAction,
  redactEffectPayload,
} from "./erasure";
import { effectId, requestFingerprint, stagedChannels } from "./staged-channels";
import { IDEMPOTENCY_KEY_MAX, IDEMPOTENCY_TTL_MS } from "./idempotency";
import { notifyTenantChange, PostgresNotifications } from "./postgres-notifications";
import { DOCUMENT_SIZE_REFUSAL, MAX_DOCUMENT_BYTES, StoreMetrics } from "./store-metrics";
import {
  actionFingerprint,
  detach,
  effectOf,
  isErasure,
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
  type SystemAction,
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
// After the commit the tenant's due effects are delivered one row at a time
// by the same code and claim rule as the outbox poller (effect-outbox.ts):
// each is claimed with a short lease, sent, and acknowledged on its own. A
// payment is never claimed while an earlier payment of the same tenant is
// still pending, so a refund cannot overtake its checkout. Anything left is
// for the poller (`drainPendingEffects`).
//
// The row lock waits at most `lockTimeoutMs` (2 s); a lock timeout is
// `conflict`, so the caller retries instead of piling up connections.

export { IDEMPOTENCY_KEY_MAX, IDEMPOTENCY_TTL_MS };
export const DEMO_TENANT_ID = "demo";
const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000;
/** Default wait for the tenant's row lock before an apply gives up with `conflict`. */
export const LOCK_TIMEOUT_MS = 2_000;
/** Most effects one apply's drain delivers, its own and any earlier ones it unblocks. */
const DRAIN_LIMIT = 100;
const TRANSACTION = { maxWait: 5_000, timeout: 15_000 } as const;

export { EFFECT_LEASE_MS, EFFECT_MAX_ATTEMPTS, type TenantKind };
export type { EffectDelivery, EffectSink, EffectSinks } from "./effect-outbox";

/** What `eraseSubject` changed. */
export type EraseResult =
  | {
      ok: true;
      /** The tenant's version afterwards; one higher when the document still held the customer. */
      version: number;
      /** The `customer/erase` log entry, when the document changed. */
      entry?: TenantAction;
    } & EraseCounts
  | { ok: false; reason: "not-found" | "conflict" };

interface EraseCounts {
  /** `tenant_action` rows redacted, `tenant_effect` rows redacted or cancelled, idempotency keys deleted. */
  redacted: { actions: number; effects: number; idempotencyKeys: number };
  /** Payments still pending for the customer: they keep their payload until delivered (see STUDIO_STORE.md). */
  pendingPayments: number;
  /** Messages to the customer a deliverer was sending during the erasure: stopped for retries, outcome recorded by the deliverer. */
  inFlightMessages: number;
}

export interface PostgresStudioStoreOptions {
  prisma: PrismaClient;
  /** Server secret for idempotency fingerprints (HMAC-SHA256). At least 32 characters. Never logged or stored. */
  hmacSecret: string;
  /** Epoch milliseconds. Defaults to the database's `clock_timestamp()`, read after the row lock. Tests only. */
  now?: () => Promise<number>;
  /** Live sinks, used for `salon` tenants only. */
  sinks: EffectSinks;
  /** Sinks for `demo` and `sandbox` tenants, which never reach `sinks`. Defaults to acknowledging without sending. */
  simulatedSinks?: EffectSinks;
  /** Use `meta.at` and the action's own times when given instead of the clock. Tests and imports only. */
  trustCallerClock?: boolean;
  /** Deliver the tenant's due effects right after each commit (default). With false only the poller delivers. */
  deliverAfterCommit?: boolean;
  /** Longest wait for the tenant's row lock, in milliseconds (default 2 s). A timeout is `conflict`. */
  lockTimeoutMs?: number;
  /** How `eraseSubject` redacts the tables: its own statements (default, staging) or the SECURITY DEFINER `erase_subject` (production grants). */
  erasure?: "statements" | "function";
  /** Delivery lease and attempts before `failed`, as for the poller. */
  leaseMs?: number;
  maxAttempts?: number;
  /** Direct connection to Prisma's database for LISTEN. Defaults to DATABASE_URL. */
  listenerConnectionString?: string;
}

interface LockedRow {
  doc: unknown;
  version: number;
  kind: TenantKind;
  expires_ms: number | null;
}

interface Replay {
  state: DemoState;
  version: number;
  entry: TenantAction;
  effects: StoreEffect[];
}

type DocumentCommit = Replay & { documentBytes: number };
type ApplyOutcome = { done: ApplyResult; commit?: never } | { commit: DocumentCommit };

type ReplacementResult =
  | { ok: true; version: number; changed: boolean }
  | Extract<ApplyResult, { ok: false }>;

type Tx = Prisma.TransactionClient;

const isThenable = (value: unknown): boolean =>
  !!value && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";

/** True for Postgres' lock_not_available (55P03), however the driver wraps it. */
function isLockTimeout(error: unknown): boolean {
  const seen = new Set<unknown>();
  const walk = (value: unknown, depth: number): boolean => {
    if (!value || typeof value !== "object" || seen.has(value) || depth > 6) return false;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (record.code === "55P03" || record.originalCode === "55P03") return true;
    if (typeof record.message === "string" && /lock timeout/i.test(record.message)) return true;
    return walk(record.cause, depth + 1) || walk(record.meta, depth + 1) || walk(record.kind, depth + 1);
  };
  return walk(error, 0);
}

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
  private readonly sinks: EffectSinks;
  private readonly simulatedSinks: EffectSinks;
  private readonly trustCallerClock: boolean;
  private readonly deliverAfterCommit: boolean;
  private readonly lockTimeoutMs: number;
  private readonly leaseMs: number;
  private readonly maxAttempts: number;
  private readonly erasure: "statements" | "function";
  private readonly listeners = new Map<TenantId, Set<(change: StoreChange) => void>>();
  private readonly notifications?: PostgresNotifications;
  private readonly metrics = new StoreMetrics();

  constructor(options: PostgresStudioStoreOptions) {
    if (typeof options.hmacSecret !== "string" || options.hmacSecret.length < 32) throw new Error("STUDIO_STORE_SECRET_INVALID");
    this.prisma = options.prisma;
    this.hmacSecret = options.hmacSecret;
    this.now = options.now;
    this.sinks = options.sinks;
    this.simulatedSinks = options.simulatedSinks ?? SIMULATED_SINKS;
    this.trustCallerClock = options.trustCallerClock === true;
    this.deliverAfterCommit = options.deliverAfterCommit !== false;
    const whole = (value: number | undefined, fallback: number) =>
      value !== undefined && Number.isInteger(value) && value >= 1 ? value : fallback;
    this.lockTimeoutMs = whole(options.lockTimeoutMs, LOCK_TIMEOUT_MS);
    this.leaseMs = whole(options.leaseMs, EFFECT_LEASE_MS);
    this.maxAttempts = whole(options.maxAttempts, EFFECT_MAX_ATTEMPTS);
    this.erasure = options.erasure === "function" ? "function" : "statements";
    const listenerConnectionString = options.listenerConnectionString ?? process.env.DATABASE_URL;
    if (listenerConnectionString) {
      this.notifications = new PostgresNotifications(listenerConnectionString, (change) =>
        notifyAll(this.listeners.get(change.tenantId) ?? [], change));
    }
  }

  private fingerprint(action: DemoAction): string {
    return createHmac("sha256", this.hmacSecret).update(actionFingerprint(action)).digest("hex");
  }

  /** Epoch milliseconds: the injected clock, or the database clock at this point. */
  private async clock(db: Tx | PrismaClient): Promise<number> {
    if (this.now) return Math.floor(await this.now());
    return databaseClock(db);
  }

  /**
   * Takes the tenant's row lock, waiting at most `lockTimeoutMs`. Undefined
   * for an unknown tenant. Everything after it sees every earlier commit.
   */
  private async lock(tx: Tx, tenantId: TenantId): Promise<LockedRow | undefined> {
    await tx.$queryRaw`SELECT set_config('lock_timeout', ${`${this.lockTimeoutMs}ms`}, true)`;
    const [locked] = await tx.$queryRaw<LockedRow[]>`
      SELECT doc, version, kind::text AS kind, (extract(epoch FROM expires_at) * 1000)::float8 AS expires_ms
      FROM tenant_state WHERE tenant_id = ${tenantId} FOR UPDATE`;
    return locked;
  }

  /** Runs one transaction; a lock timeout becomes `conflict`. */
  private async transaction<T extends { commit?: DocumentCommit }>(
    tenantId: TenantId,
    run: (tx: Tx) => Promise<T>,
  ): Promise<T | { lockTimeout: true }> {
    let finishEcho: ((committed: boolean) => void) | undefined;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const result = await run(tx);
        if (result.commit) {
          const { version } = result.commit;
          const pid = await notifyTenantChange(tx, tenantId, version);
          finishEcho = this.notifications?.ignoreEcho(pid, tenantId, version);
        }
        return result;
      }, TRANSACTION);
      finishEcho?.(true);
      return result;
    } catch (error) {
      finishEcho?.(false);
      if (isLockTimeout(error)) return { lockTimeout: true };
      throw error;
    }
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
    return this.applyToTenant(tenantId, action, meta, options, false);
  }

  /** A server-side handle for a sandbox token. The first committed apply creates the tenant. */
  openSandboxTenant(token: string) {
    if (typeof token !== "string" || !token.trim() || token.length > 1024) throw new RangeError("Invalid sandbox token");
    const tenantId = `sbx_${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
    return {
      tenantId,
      apply: (action: DemoAction, meta: ApplyMeta = {}, options: ApplyOptions = {}) =>
        this.applyToTenant(tenantId, action, meta, options, true),
    };
  }

  private async applyToTenant(tenantId: TenantId, action: DemoAction, meta: ApplyMeta, options: ApplyOptions, sandbox: boolean): Promise<ApplyResult> {
    const start = performance.now();
    const key = options.idempotencyKey;
    if (key !== undefined && (key.length === 0 || key.length > IDEMPOTENCY_KEY_MAX)) return { ok: false, reason: "rejected" };
    // Erasure also redacts the log and the outbox: only `eraseSubject` runs it.
    if (isErasure(action)) return { ok: false, reason: "rejected" };
    const own = detach(action);
    const result = await this.transaction(tenantId, async (tx): Promise<ApplyOutcome> => {
      // 1. The row lock.
      let locked = await this.lock(tx, tenantId);
      let created = false;
      if (!locked && sandbox) {
        const now = await databaseClock(tx);
        const fixture = createDemoState(salonClock(new Date(now)).today);
        created = (await tx.$executeRaw`
          INSERT INTO tenant_state (tenant_id, kind, doc, expires_at)
          VALUES (${tenantId}, 'sandbox', ${JSON.stringify(fixture)}::jsonb, to_timestamp(${now + SANDBOX_TTL_MS}::float8 / 1000))
          ON CONFLICT (tenant_id) DO NOTHING`) === 1;
        locked = await this.lock(tx, tenantId);
      }
      if (!locked || (sandbox && locked.kind !== "sandbox")) return { done: { ok: false, reason: "not-found" } };
      const outcome = await this.applyLocked(tx, tenantId, locked, own, meta, options);
      if (created && "done" in outcome) await tx.$executeRaw`DELETE FROM tenant_state WHERE tenant_id = ${tenantId}`;
      return outcome;
    });
    if ("lockTimeout" in result) return { ok: false, reason: "conflict" };
    if ("done" in result) {
      if (!result.done.ok && result.done.detail === DOCUMENT_SIZE_REFUSAL) this.metrics.refusedSize();
      return result.done;
    }
    return this.published(tenantId, result.commit, start);
  }

  /** After a commit: deliver due effects, notify subscribers, return a detached result. */
  private async published(tenantId: TenantId, { documentBytes, ...commit }: DocumentCommit, start: number): Promise<ApplyResult & { ok: true }> {
    this.metrics.record({ documentBytes, bookings: commit.state.bookings.length, applyDurationMs: performance.now() - start });
    if (this.deliverAfterCommit) await this.drain(tenantId);
    notifyAll(this.listeners.get(tenantId) ?? [], { tenantId, version: commit.version, entry: commit.entry, effects: commit.effects });
    return { ok: true, ...detach(commit), replayed: false };
  }

  store_metrics() {
    return this.metrics.snapshot();
  }

  /** Privileged maintenance entry point. Callers must authorize the operator before invoking it. */
  replaceState(tenantId: TenantId, state: DemoState, { actor, reason }: { actor: "system"; reason: string }): Promise<ReplacementResult> {
    if (actor !== "system" || typeof reason !== "string" || !reason.trim()) {
      throw new RangeError("State replacement requires a system actor and a reason");
    }
    const replacement = detach(state);
    return this.replace(tenantId, { type: "system/replace", payload: { reason } }, replacement);
  }

  /** Regenerates the shared demo once for the requested salon-local date. */
  resetDemoTenant({ generatedFor }: { generatedFor: DateKey }): Promise<ReplacementResult> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(generatedFor) ||
        new Date(`${generatedFor}T00:00:00Z`).toJSON()?.slice(0, 10) !== generatedFor) {
      throw new RangeError("Invalid demo fixture date");
    }
    return this.replace(DEMO_TENANT_ID, { type: "system/reset", payload: { generatedFor } });
  }

  private async replace(tenantId: TenantId, action: SystemAction, replacement?: DemoState): Promise<ReplacementResult> {
    const start = performance.now();
    const result = await this.transaction(tenantId, async (tx): Promise<{ replaced: ReplacementResult; commit?: DocumentCommit }> => {
      const locked = await this.lock(tx, tenantId);
      const clock = await this.clock(tx);
      if (!locked || (locked.expires_ms !== null && locked.expires_ms <= clock) ||
          (action.type === "system/reset" && locked.kind !== "demo")) {
        return { replaced: { ok: false, reason: "not-found" } };
      }
      const before = migrateSaved(locked.doc);
      if (action.type === "system/reset" && before?.generatedFor === action.payload.generatedFor) {
        return { replaced: { ok: true, version: locked.version, changed: false } };
      }
      const fixture = action.type === "system/reset" ? createDemoState(action.payload.generatedFor) : migrateSaved(replacement);
      if (!fixture) return { replaced: { ok: false, reason: "rejected", version: locked.version } };
      const document = JSON.stringify({ ...fixture, seq: Math.max(fixture.seq, before?.seq ?? 0) });
      const documentBytes = Buffer.byteLength(document);
      if (documentBytes > MAX_DOCUMENT_BYTES) {
        return { replaced: { ok: false, reason: "rejected", version: locked.version, detail: DOCUMENT_SIZE_REFUSAL } };
      }
      const version = locked.version + 1;
      const { seq, at } = await this.auditPosition(tx, tenantId, locked.version, clock);
      const entry: TenantAction = { tenantId, seq, at, actor: "system", source: "system", action, resultingVersion: version };
      const state = await this.writeDocumentAndAction(tx, document, entry, clock, []);
      return { replaced: { ok: true, version, changed: true }, commit: { state, version, entry, effects: [], documentBytes } };
    });
    if ("lockTimeout" in result) return { ok: false, reason: "conflict" };
    if (result.commit) await this.published(tenantId, result.commit, start);
    if (!result.replaced.ok && result.replaced.detail === DOCUMENT_SIZE_REFUSAL) this.metrics.refusedSize();
    return result.replaced;
  }

  private async auditPosition(tx: Tx, tenantId: TenantId, currentVersion: number, stamp: number) {
    const [last] = await tx.$queryRaw<Array<{ seq: bigint; at_ms: number }>>`
      SELECT seq, (extract(epoch FROM at) * 1000)::float8 AS at_ms FROM tenant_action
      WHERE tenant_id = ${tenantId} ORDER BY seq DESC LIMIT 1`;
    // Version is the durable high-water mark even after demo retention removes the last row.
    return {
      seq: Math.max(currentVersion, last ? Number(last.seq) : 0) + 1,
      at: last ? Math.max(stamp, Math.round(last.at_ms)) : stamp,
    };
  }

  private async writeDocumentAndAction(tx: Tx, document: string, entry: TenantAction, clock: number, subjects: string[]) {
    const { tenantId, resultingVersion, seq, action, actor, source, at, idempotencyKey } = entry;
    const [written] = await tx.$queryRaw<Array<{ doc: DemoState }>>`
      UPDATE tenant_state SET doc = ${document}::jsonb, version = ${resultingVersion}, updated_at = to_timestamp(${clock}::float8 / 1000)
      WHERE tenant_id = ${tenantId} RETURNING doc`;
    await tx.$executeRaw`
      INSERT INTO tenant_action (tenant_id, seq, action, actor, source, at, idempotency_key, resulting_version, subject_ids)
      VALUES (${tenantId}, ${seq}::bigint, ${JSON.stringify(action)}::jsonb, ${actor}, ${source},
              to_timestamp(${at}::float8 / 1000), ${idempotencyKey ?? null}, ${resultingVersion}, ${subjects}::text[])`;
    return written.doc;
  }

  /** Steps 2–6 of an apply, under the row lock. */
  private async applyLocked(tx: Tx, tenantId: TenantId, locked: LockedRow, requested: DemoAction, meta: ApplyMeta, options: ApplyOptions): Promise<ApplyOutcome> {

    // 2. The clock, after the lock. `at` (the event stamp) never goes before the previous entry.
    const clock = await this.clock(tx);
    if (locked.expires_ms !== null && locked.expires_ms <= clock) return { done: { ok: false, reason: "not-found" } };
    const stamp = this.trustCallerClock && meta.at !== undefined && Number.isFinite(meta.at) ? Math.floor(meta.at) : clock;
    const { seq, at } = await this.auditPosition(tx, tenantId, locked.version, stamp);

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
    const document = JSON.stringify(reduced);
    const documentBytes = Buffer.byteLength(document);
    if (documentBytes > MAX_DOCUMENT_BYTES) {
      return { done: { ok: false, reason: "rejected", detail: DOCUMENT_SIZE_REFUSAL, version: locked.version } };
    }

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
    const written = await this.writeDocumentAndAction(tx, document, entry, clock, subjectIds(action, state, reduced));
    const effects: StoreEffect[] = [];
    for (const [id, { fingerprint: print, record }] of staged) {
      const effect = effectOf(record);
      await tx.$executeRaw`
        INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, next_attempt_at)
        VALUES (${tenantId}, ${seq}::bigint, ${effects.length}, ${id}, ${print}, ${effect.kind}, ${JSON.stringify(record)}::jsonb,
                to_timestamp(${clock}::float8 / 1000))`;
      effects.push(effect);
    }
    const commit: Replay = { state: written, version, entry, effects };
    if (key !== undefined) {
      await tx.$executeRaw`
        INSERT INTO tenant_idempotency (tenant_id, key, fingerprint_hmac, seq, result, expires_at)
        VALUES (${tenantId}, ${key}, ${fingerprint}, ${seq}::bigint, ${JSON.stringify(commit)}::jsonb, to_timestamp(${clock + IDEMPOTENCY_TTL_MS}::float8 / 1000))
        ON CONFLICT (tenant_id, key) DO UPDATE
        SET fingerprint_hmac = EXCLUDED.fingerprint_hmac, seq = EXCLUDED.seq, result = EXCLUDED.result, expires_at = EXCLUDED.expires_at`;
    }
    return { commit: { ...commit, documentBytes } };
  }

  /**
   * Delivers the tenant's due effects in commit order, this apply's included.
   * Each row is claimed with a lease, sent and acknowledged in its own
   * statement, so a slow or failing later send never undoes an earlier one and
   * no connection is held while a sink runs.
   */
  private async drain(tenantId: TenantId) {
    try {
      // Claims one row at a time, so a refund another apply queued behind this
      // apply's checkout is claimed as soon as the checkout is acknowledged.
      await deliverDue({
        db: this.prisma,
        clock: () => this.clock(this.prisma),
        sinks: this.sinks,
        simulatedSinks: this.simulatedSinks,
        leaseMs: this.leaseMs,
        maxAttempts: this.maxAttempts,
        tenants: [tenantId],
      }, DRAIN_LIMIT);
    } catch {
      // The change is committed and its effects are in the outbox; the poller delivers what is left.
    }
  }

  /**
   * Erases one customer (GDPR art. 17) in one transaction under the row lock:
   *
   * - `tenant_action` rows that name the customer (by `subject_ids`, their
   *   email, or a phone field with their number in any format) get their
   *   personal fields redacted by PERSONAL_FIELDS and `redacted_at` set. Their
   *   name, phone and email are also replaced in every other row of the
   *   tenant, the informational `idempotency_key` column included.
   * - `tenant_effect`: messages addressed to them are redacted. An unsent one
   *   is cancelled; one a deliverer holds right now is stopped (`erased_at`)
   *   and reported in `inFlightMessages`, and its deliverer still records
   *   the true outcome. Other messages and delivered payments only lose the
   *   identifiers. Pending payments are kept so a refund still goes out.
   * - `tenant_idempotency` rows whose stored result mentions them are deleted.
   *   Other keys keep protecting their retries.
   * - The document runs `customer/erase` like any apply (a new version and a
   *   log entry without the name), when it still holds the customer, live or
   *   in the trash.
   *
   * With `erasure: "function"` the table part is the SECURITY DEFINER
   * `erase_subject` from prisma/grants/erase-subject.sql, called in the same
   * transaction: the application role may only insert into and read
   * `tenant_action`. The default runs the same statements itself.
   */
  async eraseSubject(tenantId: TenantId, customerId: string, meta: ApplyMeta = {}): Promise<EraseResult> {
    const start = performance.now();
    if (typeof customerId !== "string" || !customerId) return { ok: false, reason: "not-found" };
    const result = await this.transaction(tenantId, async (tx): Promise<{ erased: EraseResult; commit?: DocumentCommit }> => {
      const locked = await this.lock(tx, tenantId);
      if (!locked) return { erased: { ok: false, reason: "not-found" } };
      const clock = await this.clock(tx);
      if (locked.expires_ms !== null && locked.expires_ms <= clock) return { erased: { ok: false, reason: "not-found" } };
      const state = migrateSaved(locked.doc);
      const customer = state ? findErasable(state, customerId) : undefined;
      // Before the document changes: erase_subject reads the customer's identifiers from it.
      const counts = this.erasure === "function"
        ? await this.eraseWithFunction(tx, tenantId, customerId)
        : await this.redactLog(tx, tenantId, customerId, customer, clock);
      if (!customer) return { erased: { ok: true, version: locked.version, ...counts } };
      const committed = await this.applyLocked(tx, tenantId, locked, { type: "customer/erase", id: customerId }, meta, {});
      if ("done" in committed) throw new Error("STUDIO_STORE_ERASE_REFUSED");
      const { commit } = committed;
      return { erased: { ok: true, version: commit.version, entry: commit.entry, ...counts }, commit };
    });
    if ("lockTimeout" in result) return { ok: false, reason: "conflict" };
    if (result.commit) await this.published(tenantId, result.commit, start);
    return detach(result.erased);
  }

  private async eraseWithFunction(tx: Tx, tenantId: TenantId, customerId: string): Promise<EraseCounts> {
    const [{ counts }] = await tx.$queryRaw<Array<{ counts: { actions: number; effects: number; idempotencyKeys: number; pendingPayments: number; inFlightMessages: number } }>>`
      SELECT erase_subject(${tenantId}, ${customerId}) AS counts`;
    const { pendingPayments, inFlightMessages, ...redacted } = counts;
    return { redacted, pendingPayments, inFlightMessages };
  }

  /** The table half of an erasure, inside its transaction. Mirrors erase_subject in prisma/grants/erase-subject.sql. */
  private async redactLog(tx: Tx, tenantId: TenantId, customerId: string, customer: Customer | undefined, clock: number): Promise<EraseCounts> {
    const identifiers = customer ? customerIdentifiers(customer) : [];
    const contacts = customer ? customerIdentifiers({ ...customer, firstName: "", lastName: "" }) : [];
    const digits = customer ? phoneDigits(customer.phone) : "";
    const patterns = jsonTextPatterns(identifiers);
    const keyPatterns = plainTextPatterns(identifiers);
    const at = new Date(clock).toISOString();
    const actions = await tx.$queryRaw<Array<{ seq: bigint; action: DemoAction; key: string | null; subject: boolean }>>`
      SELECT seq, action, idempotency_key AS key, subject_ids @> ARRAY[${customerId}]::text[] AS subject FROM tenant_action a
      WHERE tenant_id = ${tenantId}
        AND (subject_ids @> ARRAY[${customerId}]::text[] OR action::text ILIKE ANY(${patterns}::text[])
          OR idempotency_key ILIKE ANY(${keyPatterns}::text[])
          OR (${digits} <> '' AND EXISTS (
            SELECT 1 FROM jsonb_path_query(a.action, 'lax $.**.phone') p
            WHERE jsonb_typeof(p) = 'string'
              AND regexp_replace(regexp_replace(regexp_replace(p #>> '{}', '\\D', '', 'g'), '^(00)?46', ''), '^0', '') = ${digits})))
      ORDER BY seq`;
    const named: bigint[] = [];
    let redactedActions = 0;
    for (const row of actions) {
      // Named by id, email or phone: redact by the map. A name alone only has the name replaced.
      const theirs = row.subject || mentionsCustomer(row.action, customerId, contacts, digits);
      if (theirs) named.push(row.seq);
      const action = scrubDeep(theirs ? redactAction(row.action) : row.action, identifiers);
      const key = row.key === null ? null : scrubText(row.key, identifiers);
      await tx.$executeRaw`
        UPDATE tenant_action SET action = ${JSON.stringify(action)}::jsonb, idempotency_key = ${key},
          redacted_at = coalesce(redacted_at, ${at}::timestamptz)
        WHERE tenant_id = ${tenantId} AND seq = ${row.seq}`;
      redactedActions++;
    }
    // Locked, so an acknowledgement waits for this transaction and a claim skips these rows.
    const effects = await tx.$queryRaw<Array<{ id: string; kind: StoreEffect["kind"]; status: string; payload: OutboxEntry; leased: boolean }>>`
      SELECT id, kind, status, payload, coalesce(leased_until > ${at}::timestamptz, false) AS leased FROM tenant_effect
      WHERE tenant_id = ${tenantId}
        AND ((kind = 'payment' AND seq = ANY(${named}::bigint[])) OR payload::text ILIKE ANY(${patterns}::text[])
          OR (kind = 'message' AND strpos(coalesce(payload->>'to', ''), ${customerRecipient(customerId)}) > 0))
      ORDER BY seq, n
      FOR UPDATE`;
    let redactedEffects = 0;
    let pendingPayments = 0;
    let inFlightMessages = 0;
    for (const row of effects) {
      if (row.kind === "payment" && row.status === "pending") {
        pendingPayments++;
        continue;
      }
      if (row.kind === "message" && addressedTo(row.payload, customerId)) {
        const payload = JSON.stringify(redactEffectPayload(row.payload, identifiers));
        if (row.status !== "pending") {
          await tx.$executeRaw`UPDATE tenant_effect SET payload = ${payload}::jsonb WHERE id = ${row.id}`;
        } else if (row.leased) {
          // A deliverer is sending it right now: it is stopped for any retry and reported.
          inFlightMessages++;
          await tx.$executeRaw`UPDATE tenant_effect SET payload = ${payload}::jsonb, erased_at = ${at}::timestamptz WHERE id = ${row.id}`;
        } else {
          await tx.$executeRaw`
            UPDATE tenant_effect SET payload = ${payload}::jsonb, status = 'cancelled', erased_at = ${at}::timestamptz WHERE id = ${row.id}`;
        }
        redactedEffects++;
        continue;
      }
      // A payment, or a message to someone else that mentions them: only the identifiers go.
      const scrubbed = scrubDeep(row.payload, identifiers);
      if (scrubbed === row.payload) continue;
      await tx.$executeRaw`UPDATE tenant_effect SET payload = ${JSON.stringify(scrubbed)}::jsonb WHERE id = ${row.id}`;
      redactedEffects++;
    }
    // Stored results are state copies: forget those that hold the customer, keep the rest.
    const idempotencyKeys = await tx.$executeRaw`
      DELETE FROM tenant_idempotency WHERE tenant_id = ${tenantId}
        AND (result::text LIKE ANY(${customerIdPatterns(customerId)}::text[]) OR result::text ILIKE ANY(${patterns}::text[]))`;
    return { redacted: { actions: redactedActions, effects: redactedEffects, idempotencyKeys }, pendingPayments, inFlightMessages };
  }

  subscribe(tenantId: TenantId, listener: (change: StoreChange) => void): () => void {
    const listeners = this.listeners.get(tenantId) ?? new Set();
    this.listeners.set(tenantId, listeners);
    const subscription = (change: StoreChange) => listener(change);
    listeners.add(subscription);
    this.notifications?.start();
    return () => {
      if (!listeners.delete(subscription) || listeners.size) return;
      if (this.listeners.get(tenantId) !== listeners) return;
      this.listeners.delete(tenantId);
      if (!this.listeners.size) this.notifications?.stop();
    };
  }

  /** Whether the dedicated connection has completed LISTEN for this store's subscribers. */
  get notificationsReady() {
    return this.notifications?.ready ?? false;
  }

  /** Releases the listener connection and all subscriptions. Prisma is owned by the caller. */
  close() {
    for (const listeners of this.listeners.values()) listeners.clear();
    this.listeners.clear();
    this.notifications?.stop();
  }

  async history(tenantId: TenantId, query: HistoryQuery): Promise<HistoryPage> {
    // An unknown, deleted or expired tenant has no readable history, by the same clock as `load`.
    if (!(await this.live(tenantId, await this.clock(this.prisma)))) return { entries: [], next: null };
    const limit = Math.max(1, Math.min(HISTORY_MAX_LIMIT, Math.floor(query.limit) || 1));
    const after = Math.max(0, Math.floor(query.after ?? 0));
    const rows = await this.prisma.$queryRaw<Array<{
      seq: bigint; action: TenantAction["action"]; actor: TenantAction["actor"]; source: TenantAction["source"];
      at_ms: number; idempotency_key: string | null; resulting_version: number;
    }>>`
      SELECT a.seq, a.action, a.actor, a.source, (extract(epoch FROM a.at) * 1000)::float8 AS at_ms, a.idempotency_key, a.resulting_version
      FROM tenant_action a
      WHERE a.tenant_id = ${tenantId} AND a.seq > ${after}::bigint
      ORDER BY a.seq LIMIT ${limit + 1}`;
    const entries = rows.slice(0, limit).map((row): TenantAction => ({
      seq: Number(row.seq),
      tenantId,
      action: row.action,
      actor: row.actor,
      source: row.source,
      at: Math.round(row.at_ms),
      ...(row.idempotency_key === null ? {} : { idempotencyKey: row.idempotency_key }),
      resultingVersion: row.resulting_version,
    }));
    return { entries, next: rows.length > limit ? entries.at(-1)!.seq : null };
  }
}
