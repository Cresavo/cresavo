import type { DemoAction } from "../actions";
import { stableHash } from "../connections/core";
import type { DemoState } from "../data/types";
import { defaultMeta } from "../log/capture";
import type { LogMeta } from "../log/types";
import {
  currentRaw,
  currentState,
  dispatchWithLog,
  latestState,
  latestStateOf,
  epochOf,
  onSalonRemoved,
  subscribeStore,
  withAddressLock,
  withBookingLock,
} from "../store";
import {
  isErasure,
  actionFingerprint,
  detach,
  effectOf,
  notifyAll,
  pageHistory,
  sameContent,
  type ApplyFailure,
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

// StudioStore over the existing browser store (src/concept/store.ts), which
// keeps working exactly as before: this adapter calls `latestState`,
// `dispatchWithLog`, `withBookingLock` and `withAddressLock`, and listens to
// the store's own notifications. What it adds lives in this tab's memory,
// shared by every adapter instance in the tab:
//
// - A tab holds one open salon. Its tenant id is the workspace ("demo" for
//   the sample business, "own" for the owner's trial salon); the other one
//   reports `not-found` until the tab switches to it.
// - The version counts changes this tab has seen: its own commits and any
//   write it picks up from legacy `dispatch` or another tab. Versions are
//   not comparable between tabs.
// - The log and idempotency keys cover applies made through the adapter in
//   this tab. They end when the salon is deleted or replaced.
// - Payments, messages and posts are reported as effects: `dispatchWithLog`
//   stages them and publishes them to the outbox only after its save.
// - Each commit leaves a receipt (a hash of the saved text) in Cache Storage.
//   The next apply in any tab waits until its storage read matches it, so a
//   renderer with an older localStorage view cannot pass a stale version.

/** The browser's tenant ids. */
export type BrowserTenant = "demo" | "own";

/** Generated sample businesses have no industry; the owner's own salon does. */
export function browserTenantOf(state: DemoState): BrowserTenant {
  return state.industry ? "own" : "demo";
}

interface Remembered {
  fingerprint: string;
  seq: number;
  state: DemoState;
  effects: StoreEffect[];
  logId: string | null;
}

interface Tenant {
  seen?: DemoState;
  /** The salon lifetime the log and keys belong to; they end with it. */
  epoch?: string;
  version: number;
  log: TenantAction[];
  keys: Map<string, Remembered>;
}

/** Per tab, like the browser store itself. */
const tab = {
  tenants: new Map<TenantId, Tenant>(),
  listeners: new Map<TenantId, Set<(change: StoreChange) => void>>(),
  /** True while the adapter itself writes, so its own write is not also counted as an outside change. */
  committing: false,
  unbridge: undefined as (() => void) | undefined,
};

onSalonRemoved((workspace) => { tab.tenants.delete(workspace); });

function tenant(tenantId: TenantId): Tenant {
  let record = tab.tenants.get(tenantId);
  if (!record) tab.tenants.set(tenantId, (record = { version: 0, log: [], keys: new Map() }));
  return record;
}

/**
 * Counts a state this tab has not seen yet as one change; the first sighting
 * is version 0. A new lifetime of the salon (another tab replaced it, a new
 * day's sample) ends the log and idempotency keys of the earlier one first,
 * so a key never replays a result from a salon that is gone.
 */
function observe(state: DemoState): Tenant {
  const tenantId = browserTenantOf(state);
  const record = tenant(tenantId);
  const epoch = epochOf(tenantId as BrowserTenant, state);
  if (record.epoch !== epoch) {
    if (record.epoch !== undefined) {
      record.log = [];
      record.keys = new Map();
    }
    record.epoch = epoch;
  }
  if (record.seen === state) return record;
  const outside = record.seen !== undefined && !sameContent(record.seen, state);
  record.seen = state;
  if (outside) {
    record.version += 1;
    notifyAll(tab.listeners.get(tenantId) ?? [], { tenantId, version: record.version, effects: [] });
  }
  return record;
}

function onStoreChange() {
  if (tab.committing) return;
  const state = currentState();
  if (state) observe(state);
}

/** Address changes take the lock the address editor and salon setup use, across both workspaces. */
const MAY_CHANGE_ADDRESS = new Set<DemoAction["type"]>(["salon/slug", "log/undo", "trash/restore"]);

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const receiptUrl = (tenantId: TenantId) => new URL(`/concept-studio-store-${tenantId}`, window.location.origin).href;

async function receipts(): Promise<Cache | undefined> {
  try {
    return await window.caches.open("concept-studio-store");
  } catch {
    // Embedded or private contexts can deny persistent storage.
  }
}

/**
 * Runs `write` under this adapter's per-tenant lock once this tab's storage
 * read matches the last commit's receipt. A read that never matches within
 * a second is a later write made without the adapter, which is then current.
 */
async function withFreshRead<T>(tenantId: TenantId, write: () => Promise<T>, committed: (result: T) => boolean): Promise<T> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.locks) return write();
  return navigator.locks.request(`concept-studio-store-${tenantId}`, async () => {
    const cache = await receipts();
    if (!cache) return write();
    const url = receiptUrl(tenantId);
    const receipt: { hash?: string; day?: string; seq?: number } | undefined = await (await cache.match(url).catch(() => undefined))?.json().catch(() => undefined);
    if (receipt?.hash) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const state = latestState();
        if (!state || browserTenantOf(state) !== tenantId || stableHash(currentRaw() ?? "") === receipt.hash) break;
        // A later sequence or day is newer than the receipt, never an older read.
        if (state.generatedFor !== receipt.day || state.seq > (receipt.seq ?? Infinity)) break;
        await sleep(25);
      }
    }
    const result = await write();
    const state = currentState();
    if (committed(result) && state) {
      await cache.put(url, Response.json({ hash: stableHash(currentRaw() ?? ""), day: state.generatedFor, seq: state.seq })).catch(() => undefined);
    }
    return result;
  });
}

