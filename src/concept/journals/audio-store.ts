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
const STORE = "recordings";
const BY_CUSTOMER = "customerId";

export interface JournalRecording {
  id: string;
  customerId: string;
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

export interface JournalAudioStore {
  /** The customer's recordings, newest first. */
  list(customerId: string): Promise<JournalRecording[]>;
  /** Keeps a recording and returns the ids of the older ones it pushed out. */
  add(recording: JournalRecording): Promise<string[]>;
  setTranscript(id: string, transcript: string): Promise<void>;
  /** Removes every recording of a customer (erasure). */
  removeCustomer(customerId: string): Promise<void>;
}

const newestFirst = (a: JournalRecording, b: JournalRecording) => b.createdAt - a.createdAt || b.id.localeCompare(a.id);

/** The ids beyond the newest `keep` of one customer's recordings. */
export function beyondLimit(recordings: JournalRecording[], keep = KEEP_RECORDINGS): string[] {
  return [...recordings].sort(newestFirst).slice(keep).map((recording) => recording.id);
}

export function memoryAudioStore(): JournalAudioStore {
  const rows = new Map<string, JournalRecording>();
  const of = (customerId: string) => [...rows.values()].filter((row) => row.customerId === customerId);
  return {
    async list(customerId) {
      return of(customerId).sort(newestFirst);
    },
    async add(recording) {
      rows.set(recording.id, recording);
      const dropped = beyondLimit(of(recording.customerId));
      dropped.forEach((id) => rows.delete(id));
      return dropped;
    },
    async setTranscript(id, transcript) {
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, transcript });
    },
    async removeCustomer(customerId) {
      of(customerId).forEach((row) => rows.delete(row.id));
    },
  };
}

const whenDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error("journal audio transaction failed"));
  });

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(AUDIO_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" }).createIndex(BY_CUSTOMER, BY_CUSTOMER);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function indexedDbAudioStore(factory: IDBFactory): JournalAudioStore {
  let db: Promise<IDBDatabase> | undefined;
  const connect = () => (db ??= open(factory));
  /** Every read and write of one call in one transaction, in callbacks only so it cannot commit early. */
  const run = async <T>(mode: IDBTransactionMode, body: (store: IDBObjectStore, set: (value: T) => void) => void): Promise<T> => {
    const tx = (await connect()).transaction(STORE, mode);
    let result!: T;
    body(tx.objectStore(STORE), (value) => (result = value));
    await whenDone(tx);
    return result;
  };
  const forCustomer = (store: IDBObjectStore, customerId: string, then: (rows: JournalRecording[]) => void) => {
    const request = store.index(BY_CUSTOMER).getAll(customerId);
    request.onsuccess = () => then(request.result as JournalRecording[]);
  };
  return {
    list: (customerId) => run<JournalRecording[]>("readonly", (store, set) => forCustomer(store, customerId, (rows) => set(rows.sort(newestFirst)))),
    add: (recording) =>
      run<string[]>("readwrite", (store, set) => {
        store.put(recording).onsuccess = () =>
          forCustomer(store, recording.customerId, (rows) => {
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
    removeCustomer: (customerId) =>
      run<void>("readwrite", (store) => forCustomer(store, customerId, (rows) => rows.forEach((row) => store.delete(row.id)))),
  };
}

let shared: JournalAudioStore | undefined;

/** The browser's store, or one in memory where IndexedDB is missing (private modes, tests). */
export function journalAudioStore(): JournalAudioStore {
  return (shared ??= typeof indexedDB === "undefined" ? memoryAudioStore() : indexedDbAudioStore(indexedDB));
}
