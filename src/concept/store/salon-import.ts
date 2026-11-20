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

/** Every key the old store used for salons. */
export const LEGACY_KEYS = [
  LEGACY_KEY,
  `${LEGACY_KEY}-demo`,
  `${LEGACY_KEY}-own`,
  `${LEGACY_KEY}-last-used`,
  `${LEGACY_KEY}-own-last-used`,
] as const;

const RECEIPT_CACHES = ["concept-booking-sequence", "concept-studio-store"];

function read(storage: LegacyStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/** A saved salon for this workspace: the old `load` accepted only an `industry` for the own salon and none for the demo. */
function salonText(raw: string | null, workspace: Workspace): string | null {
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

/** What the old store had saved, read with its own key rules (`initialize` and `storageKey` in store.ts). */
export function legacySnapshot(storage: LegacyStorage) {
  const base = read(storage, LEGACY_KEY);
  const primary: Workspace = salonText(base, "own") ? "own" : "demo";
  const keyOf = (workspace: Workspace) => (workspace === primary ? LEGACY_KEY : `${LEGACY_KEY}-${workspace}`);
  return {
    primary,
    demo: salonText(read(storage, keyOf("demo")), "demo"),
    own: salonText(read(storage, keyOf("own")), "own"),
    lastUsed: parseLastUse(read(storage, `${keyOf("own")}-last-used`)),
  };
}

export interface ImportOptions {
  /** Epoch milliseconds, recorded in the marker. */
  now: number;
  /** False in memory mode: the legacy text seeds this tab only and stays where it is. */
  removeLegacy: boolean;
  epoch?: () => string;
  /** Deletes the old Cache Storage receipts; defaults to `globalThis.caches`. */
  caches?: Pick<CacheStorage, "delete"> | null;
}

/**
 * Imports the legacy salons unless an import already happened, then removes
 * the legacy keys. Returns the marker in force and whether this call imported.
 * A salon already in the database is never overwritten.
 */
export async function importLegacy(db: SalonDb, storage: LegacyStorage | null, options: ImportOptions) {
  const legacy = storage ? legacySnapshot(storage) : { primary: "demo" as const, demo: null, own: null, lastUsed: null };
  const epoch = options.epoch ?? newEpoch;
  const result = await db.write({ salons: ["demo", "own"], meta: [IMPORT_MARKER, LAST_USED_OWN] }, (tx) => {
    const existing = tx.meta<ImportMarker>(IMPORT_MARKER);
    if (existing) return { marker: existing, imported: false };
    for (const workspace of ["demo", "own"] as const) {
      const doc = legacy[workspace];
      if (!doc || tx.salon(workspace)) continue;
      tx.putSalon(workspace, { version: 1, epoch: epoch(), doc });
      if (workspace === "own" && legacy.lastUsed !== null && tx.meta(LAST_USED_OWN) === undefined) tx.putMeta(LAST_USED_OWN, legacy.lastUsed);
    }
    const marker: ImportMarker = { at: options.now, primary: legacy.primary };
    tx.putMeta(IMPORT_MARKER, marker);
    return { marker, imported: true };
  });
  if (!result.ok) return result;
  if (options.removeLegacy && storage) {
    for (const key of LEGACY_KEYS) {
      try { storage.removeItem(key); } catch { /* Removed on the next open. */ }
    }
    const caches = options.caches === undefined ? (typeof globalThis.caches === "undefined" ? null : globalThis.caches) : options.caches;
    await Promise.all(RECEIPT_CACHES.map((name) => caches?.delete(name).catch(() => false)));
  }
  return result;
}