/** What `commit` adds to `apply`: the salon lifetime the command was made for, a guard and extra sends. */
export interface CommitExtras {
  /** The lifetime the command was made for (`currentTarget`); another one is `replaced`. */
  epoch?: string;
  /** Re-checked against the latest saved state; false is `rejected`. */
  guard?: (current: DemoState) => boolean;
  /** Sends that belong to the change but not to its reducer (see `DispatchOptions.send`). */
  send?: (current: DemoState) => boolean;
}

export type CommitFailure = ApplyFailure | "replaced";

/** `apply`'s result plus the activity log entry the change wrote (null for an unlogged change). */
export type CommitResult =
  | (Extract<ApplyResult, { ok: true }> & { logId: string | null })
  | { ok: false; reason: CommitFailure; detail?: string; version?: number };

export class BrowserStudioStore implements StudioStore {
  async load(tenantId: TenantId): Promise<StoreSnapshot | null> {
    const state = latestState();
    if (!state || browserTenantOf(state) !== tenantId) return null;
    return { state: detach(state), version: observe(state).version };
  }

  async apply(tenantId: TenantId, action: DemoAction, meta: ApplyMeta = {}, options: ApplyOptions = {}): Promise<ApplyResult> {
    const result = await this.commit(tenantId, action, meta, options);
    if (!result.ok) return result as Extract<ApplyResult, { ok: false }>;
    const { logId: _logId, ...applied } = result;
    void _logId;
    return applied;
  }

  /**
   * `apply` for the studio's own commands: also refuses a command made for an
   * earlier lifetime of the salon (`replaced`), re-checks `guard` and stages
   * `send` with the change, all against the state it is applied to.
   */
  async commit(tenantId: TenantId, action: DemoAction, meta: ApplyMeta = {}, options: ApplyOptions = {}, extras: CommitExtras = {}): Promise<CommitResult> {
    // Per-tab history and keys would keep the erased customer (see isErasure).
    if (isErasure(action)) return { ok: false, reason: "rejected" };
    const own = detach(action);
    // The same locks the booking pages and the address editor take, so this write queues behind theirs in every tab.
    const locked = () => withBookingLock(() => this.applyNow(tenantId, own, meta, options, extras));
    const fresh = () => withFreshRead(tenantId, MAY_CHANGE_ADDRESS.has(own.type) ? () => withAddressLock(locked).then((r) => r || false) : locked, (r) => !!r && r.ok && !r.replayed);
    const result = await fresh();
    if (result !== false) return result;
    // The locks refuse when the tab switched salon, or when its storage did not catch up with the booking receipt in time.
    const state = latestState();
    const open = !!state && browserTenantOf(state) === tenantId;
    return { ok: false, reason: open ? "conflict" : "not-found", ...(open ? { version: observe(state).version } : {}) };
  }

