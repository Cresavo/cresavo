import { parseLastUse } from "../onboarding/trial";
import { newEpoch, type SalonDb, type Workspace } from "./salon-tx";

// One-time import of the localStorage snapshots the browser store wrote before
// IndexedDB (docs/design/BROWSER_STORE_IDB.md, Migration). The import marker is
// written in the same transaction as the salons, so a legacy key that
// reappears later (an old tab, a test's init script) never brings back a salon
// that was deleted since.

export const LEGACY_KEY = "salong-eko-demo";
export const IMPORT_MARKER = "imported";
export const LAST_USED_OWN = "lastUsed:own";

export interface ImportMarker {
  /** Epoch milliseconds of the import. */
  at: number;
  /** The workspace a tab opens without a selection of its own: `initialize()`'s rule from before the import. */
  primary: Workspace;
}

export interface LegacyStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

const RECEIPT_CACHES = ["concept-booking-sequence", "concept-studio-store"];

/** The page's localStorage, or null when it is missing or its getter throws (blocked site data, sandboxed frames). */
export function browserLegacyStorage(): LegacyStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Cache Storage, or null: in a denying context even reading `caches` throws. */
function browserCaches(): Pick<CacheStorage, "delete"> | null {
  try {
    return globalThis.caches ?? null;
  } catch {
    return null;
  }
}

/** Optional receipt cleanup: a failure here never turns a committed import into an error. */
async function deleteReceipts(caches: Pick<CacheStorage, "delete"> | null) {
  await Promise.all(RECEIPT_CACHES.map(async (name) => {
    try {
      await caches?.delete(name);
    } catch {
      // The old receipts hold no booking details; they can stay.
    }
  }));
}

/** Every key the old store used for salons. */
export const LEGACY_KEYS = [
  LEGACY_KEY,
  `${LEGACY_KEY}-demo`,
  `${LEGACY_KEY}-own`,
  `${LEGACY_KEY}-last-used`,
  `${LEGACY_KEY}-own-last-used`,
] as const;

/** Every legacy key's text, or null when storage could not be read: unreadable is not the same as absent. */
function readKeys(storage: LegacyStorage): Map<string, string | null> | null {
  const values = new Map<string, string | null>();
  try {
    for (const key of LEGACY_KEYS) values.set(key, storage.getItem(key));
  } catch {
    return null;
  }
  return values;
}

/** A saved salon for this workspace: the old `load` accepted only an `industry` for the own salon and none for the demo. */
function salonText(raw: string | null | undefined, workspace: Workspace): string | null {
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
    return Boolean((saved as { industry?: unknown }).industry) === (workspace === "own") ? raw : null;
  } catch {
    // A corrupt snapshot was replaced by fresh demo data; nothing to keep.
    return null;
  }
}

export interface LegacySalon { key: string; text: string }

/**
 * What the old store had saved, or null when storage could not be read.
 * `primary` follows `initialize()` in store.ts. Each workspace is taken from
 * the unsuffixed key when it holds that kind of salon, otherwise from its
 * suffixed key: a demo saved under `-demo` while the trial was primary
 * survives that trial's removal.
 */
export function legacySnapshot(storage: LegacyStorage) {
  const values = readKeys(storage);
  if (!values) return null;
  const pick = (workspace: Workspace): LegacySalon | null => {
    for (const key of [LEGACY_KEY, `${LEGACY_KEY}-${workspace}`]) {
      const text = salonText(values.get(key), workspace);
      if (text) return { key, text };
    }
    return null;
  };
  const own = pick("own");
  const primary: Workspace = own?.key === LEGACY_KEY ? "own" : "demo";
  return {
    primary,
    demo: pick("demo"),
    own,
    lastUsed: own ? parseLastUse(values.get(`${own.key}-last-used`) ?? null) : null,
    /** Keys that hold something, with their text, for the cleanup. */
    present: [...values].filter((entry): entry is [string, string] => entry[1] !== null),
  };
}

/** A legacy salon key's workspace, or null for a last-used key. */
const workspaceOfKey = (key: string): Workspace | "either" | null =>
  key.endsWith("-last-used") ? null : key === LEGACY_KEY ? "either" : key.endsWith("-own") ? "own" : "demo";

/**
 * Whether the cleanup may remove a key: only when its salon is now in the
 * database (imported or already there) or it held nothing the old store would
 * have opened. A last-used key goes with the trial salon.
 */
function obsolete(key: string, text: string, covered: ReadonlySet<Workspace>): boolean {
  const workspace = workspaceOfKey(key);
  if (workspace === null) return covered.has("own");
  const kinds: Workspace[] = workspace === "either" ? ["demo", "own"] : [workspace];
  return kinds.every((kind) => !salonText(text, kind) || covered.has(kind));
}

export interface ImportOptions {
  /** Epoch milliseconds, recorded in the marker. */
  now: number;
  /** False in memory mode: the legacy text seeds this tab only and stays where it is. */
  removeLegacy: boolean;
  epoch?: () => string;
  /** Deletes the old Cache Storage receipts; defaults to `globalThis.caches`, read guarded. */
  caches?: Pick<CacheStorage, "delete"> | null;
}

/**
 * Imports the legacy salons unless an import already happened, then removes
 * the legacy keys the database now covers. Returns the marker in force (null
 * when legacy storage could not be read, so the next open retries) and whether
 * this call imported. A salon already in the database is never overwritten.
 * `storage` defaults to `browserLegacyStorage()`; null means unavailable,
 * which is treated like a failed read, never like an empty store.
 */
export async function importLegacy(db: SalonDb, storage: LegacyStorage | null = browserLegacyStorage(), options: ImportOptions) {
  const legacy = storage ? legacySnapshot(storage) : null;
  const epoch = options.epoch ?? newEpoch;
  const result = await db.write({ salons: ["demo", "own"], meta: [IMPORT_MARKER, LAST_USED_OWN] }, (tx) => {
    const existing = tx.meta<ImportMarker>(IMPORT_MARKER);
    if (existing) return { marker: existing, imported: false, covered: null };
    // Unreadable storage: no marker and no cleanup, so the next open tries again.
    if (!legacy) return { marker: null, imported: false, covered: null };
    const covered = new Set<Workspace>();
    for (const workspace of ["demo", "own"] as const) {
      const salon = legacy[workspace];
      if (tx.salon(workspace)) covered.add(workspace);
      else if (salon) {
        tx.putSalon(workspace, { version: 1, epoch: epoch(), doc: salon.text });
        covered.add(workspace);
        if (workspace === "own" && legacy.lastUsed !== null && tx.meta(LAST_USED_OWN) === undefined) tx.putMeta(LAST_USED_OWN, legacy.lastUsed);
      }
    }
    const marker: ImportMarker = { at: options.now, primary: legacy.primary };
    tx.putMeta(IMPORT_MARKER, marker);
    return { marker, imported: true, covered };
  });
  if (!result.ok) return result;
  const { marker, imported, covered } = result.value;
  if (options.removeLegacy && storage && legacy && marker) {
    // After an earlier import every legacy key is obsolete; after this one only what the database now covers.
    for (const [key, text] of legacy.present) {
      if (covered && !obsolete(key, text, covered)) continue;
      try { storage.removeItem(key); } catch { /* Removed on the next open. */ }
    }
    await deleteReceipts(options.caches === undefined ? browserCaches() : options.caches);
  }
  return { ...result, value: { marker, imported } };
}
