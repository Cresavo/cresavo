// The browser demo's salon storage (docs/design/BROWSER_STORE_IDB.md). Every
// change is one IndexedDB readwrite transaction: read what the scope names,
// run a synchronous `change`, write what it staged. The browser serializes
// overlapping readwrite transactions across all tabs of the origin, so two tabs
// can never write a salon over each other. Nothing in the app uses this yet.

import { MemorySalonDb } from "./memory-salon-db";
import {
  WORKSPACES,
  callbackQueue,
  callEach,
  changesOf,
  errorReporter,
  runChange,
  type SalonChange,
  type SalonOp,
  type SalonDb,
  type SalonRecord,
  type SalonScope,
  type SalonTx,
  type Snapshot,
  type Workspace,
  type WriteResult,
} from "./salon-tx";

export * from "./salon-tx";

export const DB_NAME = "concept-store";
export const DB_VERSION = 1;
const SALONS = "salons";
const META = "meta";
const errorName = (error: unknown) => (error instanceof Error || error instanceof DOMException ? error.name : undefined);

type Outcome<T> = { ok: true; value: T; changes: SalonChange[] } | { ok: false; reason: "storage"; error?: string } | { ok: false; thrown: unknown };

/**
 * The whole readwrite transaction, in callbacks only: an `await` on anything
 * but an IDB request would let the transaction commit before its writes.
 * Gets run first; `change` and every put run in the last get's callback;
 * `done` is called once, on complete or abort.
 */
export function runTransaction<T>(db: IDBDatabase, scope: SalonScope, change: (tx: SalonTx) => T, done: (outcome: Outcome<T>) => void): void {
  let tx: IDBTransaction;
  try {
    tx = db.transaction([SALONS, META], "readwrite");
  } catch (error) {
    done({ ok: false, reason: "storage", error: errorName(error) });
    return;
  }
  const salons = tx.objectStore(SALONS);
  const meta = tx.objectStore(META);
  const snapshot: Snapshot = { salons: new Map(), exists: new Map(), meta: new Map() };
  let result: { value: T; ops: SalonOp[] } | undefined;
  let thrown: unknown;
  let failed = false;
  let storageError: string | undefined;
  const finish = () => {
    try {
      result = runChange(snapshot, change);
    } catch (error) {
      failed = true;
      thrown = error;
      tx.abort();
      return;
    }
    try {
      for (const op of result.ops) {
        if (op.store === "salons") {
          if (op.value) salons.put(op.value, op.key);
          else salons.delete(op.key);
        } else if (op.remove) meta.delete(op.key);
        else meta.put(op.value, op.key);
      }
    } catch (error) {
      // A put can throw at once (quota, a value that cannot be cloned): nothing of this change is kept.
      storageError = errorName(error);
      tx.abort();
    }
  };
  const reads: Array<[IDBRequest, (value: unknown) => void]> = [
    ...(scope.salons ?? []).map((key): [IDBRequest, (value: unknown) => void] => [salons.get(key), (value) => snapshot.salons.set(key, (value as SalonRecord | undefined) ?? null)]),
    ...(scope.exists ?? []).map((key): [IDBRequest, (value: unknown) => void] => [salons.count(key), (value) => snapshot.exists.set(key, (value as number) > 0)]),
    ...(scope.meta ?? []).map((key): [IDBRequest, (value: unknown) => void] => [meta.get(key), (value) => snapshot.meta.set(key, value)]),
  ];
  let pending = reads.length;
  for (const [request, set] of reads) {
    request.onsuccess = () => {
      set(request.result);
      pending -= 1;
      if (pending === 0) finish();
    };
  }
  if (pending === 0) finish();
  tx.oncomplete = () => done({ ok: true, value: result!.value, changes: changesOf(result!.ops) });
  tx.onabort = () => done(failed ? { ok: false, thrown } : { ok: false, reason: "storage", error: storageError ?? tx.error?.name });
}

