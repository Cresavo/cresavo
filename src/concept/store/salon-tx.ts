// Shared by the salon storage adapters (salon-db.ts, memory-salon-db.ts); see
// docs/design/BROWSER_STORE_IDB.md.

export type Workspace = "demo" | "own";
export const WORKSPACES: readonly Workspace[] = ["demo", "own"];

/** One salon: its JSON text plus a shared version and the id of its lifetime. */
export interface SalonRecord {
  /** Increments by one on every commit, in every tab. */
  version: number;
  /** New whenever the salon is created or replaced, so commands made for its predecessor are refused. */
  epoch: string;
  /** The `DemoState` as JSON text. */
  doc: string;
}

/** What a transaction reads before `change` runs. Keep it small: each salon read is a whole document. */
export interface SalonScope {
  salons?: readonly Workspace[];
  /** Only whether these salons exist (a key count, no document). */
  exists?: readonly Workspace[];
  meta?: readonly string[];
}

/** The snapshot a `change` sees and the writes it stages. Writes are issued after `change` returns. */
export interface SalonTx {
  salon(workspace: Workspace): SalonRecord | null;
  has(workspace: Workspace): boolean;
  meta<T = unknown>(key: string): T | undefined;
  putSalon(workspace: Workspace, record: SalonRecord): void;
  deleteSalon(workspace: Workspace): void;
  putMeta(key: string, value: unknown): void;
  deleteMeta(key: string): void;
}

/** A salon written or deleted by a commit. */
export interface SalonChange {
  workspace: Workspace;
  record: SalonRecord | null;
}

export type WriteResult<T> =
  | { ok: true; value: T; changes: SalonChange[] }
  /** `storage`: the transaction aborted (quota, I/O); `outdated`: a newer schema closed this connection. Nothing was written. */
  | { ok: false; reason: "storage" | "outdated"; error?: string };

export interface SalonDb {
  read(workspace: Workspace): Promise<SalonRecord | null>;
  /** Both salons in one read, e.g. after a bfcache restore (deletions included). */
  readAll(): Promise<Record<Workspace, SalonRecord | null>>;
  /**
   * One readwrite transaction. `change` must be synchronous: a returned
   * thenable or a throw aborts and writes nothing (the promise rejects).
   * Resolves only once the transaction completed.
   */
  write<T>(scope: SalonScope, change: (tx: SalonTx) => T): Promise<WriteResult<T>>;
  /** Salons changed by this handle's commits (at once) and by other tabs (after re-reading). */
  subscribe(listener: (change: SalonChange) => void): () => void;
  /** Every aborted write, also for callers that do not look at the result. */
  onStorageFailure(listener: (error: string | undefined) => void): () => void;
  /** Errors thrown by listeners or the cross-tab channel. They never change a write's result. */
  onListenerError(listener: (error: unknown) => void): () => void;
  close(): void;
}

/**
 * Calls each listener, isolating its errors: a commit has already happened, so a
 * throwing subscriber must neither block the caller's result nor skip the others.
 * Errors go to `report`, or to the console when nobody listens for them.
 */
export function callEach<A>(listeners: Iterable<(arg: A) => void>, arg: () => A, report: (error: unknown) => void) {
  for (const listener of [...listeners]) {
    try {
      listener(arg());
    } catch (error) {
      report(error);
    }
  }
}

/**
 * Runs callbacks later, in the order they were queued, never inside the call
 * that queued them. Every user callback of a store goes through one queue, so
 * no listener can re-enter an open, a settle, a close or a write's completion.
 */
export function callbackQueue() {
  const queued: Array<() => void> = [];
  let scheduled = false;
  const flush = () => {
    for (let next = queued.shift(); next; next = queued.shift()) next();
    scheduled = false;
  };
  return (callback: () => void) => {
    queued.push(callback);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  };
}

