import type { DemoAction } from "../actions";
import type { OutboxEntry } from "../connections/simulated/outbox";
import { canonicalJson, jsonEqual } from "../data/json-equal";
import { migrateState } from "../data/migrate";
import { salonClock } from "../tools/clock";
import type { DateKey, DemoState } from "../data/types";
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
 * Something a committed change asks the outside world to do: a payment, or a
 * message or post. Every store stages both while the reducer runs and
 * publishes them only after the commit.
 */
export interface StoreEffect {
  kind: "payment" | "message";
  record: OutboxEntry;
}

export function effectOf(record: OutboxEntry): StoreEffect {
  return { kind: record.port === "payments" ? "payment" : "message", record };
}

/** One committed change in the append-only action log (`tenant_action` in step 2). */
export interface TenantAction {
  /** 1, 2, 3… per tenant, in commit order, never reused. */
  seq: number;
  tenantId: TenantId;
  action: DemoAction | SystemAction;
  actor: LogActor | "system";
  source: LogSource | "system";
  /** Epoch milliseconds of the commit. */
  at: number;
  idempotencyKey?: string;
  /** The snapshot version this change produced. */
  resultingVersion: number;
}

export type SystemAction =
  | { type: "system/reset"; payload: { generatedFor: DateKey } }
  | { type: "system/replace"; payload: { reason: string } };

export type ApplyFailure =
  /** `expectedVersion` was stale, or (browser) this tab could not confirm it had the latest write in time. Nothing changed; reload and retry. */
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
      /**
       * Effects of this change, published once after the commit. On a replay,
       * `state`, `version`, `entry` and `effects` are those of the original
       * commit, even if later changes followed, and nothing is published again.
       */
      effects: StoreEffect[];
      entry: TenantAction;
      /** True when an earlier apply with the same idempotency key is being returned. */
      replayed: boolean;
    }
  | { ok: false; reason: ApplyFailure; detail?: string; /** The tenant's current version, when known. */ version?: number };

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
 * - **Effects after commit.** Payment and message calls are staged while the reducer
 *   runs and published only when the change is committed, then reported in
 *   the result and to subscribers. A conflict or refusal publishes nothing.
 * - **Log.** Every commit appends one `TenantAction`. Privileged erasure
 *   redacts entries, and maintenance applies demo and sandbox retention.
 * - **Isolation.** Nothing in one tenant's state, log, keys or effects is
 *   visible through another tenant's id.
 * - **Detached values.** Everything returned or passed to a listener is a
 *   copy, and the store copies the action it is given: editing a result can
 *   never change the stored state or log.
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

/**
 * Erasure removes a customer for good, but a store also keeps their data in
 * its history, idempotency results and published effects. Only a store that
 * can redact those too (`PostgresStudioStore.eraseSubject`) may run it, never
 * as a plain `apply`: every store refuses `customer/erase` there.
 */
export const isErasure = (action: DemoAction) => action.type === "customer/erase";

/** Largest page `history` returns. */
export const HISTORY_MAX_LIMIT = 500;

/**
 * Key-order independent JSON, so the same action always fingerprints the same.
 * The receipt reference of a public booking is minted per request, so it is
 * left out: a retry of the same intent is the same action.
 */
export function actionFingerprint(action: DemoAction): string {
  if (action.type === "online/book" && action.public) {
    return canonicalJson({ ...action, public: { ...action.public, publicRef: undefined } });
  }
  return canonicalJson(action);
}

/**
 * The action with the caller-reported times that decide eligibility or access
 * replaced by the store's clock: the booking cutoff of an online request
 * (`guest.at`), whether a review comes after the visit, and the start or end of
 * a support grant. Pure event stamps (`stock/order`, `customers/message`) are
 * kept as reported. Stores call this unless they trust the caller's clock.
 */
export function withTrustedTimes(action: DemoAction, at: number): DemoAction {
  const clock = salonClock(new Date(at));
  const local = { date: clock.today, time: clock.minutes };
  switch (action.type) {
    case "online/hold":
    case "online/book":
    case "online/waitlist":
      return { ...action, guest: { ...action.guest, at: local } };
    case "review/submit":
      return { ...action, at: local };
    case "support/grant":
    case "support/revoke":
      return { ...action, at };
    default:
      return action;
  }
}

/** A deep copy, so callers and the store never share mutable objects. */
export function detach<T>(value: T): T {
  return structuredClone(value);
}

/** Paging over a log whose entry `i` has `seq` i + 1; O(page), not O(log). Entries are copies. */
export function pageHistory(log: readonly TenantAction[], query: HistoryQuery): HistoryPage {
  const limit = Math.max(1, Math.min(HISTORY_MAX_LIMIT, Math.floor(query.limit) || 1));
  const after = Math.max(0, Math.floor(query.after ?? 0));
  const entries = log.slice(after, after + limit).map(detach);
  const last = entries.at(-1);
  return { entries, next: last && last.seq < log.length ? last.seq : null };
}

/**
 * True when two states hold the same data apart from the counter `seq`.
 * Catches reducer no-ops that return a fresh but identical object.
 */
export function sameContent(a: DemoState, b: DemoState): boolean {
  return a === b || jsonEqual({ ...a, seq: 0 }, { ...b, seq: 0 });
}

const ARRAYS = ["staff", "services", "customers", "bookings", "checkoutHolds", "inbox", "log", "trash", "categories", "resources", "exceptions"] as const;

/** A saved document migrated to the current version, or null when it is too old, malformed or not a state at all. */
export function migrateSaved(saved: unknown): DemoState | null {
  try {
    const state = migrateState(saved);
    if (!state || typeof state.salon !== "object" || !state.salon || typeof state.localization !== "object") return null;
    return ARRAYS.every((key) => Array.isArray(state[key])) ? state : null;
  } catch {
    return null;
  }
}

/** Calls each listener with its own copy, so one failing or mutating subscriber cannot affect the commit or the others. */
export function notifyAll(listeners: Iterable<(change: StoreChange) => void>, change: StoreChange) {
  for (const listener of [...listeners]) {
    try {
      listener(detach(change));
    } catch {
      // A subscriber's error is its own; the change is already committed.
    }
  }
}