function readTransaction(db: IDBDatabase, keys: readonly Workspace[], done: (records: Map<Workspace, SalonRecord | null> | Error) => void): void {
  let tx: IDBTransaction;
  try {
    tx = db.transaction(SALONS, "readonly");
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
    return;
  }
  const records = new Map<Workspace, SalonRecord | null>();
  const store = tx.objectStore(SALONS);
  for (const key of keys) {
    const request = store.get(key);
    request.onsuccess = () => { records.set(key, (request.result as SalonRecord | undefined) ?? null); };
  }
  tx.oncomplete = () => done(records);
  tx.onabort = () => done(tx.error ?? new Error("read aborted"));
}

/**
 * `opening` and `blocked` wait (a slow open is never proof of anything).
 * `memory` only after a confirmed failure on the first open. `outdated`: a
 * newer schema exists (reload). `failed`: a reopen failed after this handle
 * used IndexedDB; it never moves to memory mid-session. `closed`: `close()` ran.
 */
export type OpenStatus = "opening" | "blocked" | "open" | "outdated" | "memory" | "failed" | "closed";

/** Operations on a handle after `close()`, or still waiting for an open when it ran. */
export class SalonDbClosedError extends Error {
  constructor() {
    super("SalonDb: the handle is closed");
  }
}

/** Posted after a commit; receivers re-read the salon. */
interface ChannelMessage { workspace: Workspace; version?: number; epoch?: string; deleted?: boolean }

