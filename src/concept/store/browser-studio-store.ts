import type { DemoAction } from "../actions";
import { demoOutbox } from "../connections/demo";
import type { DemoState } from "../data/types";
import { defaultMeta } from "../log/capture";
import type { LogMeta } from "../log/types";
import { currentState, dispatchWithLog, latestState, withBookingLock } from "../store";
import {
  actionFingerprint,
  notifyAll,
  pageHistory,
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
// keeps working exactly as before: this adapter only calls `latestState`,
// `dispatchWithLog` and `withBookingLock`. Its version, action log and
// idempotency keys live in this tab's memory, under no storage key:
//
// - A tab holds one open salon. Its tenant id is the workspace ("demo" for
//   the sample business, "own" for the owner's trial salon); the other one
//   reports `not-found` until the tab switches to it.
// - The version counts changes this tab has seen: its own commits and any
//   write it picks up from legacy `dispatch` or another tab. Versions are
//   not comparable between tabs.
// - The log and keys cover applies made through this adapter in this tab.

/** The browser's tenant ids. */
export type BrowserTenant = "demo" | "own";

/** Generated sample businesses have no industry; the owner's own salon does. */
export function browserTenantOf(state: DemoState): BrowserTenant {
  return state.industry ? "own" : "demo";
}

interface Tenant {
  seen?: DemoState;
  version: number;
  log: TenantAction[];
  keys: Map<string, { fingerprint: string; seq: number; effects: StoreEffect[] }>;
}

const paymentIds = () => new Set(demoOutbox.list("payments").map((record) => record.id));

export class BrowserStudioStore implements StudioStore {
  private readonly tenants = new Map<TenantId, Tenant>();
  private readonly listeners = new Map<TenantId, Set<(change: StoreChange) => void>>();

  private tenant(tenantId: TenantId): Tenant {
    let tenant = this.tenants.get(tenantId);
    if (!tenant) this.tenants.set(tenantId, (tenant = { version: 0, log: [], keys: new Map() }));
    return tenant;
  }

  /** Counts a state this tab has not seen yet as one change; the first sighting is version 0. */
  private observe(state: DemoState): Tenant {
    const tenantId = browserTenantOf(state);
    const tenant = this.tenant(tenantId);
    if (tenant.seen === state) return tenant;
    const external = tenant.seen !== undefined;
    tenant.seen = state;
    if (external) {
      tenant.version += 1;
      notifyAll(this.listeners.get(tenantId) ?? [], { tenantId, version: tenant.version, effects: [] });
    }
    return tenant;
  }

  async load(tenantId: TenantId): Promise<StoreSnapshot | null> {
    const state = latestState();
    if (!state || browserTenantOf(state) !== tenantId) return null;
    return { state, version: this.observe(state).version };
  }

  async apply(tenantId: TenantId, action: DemoAction, meta: ApplyMeta = {}, options: ApplyOptions = {}): Promise<ApplyResult> {
    // The same lock the booking pages take, so this write queues behind theirs in every tab.
    const result = await withBookingLock(() => this.applyNow(tenantId, action, meta, options));
    return result === false ? { ok: false, reason: "not-found" } : result;
  }

  private applyNow(tenantId: TenantId, action: DemoAction, meta: ApplyMeta, options: ApplyOptions): ApplyResult {
    const current = latestState();
    if (!current || browserTenantOf(current) !== tenantId) return { ok: false, reason: "not-found" };
    const tenant = this.observe(current);
    const fingerprint = actionFingerprint(action);
    const known = options.idempotencyKey === undefined ? undefined : tenant.keys.get(options.idempotencyKey);
    if (known) {
      if (known.fingerprint !== fingerprint) return { ok: false, reason: "idempotency-mismatch", version: tenant.version };
      const entry = tenant.log[known.seq - 1];
      return { ok: true, state: current, version: entry.resultingVersion, effects: known.effects, entry, replayed: true };
    }
    if (options.expectedVersion !== undefined && options.expectedVersion !== tenant.version) {
      return { ok: false, reason: "conflict", version: tenant.version };
    }

    const logMeta: Partial<Omit<LogMeta, "at">> = {};
    if (meta.actor) logMeta.actor = meta.actor;
    if (meta.source) logMeta.source = meta.source;
    const before = paymentIds();
    let refused: ApplyFailure | undefined;
    // The guard runs against the state dispatch is about to change, after it re-read storage.
    const outcome = dispatchWithLog(action, logMeta, (latest) => {
      if (browserTenantOf(latest) !== tenantId) {
        refused = "not-found";
        return false;
      }
      if (latest !== tenant.seen) {
        this.observe(latest);
        if (options.expectedVersion !== undefined) {
          refused = "conflict";
          return false;
        }
      }
      refused = undefined;
      return true;
    });
    if (outcome === false) return { ok: false, reason: refused ?? "rejected", version: tenant.version };

    const state = currentState()!;
    const at = Date.now();
    const defaults = defaultMeta(action, at);
    tenant.seen = state;
    tenant.version += 1;
    const entry: TenantAction = {
      seq: tenant.log.length + 1,
      tenantId,
      action,
      actor: logMeta.actor ?? defaults.actor,
      source: logMeta.source ?? defaults.source,
      at,
      ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),
      resultingVersion: tenant.version,
    };
    tenant.log.push(entry);
    // The browser store publishes staged payments right after its write; these are the new ones.
    const effects: StoreEffect[] = demoOutbox.list("payments").filter((record) => !before.has(record.id)).map((record) => ({ kind: "payment", record }));
    if (options.idempotencyKey !== undefined) tenant.keys.set(options.idempotencyKey, { fingerprint, seq: entry.seq, effects });
    notifyAll(this.listeners.get(tenantId) ?? [], { tenantId, version: tenant.version, entry, effects });
    return { ok: true, state, version: tenant.version, effects, entry, replayed: false };
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