  private applyNow(tenantId: TenantId, action: DemoAction, meta: ApplyMeta, options: ApplyOptions, extras: CommitExtras): CommitResult {
    const current = latestState();
    if (!current || browserTenantOf(current) !== tenantId) return { ok: false, reason: "not-found" };
    const record = observe(current);
    if (extras.epoch !== undefined && record.epoch !== extras.epoch) return { ok: false, reason: "replaced", version: record.version };
    const fingerprint = actionFingerprint(action);
    const known = options.idempotencyKey === undefined ? undefined : record.keys.get(options.idempotencyKey);
    if (known) {
      if (known.fingerprint !== fingerprint) return { ok: false, reason: "idempotency-mismatch", version: record.version };
      const entry = record.log[known.seq - 1];
      return { ok: true, state: detach(known.state), version: entry.resultingVersion, effects: detach(known.effects), entry: detach(entry), replayed: true, logId: known.logId };
    }
    if (options.expectedVersion !== undefined && options.expectedVersion !== record.version) {
      return { ok: false, reason: "conflict", version: record.version };
    }

    const logMeta: Partial<Omit<LogMeta, "at">> = {};
    if (meta.actor) logMeta.actor = meta.actor;
    if (meta.source) logMeta.source = meta.source;
    let sent: StoreEffect[] = [];
    let refused: CommitFailure | undefined;
    let base = current;
    let outcome: string | null | false;
    tab.committing = true;
    try {
      // The guard runs against the state dispatch is about to change, after it re-read storage.
      outcome = dispatchWithLog(action, logMeta, (latest) => {
        if (browserTenantOf(latest) !== tenantId) {
          refused = "not-found";
          return false;
        }
        // On every pass, first: a new lifetime (another tab replaced the salon, a new day's sample) is not what the
        // command was made for, whatever its version or guard would say. Read from `latest` without refreshing, so
        // dispatch's own check for a write meanwhile still sees it.
        if (extras.epoch !== undefined && epochOf(tenantId as BrowserTenant, latest) !== extras.epoch) {
          refused = "replaced";
          return false;
        }
        const seenVersion = record.version;
        if (observe(latest).version !== seenVersion) {
          if (options.expectedVersion !== undefined) {
            refused = "conflict";
            return false;
          }
        }
        if (extras.guard && !extras.guard(latest)) {
          refused = "rejected";
          return false;
        }
        base = latest;
        refused = undefined;
        return true;
      }, { send: extras.send, refuseNoOp: true, committed: (records) => { sent = records.map(effectOf); } });
    } finally {
      tab.committing = false;
    }
    if (outcome === false) return { ok: false, reason: refused ?? "rejected", version: record.version };

    const state = currentState()!;
    // A reducer no-op that returned a fresh, identical object: saved by the legacy store as before, but not a change.
    if (sameContent(base, state)) {
      record.seen = state;
      return { ok: false, reason: "rejected", version: record.version };
    }
    // eslint-disable-next-line no-restricted-syntax -- Browser audit stamps use the local wall clock.
    const at = Date.now();
    const defaults = defaultMeta(action, at);
    record.seen = state;
    record.version += 1;
    const entry: TenantAction = {
      seq: record.log.length + 1,
      tenantId,
      action,
      actor: logMeta.actor ?? defaults.actor,
      source: logMeta.source ?? defaults.source,
      at,
      ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),
      resultingVersion: record.version,
    };
    record.log.push(entry);
    // Exactly what this commit's stage published, even a send another workspace made too.
    const effects = sent;
    const logId = outcome;
    if (options.idempotencyKey !== undefined) record.keys.set(options.idempotencyKey, { fingerprint, seq: entry.seq, state, effects, logId });
    notifyAll(tab.listeners.get(tenantId) ?? [], { tenantId, version: record.version, entry, effects });
    return { ok: true, state: detach(state), version: record.version, effects: detach(effects), entry: detach(entry), replayed: false, logId };
  }

  subscribe(tenantId: TenantId, listener: (change: StoreChange) => void): () => void {
    const listeners = tab.listeners.get(tenantId) ?? new Set();
    tab.listeners.set(tenantId, listeners);
    listeners.add(listener);
    // Hear legacy dispatches, other tabs and workspace switches while anyone listens.
    if (!tab.unbridge && typeof window !== "undefined") {
      const state = currentState();
      if (state) observe(state);
      tab.unbridge = subscribeStore(onStoreChange);
    }
    return () => {
      listeners.delete(listener);
      if (tab.unbridge && [...tab.listeners.values()].every((set) => set.size === 0)) {
        tab.unbridge();
        tab.unbridge = undefined;
      }
    };
  }

  async history(tenantId: TenantId, query: HistoryQuery): Promise<HistoryPage> {
    // Read the salon first: a replacement or removal another tab made ends the cached records before they are served.
    const state = tenantId === "demo" || tenantId === "own" ? latestStateOf(tenantId) : null;
    const record = tab.tenants.get(tenantId);
    const current = !!state && !!record && browserTenantOf(state) === tenantId && record.epoch === epochOf(tenantId as BrowserTenant, state);
    return pageHistory(current ? record.log : [], query);
  }
}
