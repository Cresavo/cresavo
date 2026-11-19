import type { DemoAction } from "../actions";
import type { OutboxEntry } from "../connections/simulated/outbox";
import type { DemoState } from "../data/types";
import type { LogActor, LogSource } from "../log/types";

// The one way studio and server code reads and changes a salon's state.
// Today the browser store sits behind it (`BrowserStudioStore`) and an
// in-memory reference (`MemoryStudioStore`) defines the expected behaviour.
// Step 2 adds a Postgres store over `tenant_state` and `tenant_action`; every
// implementation must pass `tests/store-contract/contract.ts`.

/** Identifies one salon. Opaque to callers; the browser store uses its workspace name. */
export type TenantId = string;

/** A salon's state at a version. */
export interface StoreSnapshot {
  state: DemoState;
  /**
   * Increments by exactly one for every committed change. Callers pass it back
   * as `expectedVersion` to say "apply only if nothing changed since I looked".
   */
  version: number;
}

/** Who acted and from where. `at` defaults to the store's clock. */
export interface ApplyMeta {
  actor?: LogActor;
  source?: LogSource;
  /** Epoch milliseconds. Stores with their own clock may ignore it. */
  at?: number;
}

export interface ApplyOptions {
  /** Refuse with `conflict` unless the tenant is still at this version. */
  expectedVersion?: number;
  /**
   * Scoped per tenant. The first committed apply with a key is remembered; a
   * later apply with the same key and the same action returns that result
   * (`replayed: true`) without running the reducer or publishing effects
   * again. The same key with a different action is `idempotency-mismatch`.
   * Refused applies are not remembered, so a retry runs the rules again.
   */
  idempotencyKey?: string;
}

/**
 * Something a committed change asks the outside world to do. Today only the
 * simulated payment ledger stages calls; messages are still sent from inside
 * the reducer (see docs/design/STUDIO_STORE.md, open questions).
 */
export interface StoreEffect {
  kind: "payment";
  record: OutboxEntry;
}

/** One committed change in the append-only action log (`tenant_action` in step 2). */
export interface TenantAction {
  /** 1, 2, 3… per tenant, in commit order, never reused. */
  seq: number;
  tenantId: TenantId;
  action: DemoAction;
  actor: LogActor;
  source: LogSource;
  /** Epoch milliseconds of the commit. */
  at: number;
  idempotencyKey?: string;
  /** The snapshot version this change produced. */
  resultingVersion: number;
}

export type ApplyFailure =
  /** `expectedVersion` was stale. Nothing changed; reload and decide again. */
  | "conflict"
  /** The reducer refused the action or it changed nothing (slot taken, unknown id, invalid input). */
  | "rejected"
  /** The idempotency key was already used for a different action. */
  | "idempotency-mismatch"
  /** No such tenant, or (browser) the tenant is not the one open in this tab. */
  | "not-found";

export type ApplyResult =
  | {
      ok: true;
      state: DemoState;
      version: number;
      /** Effects of this change, published once after the commit. On a replay they are the original ones and are not published again. */
      effects: StoreEffect[];
      entry: TenantAction;
      /** True when an earlier apply with the same idempotency key is being returned. */
      replayed: boolean;
    }
  | { ok: false; reason: ApplyFailure; /** The tenant's current version, when known. */ version?: number };

/** Sent to subscribers after a change is committed. */
export interface StoreChange {
  tenantId: TenantId;
  version: number;
  /** Absent when the store noticed a change made outside it (the browser's legacy `dispatch` or another tab). */
  entry?: TenantAction;
  effects: StoreEffect[];
}

export interface HistoryQuery {
  /** Return entries with `seq` greater than this. Omit to start at the beginning. */
  after?: number;
  /** At most this many entries (1–500). */
  limit: number;
}

export interface HistoryPage {
  /** Oldest first. */
  entries: TenantAction[];
  /** Pass as `after` for the next page; null when there is no more. */
  next: number | null;
}

/**
 * Per-tenant salon state behind one async interface.
 *
 * - **Validation.** `apply` runs the action through the reducer
 *   (`prepareAction`), the same rules as `dispatch` today. A refusal or a
 *   no-op returns `rejected` and leaves state, version and log unchanged.
 * - **Optimistic concurrency.** Applies to one tenant are serialized. With
 *   `expectedVersion` the apply commits only if the tenant is still at that
 *   version; otherwise `conflict`. Without it, the reducer decides against
 *   the latest state, so two bookings for one slot never both succeed.
 * - **Idempotency.** See `ApplyOptions.idempotencyKey`.
 * - **Effects after commit.** Payment calls are staged while the reducer
 *   runs and published only when the change is committed, then reported in
 *   the result and to subscribers. A conflict or refusal publishes nothing.
 * - **Log.** Every commit appends one `TenantAction`; entries are never
 *   changed or removed by the store.
 * - **Isolation.** Nothing in one tenant's state, log, keys or effects is
 *   visible through another tenant's id.
 * - **Migration.** `load` returns the state at the current `DEMO_VERSION`,
 *   migrating an older saved document first.
 */
export interface StudioStore {
  /** The tenant's current state, or null when it does not exist (or cannot be migrated). */
  load(tenantId: TenantId): Promise<StoreSnapshot | null>;
  apply(tenantId: TenantId, action: DemoAction, meta?: ApplyMeta, options?: ApplyOptions): Promise<ApplyResult>;
  /** Called after each commit to this tenant. Returns an unsubscribe function. */
  subscribe(tenantId: TenantId, listener: (change: StoreChange) => void): () => void;
  history(tenantId: TenantId, query: HistoryQuery): Promise<HistoryPage>;
}

/** Largest page `history` returns. */
export const HISTORY_MAX_LIMIT = 500;

/** Key-order independent JSON, so the same action always fingerprints the same. */
export function actionFingerprint(action: DemoAction): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
    }
    return value;
  };
  return JSON.stringify(canonical(action));
}

/** Shared paging over an ascending, gap-free log. */
export function pageHistory(log: readonly TenantAction[], query: HistoryQuery): HistoryPage {
  const limit = Math.max(1, Math.min(HISTORY_MAX_LIMIT, Math.floor(query.limit)));
  const after = query.after ?? 0;
  const entries = log.filter((entry) => entry.seq > after).slice(0, limit);
  const last = entries.at(-1);
  return { entries, next: last && log.some((entry) => entry.seq > last.seq) ? last.seq : null };
}

/** Calls each listener, so one failing subscriber cannot undo or block a commit. */
export function notifyAll(listeners: Iterable<(change: StoreChange) => void>, change: StoreChange) {
  for (const listener of listeners) {
    try {
      listener(change);
    } catch {
      // A subscriber's error is its own; the change is already committed.
    }
  }
}
