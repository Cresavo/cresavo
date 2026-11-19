import type { DemoAction } from "../actions";
import { paymentLedger } from "../connections/simulated/adapters";
import { createOutbox, type Outbox } from "../connections/simulated/outbox";
import { migrateState } from "../data/migrate";
import type { DemoState } from "../data/types";
import { defaultMeta, prepareAction } from "../log/capture";
import {
  actionFingerprint,
  notifyAll,
  pageHistory,
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
// payment ledger per tenant, so runs are deterministic and tenants share
// nothing. The Postgres store is held to the same contract suite.

interface Tenant {
  /** The saved document until the first read migrates it. */
  saved?: unknown;
  state?: DemoState;
  version: number;
  log: TenantAction[];
  keys: Map<string, { fingerprint: string; seq: number; effects: StoreEffect[] }>;
  outbox: Outbox;
  ledger: ReturnType<typeof paymentLedger>;
  /** Serializes applies, like the row lock in step 2. */
  queue: Promise<unknown>;
}

export interface MemoryStudioStoreOptions {
  /** Saved documents by tenant id, in any version `migrateState` accepts. */
  tenants?: Record<TenantId, unknown>;
  /** Epoch milliseconds; defaults to `Date.now`. */
  now?: () => number;
}

export class MemoryStudioStore implements StudioStore {
  private readonly tenants = new Map<TenantId, Tenant>();
  private readonly listeners = new Map<TenantId, Set<(change: StoreChange) => void>>();
  private readonly now: () => number;

  constructor(options: MemoryStudioStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    for (const [id, saved] of Object.entries(options.tenants ?? {})) this.seed(id, saved);
  }

  /** Adds or replaces a tenant from a saved document (copied, as a database would store it). */
  seed(tenantId: TenantId, saved: unknown) {
    const outbox = createOutbox(Infinity);
    this.tenants.set(tenantId, {
      saved: JSON.parse(JSON.stringify(saved)) as unknown,
      version: 0,
      log: [],
      keys: new Map(),
      outbox,
      ledger: paymentLedger(outbox),
      queue: Promise.resolve(),
    });
  }

  /** Every effect published for a tenant, oldest first. */
  publishedEffects(tenantId: TenantId): StoreEffect[] {
    return (this.tenants.get(tenantId)?.outbox.list("payments") ?? []).map((record) => ({ kind: "payment", record }));
  }

  private open(tenantId: TenantId): (Tenant & { state: DemoState }) | undefined {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return undefined;
    if (!tenant.state && tenant.saved !== undefined) {
      tenant.state = migrateState(tenant.saved) ?? undefined;
      tenant.saved = undefined;
    }
    return tenant.state ? (tenant as Tenant & { state: DemoState }) : undefined;
  }

  async load(tenantId: TenantId): Promise<StoreSnapshot | null> {
    const tenant = this.open(tenantId);
    return tenant ? { state: tenant.state, version: tenant.version } : null;
  }

  apply(tenantId: TenantId, action: DemoAction, meta: ApplyMeta = {}, options: ApplyOptions = {}): Promise<ApplyResult> {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) return Promise.resolve({ ok: false, reason: "not-found" });
    const run = tenant.queue.then(() => this.applyNow(tenantId, action, meta, options));
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
      return { ok: true, state: tenant.state, version: entry.resultingVersion, effects: known.effects, entry, replayed: true };
    }
    if (options.expectedVersion !== undefined && options.expectedVersion !== tenant.version) {
      return { ok: false, reason: "conflict", version: tenant.version };
    }
    const at = meta.at ?? this.now();
    const defaults = defaultMeta(action, at);
    const logMeta = { actor: meta.actor ?? defaults.actor, source: meta.source ?? defaults.source, at };
    const batch = tenant.ledger.stage();
    const next = prepareAction(tenant.state, action, logMeta, batch);
    if (next === tenant.state) return { ok: false, reason: "rejected", version: tenant.version };

    // Commit, then publish: the staged payments reach the outbox only now.
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
    const before = new Set(tenant.outbox.list().map((record) => record.id));
    batch.publish();
    const effects: StoreEffect[] = tenant.outbox.list().filter((record) => !before.has(record.id)).map((record) => ({ kind: "payment", record }));
    if (options.idempotencyKey !== undefined) tenant.keys.set(options.idempotencyKey, { fingerprint, seq: entry.seq, effects });
    notifyAll(this.listeners.get(tenantId) ?? [], { tenantId, version: tenant.version, entry, effects });
    return { ok: true, state: next, version: tenant.version, effects, entry, replayed: false };
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
