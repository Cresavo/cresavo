import type { DemoAction } from "../actions";
import { DEMO_CHANNEL_CURRENCY, withDemoChannels } from "../connections/demo";
import { channelLedger } from "../connections/simulated/adapters";
import { createOutbox, type OutboxEntry } from "../connections/simulated/outbox";
import { withSlotClock } from "../data/slots";
import type { DemoState } from "../data/types";
import { defaultMeta, prepareAction } from "../log/capture";
import {
  isErasure,
  actionFingerprint,
  detach,
  effectOf,
  migrateSaved,
  notifyAll,
  pageHistory,
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

// The reference StudioStore: plain memory, an injectable clock and one
// simulated ledger per tenant for payments, SMS, email and social posts, so
// runs are deterministic and tenants share nothing. Every send is staged
// while the reducer runs and published only after the commit. The Postgres
// store is held to the same contract suite.

interface Remembered {
  fingerprint: string;
  seq: number;
  /** The committed state, kept for an exact replay. Never handed out without a copy. */
  state: DemoState;
  effects: StoreEffect[];
}

interface Tenant {
  /** The saved document until the first read migrates it. */
  saved?: unknown;
  state?: DemoState;
  version: number;
  log: TenantAction[];
  keys: Map<string, Remembered>;
  ledger: ReturnType<typeof channelLedger>;
  /** Serializes applies, like the row lock in step 2. */
  queue: Promise<unknown>;
}

export interface MemoryStudioStoreOptions {
  /** Saved documents by tenant id, in any version `migrateState` accepts. */
  tenants?: Record<TenantId, unknown>;
  /** Epoch milliseconds; defaults to `Date.now`. Also judges checkout-hold expiry. */
  now?: () => number;
}

export class MemoryStudioStore implements StudioStore {
  private readonly tenants = new Map<TenantId, Tenant>();
  private readonly listeners = new Map<TenantId, Set<(change: StoreChange) => void>>();
  private readonly now: () => number;

  constructor(options: MemoryStudioStoreOptions = {}) {
    // eslint-disable-next-line no-restricted-syntax -- The standalone memory store defaults to the wall clock.
    this.now = options.now ?? Date.now;
    for (const [id, saved] of Object.entries(options.tenants ?? {})) this.seed(id, saved);
  }

  /** Adds or replaces a tenant from a saved document (copied, as a database would store it). */
  seed(tenantId: TenantId, saved: unknown) {
    let copy: unknown;
    try {
      copy = JSON.parse(JSON.stringify(saved) ?? "null");
    } catch {
      copy = null;
    }
    this.tenants.set(tenantId, {
      saved: copy,
      version: 0,
      log: [],
      keys: new Map(),
      ledger: channelLedger(createOutbox(Infinity), DEMO_CHANNEL_CURRENCY),
      queue: Promise.resolve(),
    });
  }

  /** Everything published for a tenant (payments, messages, posts), oldest first. */
  published(tenantId: TenantId): OutboxEntry[] {
    return detach(this.tenants.get(tenantId)?.ledger.outbox.list() ?? []);
  }

  private open(tenantId: TenantId): (Tenant & { state: DemoState }) | undefined {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return undefined;
    if (!tenant.state && tenant.saved !== undefined) {
      tenant.state = migrateSaved(tenant.saved) ?? undefined;
      tenant.saved = undefined;
    }
    return tenant.state ? (tenant as Tenant & { state: DemoState }) : undefined;
  }

  async load(tenantId: TenantId): Promise<StoreSnapshot | null> {
    const tenant = this.open(tenantId);
    return tenant ? { state: detach(tenant.state), version: tenant.version } : null;
  }

  apply(tenantId: TenantId, action: DemoAction, meta: ApplyMeta = {}, options: ApplyOptions = {}): Promise<ApplyResult> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return Promise.resolve({ ok: false, reason: "not-found" });
    // Its history and replay results would keep the erased customer (see isErasure).
    if (isErasure(action)) return Promise.resolve({ ok: false, reason: "rejected" });
    // Copied now: the caller may change its object while the apply waits in the queue.
    const own = detach(action);
    const run = tenant.queue.then(() => this.applyNow(tenantId, own, meta, options));
    tenant.queue = run.catch(() => undefined);
    return run;
  }

  private applyNow(tenantId: TenantId, action: DemoAction, meta: ApplyMeta, options: ApplyOptions): ApplyResult {
    const tenant = this.open(tenantId);
    if (!tenant) return { ok: false, reason: "not-found" };
    const fingerprint = actionFingerprint(action);
    const known = options.idempotencyKey === undefined ? undefined : tenant.keys.get(options.idempotencyKey);
    if (known) {
      if (known.fingerprint !== fingerprint) return { ok: false, reason: "idempotency-mismatch", version: tenant.version };
      const entry = tenant.log[known.seq - 1];
      return { ok: true, state: detach(known.state), version: entry.resultingVersion, effects: detach(known.effects), entry: detach(entry), replayed: true };
    }
    if (options.expectedVersion !== undefined && options.expectedVersion !== tenant.version) {
      return { ok: false, reason: "conflict", version: tenant.version };
    }
    const at = meta.at ?? this.now();
    const defaults = defaultMeta(action, at);
    const logMeta = { actor: meta.actor ?? defaults.actor, source: meta.source ?? defaults.source, at };
    const stage = tenant.ledger.stage();
    const next = withSlotClock(at, () => withDemoChannels(stage, () => prepareAction(tenant.state, action, logMeta, stage)));
    if (next === tenant.state || sameContent(next, tenant.state)) return { ok: false, reason: "rejected", version: tenant.version };

    // Commit, then publish: staged payments and messages reach the outbox only now.
    const entry: TenantAction = {
      seq: tenant.log.length + 1,
      tenantId,
      action,
      actor: logMeta.actor,
      source: logMeta.source,
      at,
      ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),
      resultingVersion: tenant.version + 1,
    };
    tenant.state = next;
    tenant.version = entry.resultingVersion;
    tenant.log.push(entry);
    const before = new Set(tenant.ledger.outbox.list().map((record) => record.id));
    stage.publish();
    const effects = tenant.ledger.outbox.list().filter((record) => !before.has(record.id)).map(effectOf);
    if (options.idempotencyKey !== undefined) tenant.keys.set(options.idempotencyKey, { fingerprint, seq: entry.seq, state: next, effects });
    notifyAll(this.listeners.get(tenantId) ?? [], { tenantId, version: tenant.version, entry, effects });
    return { ok: true, state: detach(next), version: tenant.version, effects: detach(effects), entry: detach(entry), replayed: false };
  }

  subscribe(tenantId: TenantId, listener: (change: StoreChange) => void): () => void {
    const listeners = this.listeners.get(tenantId) ?? new Set();
    this.listeners.set(tenantId, listeners);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  async history(tenantId: TenantId, query: HistoryQuery): Promise<HistoryPage> {
    return pageHistory(this.tenants.get(tenantId)?.log ?? [], query);
  }
}