export interface ChannelLike {
  postMessage(message: ChannelMessage): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export interface SalonDbOptions {
  /** Defaults to `globalThis.indexedDB`; null forces the memory adapter. */
  factory?: IDBFactory | null;
  name?: string;
  /** The schema version to open; defaults to `DB_VERSION`. */
  version?: number;
  /** Defaults to a `BroadcastChannel`; null disables cross-tab messages. */
  channel?: ((name: string) => ChannelLike) | null;
}

export interface SalonDbHandle extends SalonDb {
  status(): OpenStatus;
  onStatus(listener: (status: OpenStatus) => void): () => void;
  /** Resolves once the store is usable: on IndexedDB, or on memory after IndexedDB was confirmed unavailable. */
  ready(): Promise<"indexeddb" | "memory">;
  /** Drops the current connection and opens again at once, e.g. on a bfcache `pageshow` or a retry. Joins an open already in flight. */
  reopen(): void;
}

function defaultFactory(): IDBFactory | null {
  try {
    return globalThis.indexedDB ?? null;
  } catch {
    // A sandboxed frame can throw on access.
    return null;
  }
}

function defaultChannel(name: string): ChannelLike {
  return new BroadcastChannel(name) as unknown as ChannelLike;
}

const isWorkspace = (value: unknown): value is Workspace => value === "demo" || value === "own";

type Backend =
  | { kind: "indexeddb"; db: IDBDatabase }
  | { kind: "memory"; db: MemorySalonDb }
  | { kind: "outdated" }
  | { kind: "failed"; error?: string };

const OUTDATED = "SalonDb: a newer version of the demo is open; reload";

/** Opens the salon database, falling back to tab-only memory only when IndexedDB is confirmed unavailable on the first open. */
export function createSalonDb(options: SalonDbOptions = {}): SalonDbHandle {
  const factory = options.factory === undefined ? defaultFactory() : options.factory;
  const name = options.name ?? DB_NAME;
  const makeChannel = options.channel === undefined ? (typeof BroadcastChannel === "undefined" ? null : defaultChannel) : options.channel;
  const listeners = new Set<(change: SalonChange) => void>();
  const failureListeners = new Set<(error: string | undefined) => void>();
  const statusListeners = new Set<(status: OpenStatus) => void>();
  let status: OpenStatus = "opening";
  let backend: Promise<Backend> | undefined;
  let channel: ChannelLike | null = null;
  /** Write transactions started and not yet completed: `close()` keeps the channel until they have broadcast. */
  let activeWrites = 0;
  /** Set once a connection succeeded: from then on a failed open is an error, never a switch to memory. */
  let usedIndexedDb = false;
  /** Rejects the open in flight, so `close()` settles every operation waiting for it. */
  let abandonPending: (() => void) | undefined;

  // Every user callback (status, subscribers, failures, error reports) runs
  // later, in order, from one queue: none ever runs inside an open, a
  // fallback, a settle, a close or a write's completion, so whatever it starts
  // sees the state that goes with what it hears. Status itself changes at once.
  const defer = callbackQueue();
  const errors = errorReporter(defer);
  const setStatus = (next: OpenStatus) => {
    if (status === next || status === "closed") return;
    status = next;
    defer(() => callEach(statusListeners, () => next, errors.report));
  };
  const emit = (change: SalonChange) => defer(() => callEach(listeners, () => ({ workspace: change.workspace, record: change.record && { ...change.record } }), errors.report));
  const reportFailure = (error: string | undefined) => defer(() => callEach(failureListeners, () => error, errors.report));

  const fallBackToMemory = (): Backend => {
    const memory = new MemorySalonDb();
    memory.subscribe(emit);
    memory.onListenerError(errors.report);
    setStatus("memory");
    return { kind: "memory", db: memory };
  };
  /** An open that failed: memory only if IndexedDB never worked in this handle. */
  const unavailable = (error?: string): Backend => {
    if (!usedIndexedDb) return fallBackToMemory();
    setStatus("failed");
    return { kind: "failed", error };
  };
  /** Installs the terminal backend, then announces it. */
  const outdated = (): Backend => {
    const value: Backend = { kind: "outdated" };
    backend = Promise.resolve(value);
    setStatus("outdated");
    return value;
  };

  const listen = () => {
    if (channel || !makeChannel) return;
    try {
      channel = makeChannel(name);
    } catch (error) {
      errors.report(error);
      return;
    }
    channel.onmessage = ({ data }) => {
      const message = data as ChannelMessage;
      if (!message || !isWorkspace(message.workspace)) return;
      void handle.read(message.workspace).then((record) => emit({ workspace: message.workspace, record }), () => undefined);
    };
  };
  const closeChannel = () => {
    try { channel?.close(); } catch { /* Already closed. */ }
    channel = null;
  };
  const broadcast = (change: SalonChange) => {
    try {
      channel?.postMessage(change.record ? { workspace: change.workspace, version: change.record.version, epoch: change.record.epoch } : { workspace: change.workspace, deleted: true });
    } catch (error) {
      errors.report(error);
    }
  };

  /** Starts an open whose promise `current()` has already installed as the backend. */
  const connect = (resolve: (value: Backend) => void, reject: (error: unknown) => void): void => {
    let request: IDBOpenDBRequest;
    try {
      if (!factory) return resolve(unavailable());
      request = factory.open(name, options.version ?? DB_VERSION);
    } catch (error) {
      return resolve(unavailable(errorName(error)));
    }
    let settled = false;
    const settle = (value: Backend) => {
      if (settled) return;
      settled = true;
      abandonPending = undefined;
      resolve(value);
    };
    abandonPending = () => {
      settled = true;
      abandonPending = undefined;
      reject(new SalonDbClosedError());
    };
    setStatus("opening");
    request.onupgradeneeded = () => {
      // Abandoned while blocked (the handle closed): never leave a schema upgrade behind for the other tabs.
      if (settled) {
        request.transaction?.abort();
        return;
      }
      const db = request.result;
      if (!db.objectStoreNames.contains(SALONS)) db.createObjectStore(SALONS);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onblocked = () => setStatus("blocked");
    request.onerror = (event) => {
      event.preventDefault();
      if (settled) return;
      const error = request.error?.name;
      // A newer schema made by another tab: this tab's code is old, its data is not gone.
      if (error === "VersionError") return settle(outdated());
      // Denied (private modes), security or state errors.
      settle(unavailable(error));
    };
    request.onsuccess = () => {
      const db = request.result;
      // A connection that arrives after this handle closed or moved on is not used.
      if (settled || status === "closed" || status === "memory") {
        db.close();
        return;
      }
      usedIndexedDb = true;
      db.onversionchange = () => {
        db.close();
        outdated();
      };
      db.onclose = () => {
        // The browser closed it (site data cleared, crash). The next operation opens again.
        if (status === "open") {
          backend = undefined;
          setStatus("opening");
        }
      };
      // Installed before anything else, so a close from any later callback releases this connection.
      settle({ kind: "indexeddb", db });
      listen();
      setStatus("open");
    };
  };

  const current = (): Promise<Backend> => {
    if (status === "closed") return Promise.reject(new SalonDbClosedError());
    if (!backend) {
      // Installed before any connection work, so an operation started meanwhile joins this open.
      let start!: Parameters<typeof connect>;
      backend = new Promise<Backend>((resolve, reject) => { start = [resolve, reject]; });
      connect(...start);
    }
    return backend;
  };

  const readRecords = async (keys: readonly Workspace[]): Promise<Map<Workspace, SalonRecord | null>> => {
    const open = await current();
    if (open.kind === "outdated") throw new Error(OUTDATED);
    if (open.kind === "failed") throw new Error(`SalonDb: the database could not be opened again (${open.error ?? "unknown"})`);
    if (open.kind === "memory") {
      const all = await open.db.readAll();
      return new Map(keys.map((key) => [key, all[key]]));
    }
    return new Promise((resolve, reject) => readTransaction(open.db, keys, (records) => (records instanceof Error ? reject(records) : resolve(records))));
  };

  const handle: SalonDbHandle = {
    status: () => status,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => { statusListeners.delete(listener); };
    },
    async ready() {
      const open = await current();
      if (open.kind === "outdated") throw new Error(OUTDATED);
      if (open.kind === "failed") throw new Error(`SalonDb: the database could not be opened again (${open.error ?? "unknown"})`);
      return open.kind;
    },
    reopen() {
      // An open in flight already yields a fresh connection: reuse it, so no earlier promise is left unsettled.
      if (status === "closed" || status === "memory" || status === "outdated" || abandonPending) return;
      void backend?.then((open) => { if (open.kind === "indexeddb") open.db.close(); }, () => undefined);
      backend = undefined;
      // Start the replacement now, so a retry reaches "open" (or "failed") without another call.
      void current().catch(() => undefined);
    },
    async read(workspace) {
      return (await readRecords([workspace])).get(workspace) ?? null;
    },
    async readAll() {
      const records = await readRecords(WORKSPACES);
      return { demo: records.get("demo") ?? null, own: records.get("own") ?? null };
    },
    async write<T>(scope: SalonScope, change: (tx: SalonTx) => T): Promise<WriteResult<T>> {
      // Awaiting here is fine: the transaction does not exist yet.
      const open = await current();
      if (open.kind === "outdated") return { ok: false, reason: "outdated" };
      if (open.kind === "failed") {
        reportFailure(open.error);
        return { ok: false, reason: "storage", error: open.error };
      }
      if (open.kind === "memory") return open.db.write(scope, change);
      // Closed while waiting for the connection: refused before any transaction starts.
      if (status === "closed") throw new SalonDbClosedError();
      activeWrites += 1;
      return new Promise((resolve, reject) => runTransaction(open.db, scope, change, (outcome) => {
        try {
          if ("thrown" in outcome) return reject(outcome.thrown);
          // The outcome is settled first: listeners run after, and their errors are reported separately.
          resolve(outcome);
          if (!outcome.ok) return reportFailure(outcome.error);
          // Every other tab hears about the commit, even one that completes after `close()`.
          outcome.changes.forEach(broadcast);
          outcome.changes.forEach(emit);
        } finally {
          activeWrites -= 1;
          if (status === "closed" && activeWrites === 0) closeChannel();
        }
      }));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    onStorageFailure(listener) {
      failureListeners.add(listener);
      return () => { failureListeners.delete(listener); };
    },
    onListenerError: errors.subscribe,
    close() {
      if (status === "closed") return;
      setStatus("closed");
      // New operations are refused from now on; writes already in a transaction still commit and broadcast first.
      if (activeWrites === 0) closeChannel();
      abandonPending?.();
      void backend?.then((open) => {
        if (open.kind === "indexeddb") open.db.close();
        else if (open.kind === "memory") open.db.close();
      }, () => undefined);
    },
  };
  return handle;
}
