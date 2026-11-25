// Journal recordings in the concept demo: this browser only, in their own
// IndexedDB database (not `concept-store`, which keeps salons small). Each
// customer keeps their last five recordings, recorded or uploaded; adding a
// sixth drops the oldest in the same transaction. Demo data only: nothing
// here is sent to a server or to a model.
//
// TODO(production): before real customers, recordings belong in the same
// private, encrypted EU store as journal photos (docs/operations/MEDIA_STORAGE.md,
// a `journal-audio/<tenant>/<id>` prefix), uploaded straight to storage with a
// short-lived, size-capped URL, with embedded metadata (GPS, device, time in
// m4a `udta`/`ilst`) removed before it is kept, playable only by staff who may
// open that customer's journal, and the rolling deletion logged without audio
// or text. Recorded treatment audio can be health data: the legal basis under
// GDPR Article 9, the customer's information and the DPIA
// (docs/legal/DPIA_JOURNAL.md) need a lawyer's review first.

export const KEEP_RECORDINGS = 5;
export const AUDIO_DB_NAME = "concept-journal-audio";
export const AUDIO_DB_VERSION = 2;
const STORE = "recordings";
const BY_CUSTOMER = "byCustomer";

export interface JournalRecording {
  id: string;
  customerId: string;
  /** Workspace and salon lifetime (`workspace:epoch`), or `account:<slug>` for a signed-in salon. */
  scope: string;
  /** Milliseconds since the epoch; orders the five kept. */
  createdAt: number;
  source: "recorded" | "uploaded";
  /** The type the bytes were recognised as, never the name the file came with. */
  mime: string;
  seconds: number;
  /** What was said, from live speech recognition or typed by the owner. */
  transcript?: string;
  bytes: ArrayBuffer;
}

/**
 * Storage key for one salon lifetime. Account recordings use the slug so they
 * remain after sign-out, when the store issues a new session epoch.
 */
export const audioScope = (target: { workspace: string; epoch: string }, salon?: { slug?: string }) =>
  target.workspace === "account" && salon?.slug ? `account:${salon.slug}` : `${target.workspace}:${target.epoch}`;

export interface JournalAudioStore {
  /** The customer's recordings in this salon lifetime, newest first. */
  list(customerId: string, scope: string): Promise<JournalRecording[]>;
  /** Keeps a recording and returns the ids of the older ones it pushed out (same customer and scope). */
  add(recording: JournalRecording): Promise<string[]>;
  setTranscript(id: string, transcript: string): Promise<void>;
  /** Removes every recording of a customer in this salon lifetime (erasure). */
  removeCustomer(customerId: string, scope: string): Promise<void>;
  /** Removes every recording of one salon lifetime. */
  removeScope(scope: string): Promise<void>;
  /** Removes every recording whose scope belongs to this workspace (salon deleted with no successor). */
  removeWorkspace(workspace: string): Promise<void>;
}

const newestFirst = (a: JournalRecording, b: JournalRecording) => b.createdAt - a.createdAt || b.id.localeCompare(a.id);

/** The ids beyond the newest `keep` of one customer's recordings. */
export function beyondLimit(recordings: JournalRecording[], keep = KEEP_RECORDINGS): string[] {
  return [...recordings].sort(newestFirst).slice(keep).map((recording) => recording.id);
}

export function memoryAudioStore(): JournalAudioStore {
  const rows = new Map<string, JournalRecording>();
  const of = (customerId: string, scope: string) => [...rows.values()].filter((row) => row.customerId === customerId && row.scope === scope);
  const inWorkspace = (workspace: string) => [...rows.values()].filter((row) => row.scope.startsWith(`${workspace}:`));
  return {
    async list(customerId, scope) {
      return of(customerId, scope).sort(newestFirst);
    },
    async add(recording) {
      rows.set(recording.id, recording);
      const dropped = beyondLimit(of(recording.customerId, recording.scope));
      dropped.forEach((id) => rows.delete(id));
      return dropped;
    },
    async setTranscript(id, transcript) {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, transcript });
    },
    async removeCustomer(customerId, scope) {
      of(customerId, scope).forEach((row) => rows.delete(row.id));
    },
    async removeScope(scope) {
      [...rows.values()].filter((row) => row.scope === scope).forEach((row) => rows.delete(row.id));
    },
    async removeWorkspace(workspace) {
      inWorkspace(workspace).forEach((row) => rows.delete(row.id));
    },
  };
}

const whenDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("journal audio transaction failed"));
  });

/** True when the audio database could not be opened (storage blocked or missing). */
export function isAudioStoreUnavailable(error: unknown): boolean {
  return error instanceof Error && error.name === "AudioStoreUnavailableError";
}

function unavailable(cause: unknown): Error {
  const error = new Error("journal audio store unavailable", { cause });
  error.name = "AudioStoreUnavailableError";
  return error;
}

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE, { keyPath: "id" }).createIndex(BY_CUSTOMER, ["scope", "customerId"]);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(unavailable(request.error));
  });
}