/** Collects `onListenerError` listeners and delivers reports through `defer`; reporting is itself isolated. */
export function errorReporter(defer: (callback: () => void) => void) {
  const listeners = new Set<(error: unknown) => void>();
  const deliver = (error: unknown) => {
    if (!listeners.size) {
      console.error("SalonDb listener failed", error);
      return;
    }
    for (const listener of [...listeners]) {
      try { listener(error); } catch (failure) { console.error("SalonDb error listener failed", failure); }
    }
  };
  const report = (error: unknown) => defer(() => deliver(error));
  const subscribe = (listener: (error: unknown) => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  };
  return { report, subscribe };
}

const isThenable = (value: unknown) =>
  !!value && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";

/** A refused promise-returning change may still reject on its own; observe that, so only the write's error remains. */
function observeRejection(value: PromiseLike<unknown>) {
  value.then(undefined, () => undefined);
}

export class SynchronousChangeError extends TypeError {
  constructor() {
    super("SalonDb.write: change must be synchronous; awaiting inside a transaction lets it commit early");
  }
}

export type SalonOp =
  | { store: "salons"; key: Workspace; value: SalonRecord | null }
  | { store: "meta"; key: string; value: unknown; remove: boolean };

export interface Snapshot {
  salons: Map<Workspace, SalonRecord | null>;
  exists: Map<Workspace, boolean>;
  meta: Map<string, unknown>;
}

/**
 * Runs `change` on a snapshot and returns its value with the staged writes,
 * the last write per key winning. Shared by both adapters. Throws
 * `SynchronousChangeError` for a thenable.
 */
export function runChange<T>(snapshot: Snapshot, change: (tx: SalonTx) => T): { value: T; ops: SalonOp[] } {
  const ops = new Map<string, SalonOp>();
  const stage = (op: SalonOp) => { ops.delete(`${op.store}:${op.key}`); ops.set(`${op.store}:${op.key}`, op); };
  const tx: SalonTx = {
    salon(workspace) {
      if (!snapshot.salons.has(workspace)) throw new RangeError(`SalonDb.write: salon "${workspace}" is not in the scope`);
      const record = snapshot.salons.get(workspace);
      return record ? { ...record } : null;
    },
    has(workspace) {
      if (snapshot.salons.has(workspace)) return !!snapshot.salons.get(workspace);
      if (snapshot.exists.has(workspace)) return snapshot.exists.get(workspace)!;
      throw new RangeError(`SalonDb.write: salon "${workspace}" is not in the scope`);
    },
    meta<V>(key: string) {
      if (!snapshot.meta.has(key)) throw new RangeError(`SalonDb.write: meta "${key}" is not in the scope`);
      return structuredClone(snapshot.meta.get(key)) as V | undefined;
    },
    putSalon: (workspace, record) => stage({ store: "salons", key: workspace, value: validRecord(record) }),
    deleteSalon: (workspace) => stage({ store: "salons", key: workspace, value: null }),
    putMeta: (key, value) => stage({ store: "meta", key, value: structuredClone(value), remove: false }),
    deleteMeta: (key) => stage({ store: "meta", key, value: undefined, remove: true }),
  };
  const value = change(tx);
  if (isThenable(value)) {
    observeRejection(value as PromiseLike<unknown>);
    throw new SynchronousChangeError();
  }
  return { value, ops: [...ops.values()] };
}

function validRecord(record: SalonRecord): SalonRecord {
  if (!Number.isSafeInteger(record.version) || record.version < 1 || typeof record.epoch !== "string" || !record.epoch || typeof record.doc !== "string") {
    throw new TypeError("SalonDb.write: invalid salon record");
  }
  return { version: record.version, epoch: record.epoch, doc: record.doc };
}

export const changesOf = (ops: SalonOp[]): SalonChange[] =>
  ops.flatMap((op) => (op.store === "salons" ? [{ workspace: op.key, record: op.value && { ...op.value } }] : []));

/** A random epoch. `getRandomValues` also works outside secure contexts, unlike `randomUUID`. */
export function newEpoch(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
