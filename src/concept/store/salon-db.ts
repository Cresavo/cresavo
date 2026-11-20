// The browser demo's salon storage (docs/design/BROWSER_STORE_IDB.md). Every
// change is one IndexedDB readwrite transaction: read what the scope names,
// run a synchronous `change`, write what it staged. The browser serializes
// overlapping readwrite transactions across all tabs of the origin, so two tabs
// can never write a salon over each other. Nothing in the app uses this yet.

import { MemorySalonDb } from "./memory-salon-db";
import {
  WORKSPACES,
  changesOf,
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

/** `opening` and `blocked` wait (a slow open is never proof of anything); `memory` only after a confirmed failure. */
export type OpenStatus = "opening" | "blocked" | "open" | "outdated" | "memory";

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
  /** Drops the current connection and opens again, e.g. on a bfcache `pageshow`. */
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

type Backend = { kind: "indexeddb"; db: IDBDatabase } | { kind: "memory"; db: MemorySalonDb } | { kind: "outdated" };

/** Opens the salon database, falling back to tab-only memory only when IndexedDB is confirmed unavailable. */
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
  let closed = false;

  const setStatus = (next: OpenStatus) => {
    if (status === next) return;
    status = next;
    statusListeners.forEach((listener) => listener(next));
  };
  const emit = (change: SalonChange) => listeners.forEach((listener) => listener({ workspace: change.workspace, record: change.record && { ...change.record } }));

  const fallBackToMemory = (): Backend => {
    const memory = new MemorySalonDb();
    memory.subscribe(emit);
    setStatus("memory");
    return { kind: "memory", db: memory };
  };

  const listen = () => {
    if (channel || !makeChannel) return;
    channel = makeChannel(name);
    channel.onmessage = ({ data }) => {
      const message = data as ChannelMessage;
      if (!message || !isWorkspace(message.workspace)) return;
      void handle.read(message.workspace).then((record) => emit({ workspace: message.workspace, record }), () => undefined);
    };
  };

  const connect = (): Promise<Backend> => new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      if (!factory) return resolve(fallBackToMemory());
      request = factory.open(name, options.version ?? DB_VERSION);
    } catch {
      return resolve(fallBackToMemory());
    }
    setStatus("opening");
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SALONS)) db.createObjectStore(SALONS);
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onblocked = () => setStatus("blocked");
    request.onerror = (event) => {
      // Confirmed unavailable: denied (private modes), security or state errors.
      event.preventDefault();
      resolve(fallBackToMemory());
    };
    request.onsuccess = () => {
      const db = request.result;
      // A connection that arrives after this handle closed or moved to memory is not used.
      if (closed || status === "memory") {
        db.close();
        return;
      }
      db.onversionchange = () => {
        db.close();
        backend = Promise.resolve({ kind: "outdated" });
        setStatus("outdated");
      };
      db.onclose = () => {
        // The browser closed it (site data cleared, crash). The next operation opens again.
        if (status === "open") {
          backend = undefined;
          setStatus("opening");
        }
      };
      listen();
      setStatus("open");
      resolve({ kind: "indexeddb", db });
    };
  });

  const current = () => (backend ??= connect());

  const readRecords = async (keys: readonly Workspace[]): Promise<Map<Workspace, SalonRecord | null>> => {
    const open = await current();
    if (open.kind === "outdated") throw new Error("SalonDb: a newer version of the demo is open; reload");
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
      if (open.kind === "outdated") throw new Error("SalonDb: a newer version of the demo is open; reload");
      return open.kind;
    },
    reopen() {
      if (closed || status === "memory" || status === "outdated") return;
      void backend?.then((open) => { if (open.kind === "indexeddb") open.db.close(); });
      backend = undefined;
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
      if (open.kind === "memory") return open.db.write(scope, change);
      return new Promise((resolve, reject) => runTransaction(open.db, scope, change, (outcome) => {
        if ("thrown" in outcome) return reject(outcome.thrown);
        if (!outcome.ok) {
          failureListeners.forEach((listener) => listener(outcome.error));
          return resolve(outcome);
        }
        for (const change of outcome.changes) {
          emit(change);
          channel?.postMessage(change.record ? { workspace: change.workspace, version: change.record.version, epoch: change.record.epoch } : { workspace: change.workspace, deleted: true });
        }
        resolve(outcome);
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
    close() {
      closed = true;
      channel?.close();
      channel = null;
      void backend?.then((open) => { if (open.kind === "indexeddb") open.db.close(); });
    },
  };
  return handle;
}