export function indexedDbAudioStore(factory: IDBFactory): JournalAudioStore {
  let db: Promise<IDBDatabase> | undefined;
  const connect = () => {
    if (!db) {
      db = open(factory).catch((error) => {
        db = undefined;
        throw error;
      });
    }
    return db;
  };
  /** Every read and write of one call in one transaction, in callbacks only so it cannot commit early. */
  const run = async <T>(mode: IDBTransactionMode, body: (store: IDBObjectStore, set: (value: T) => void) => void): Promise<T> => {
    const tx = (await connect()).transaction(STORE, mode);
    let result!: T;
    body(tx.objectStore(STORE), (value) => (result = value));
    await whenDone(tx);
    return result;
  };
  const forCustomer = (store: IDBObjectStore, customerId: string, scope: string, then: (rows: JournalRecording[]) => void) => {
    const request = store.index(BY_CUSTOMER).getAll([scope, customerId]);
    request.onsuccess = () => then(request.result as JournalRecording[]);
  };
  return {
    list: (customerId, scope) => run<JournalRecording[]>("readonly", (store, set) => forCustomer(store, customerId, scope, (rows) => set(rows.sort(newestFirst)))),
    add: (recording) =>
      run<string[]>("readwrite", (store, set) => {
        store.put(recording).onsuccess = () =>
          forCustomer(store, recording.customerId, recording.scope, (rows) => {
            const dropped = beyondLimit(rows);
            dropped.forEach((id) => store.delete(id));
            set(dropped);
          });
      }),
    setTranscript: (id, transcript) =>
      run<void>("readwrite", (store) => {
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) store.put({ ...request.result, transcript });
        };
      }),
    removeCustomer: (customerId, scope) =>
      run<void>("readwrite", (store) => forCustomer(store, customerId, scope, (rows) => rows.forEach((row) => store.delete(row.id)))),
    removeScope: (scope) =>
      run<void>("readwrite", (store) => {
        const request = store.getAll();
        request.onsuccess = () => {
          for (const row of request.result as JournalRecording[]) {
            if (row.scope === scope) store.delete(row.id);
          }
        };
      }),
    removeWorkspace: (workspace) =>
      run<void>("readwrite", (store) => {
        const request = store.getAll();
        request.onsuccess = () => {
          for (const row of request.result as JournalRecording[]) {
            if (row.scope.startsWith(`${workspace}:`)) store.delete(row.id);
          }
        };
      }),
  };
}

let shared: JournalAudioStore | undefined;

/** The browser's store, or one in memory where IndexedDB is missing (private modes, tests). */
export function journalAudioStore(): JournalAudioStore {
  return (shared ??= typeof indexedDB === "undefined" ? memoryAudioStore() : indexedDbAudioStore(indexedDB));
}

const FORGET_KEY = "concept-journal-audio-forget";

export type AudioForgetJob = { scope: string } | { workspace: string };

const jobKey = (job: AudioForgetJob) => ("scope" in job ? `scope:${job.scope}` : `workspace:${job.workspace}`);

const isForgetJob = (value: unknown): value is AudioForgetJob =>
  !!value && typeof value === "object" && (
    ("scope" in value && typeof value.scope === "string") ||
    ("workspace" in value && typeof value.workspace === "string")
  );

let forgetQueue: AudioForgetJob[] = [];
let forgetQueueLoaded = false;

function loadForgetQueue(): AudioForgetJob[] {
  if (!forgetQueueLoaded) {
    forgetQueueLoaded = true;
    try {
      if (typeof window !== "undefined") {
        const raw = window.localStorage.getItem(FORGET_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) forgetQueue = parsed.filter(isForgetJob);
      }
    } catch {
      forgetQueue = [];
    }
  }
  return forgetQueue;
}

function saveForgetQueue(jobs: AudioForgetJob[]) {
  const seen = new Set<string>();
  forgetQueue = jobs.filter((job) => {
    const key = jobKey(job);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  try {
    if (typeof window === "undefined") return;
    if (forgetQueue.length === 0) window.localStorage.removeItem(FORGET_KEY);
    else window.localStorage.setItem(FORGET_KEY, JSON.stringify(forgetQueue));
  } catch { /* Keep the queue in memory for this tab. */ }
}

async function applyForget(store: JournalAudioStore, job: AudioForgetJob) {
  if ("scope" in job) await store.removeScope(job.scope);
  else await store.removeWorkspace(job.workspace);
}

/** Queued salon cleanups that have not yet succeeded. Used by tests. */
export function forgottenAudioJobs(): AudioForgetJob[] {
  return [...loadForgetQueue()];
}

/** Drops the retry queue (tests). */
export function clearForgottenAudio() {
  forgetQueueLoaded = true;
  saveForgetQueue([]);
}

/** Retries removals that failed because storage was blocked, and drops the ones that now succeed. */
export async function retryForgottenAudio(store: JournalAudioStore = journalAudioStore()): Promise<void> {
  for (const job of [...loadForgetQueue()]) {
    try {
      await applyForget(store, job);
      saveForgetQueue(loadForgetQueue().filter((item) => jobKey(item) !== jobKey(job)));
    } catch {
      // Stay queued until storage works again.
    }
  }
}

/** Removes recordings of a deleted or replaced salon; remembers the job if storage is blocked so it can be retried. */
export async function forgetSalonAudio(workspace: string, epoch?: string, store: JournalAudioStore = journalAudioStore()): Promise<void> {
  const job: AudioForgetJob = epoch ? { scope: `${workspace}:${epoch}` } : { workspace };
  await retryForgottenAudio(store);
  try {
    await applyForget(store, job);
    saveForgetQueue(loadForgetQueue().filter((item) => jobKey(item) !== jobKey(job)));
  } catch {
    saveForgetQueue([...loadForgetQueue(), job]);
  }
}
