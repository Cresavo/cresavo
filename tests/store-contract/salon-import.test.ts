import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, it, vi } from "vitest";
import { MemorySalonDb } from "@/concept/store/memory-salon-db";
import { createSalonDb, type SalonDbHandle } from "@/concept/store/salon-db";
import { IMPORT_MARKER, LAST_USED_OWN, LEGACY_KEY, browserLegacyStorage, importLegacy, legacySnapshot } from "@/concept/store/salon-import";

// One-time import of the old localStorage snapshots (BROWSER_STORE_IDB.md, Migration).
// Fictional salons only.

const demo = JSON.stringify({ salon: { name: "Salong Eko" }, seq: 7 });
const own = JSON.stringify({ salon: { name: "Studio Lind" }, industry: "hair", seq: 3 });
const NOW = Date.UTC(2026, 10, 20, 9);

function storage(entries: Record<string, string> = {}) {
  const items = new Map(Object.entries(entries));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    removeItem: (key: string) => { items.delete(key); },
  };
}

const handles: SalonDbHandle[] = [];
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.close());
  vi.unstubAllGlobals();
});
function open(factory = new IDBFactory()) {
  const handle = createSalonDb({ factory, channel: null });
  handles.push(handle);
  return handle;
}

let epochs = 0;
const options = { now: NOW, removeLegacy: true, caches: null, epoch: () => `epoch-${++epochs}` };
const markerOf = (db: SalonDbHandle | MemorySalonDb) => db.write({ meta: [IMPORT_MARKER, LAST_USED_OWN] }, (tx) => [tx.meta(IMPORT_MARKER), tx.meta(LAST_USED_OWN)]);

it("reads the old keys with the old rules", () => {
  const pick = (snapshot: ReturnType<typeof legacySnapshot>) => snapshot && { primary: snapshot.primary, demo: snapshot.demo?.key ?? null, own: snapshot.own?.key ?? null, lastUsed: snapshot.lastUsed };
  expect(pick(legacySnapshot(storage({ [LEGACY_KEY]: demo, [`${LEGACY_KEY}-own`]: own, [`${LEGACY_KEY}-own-last-used`]: "1000" }))))
    .toEqual({ primary: "demo", demo: LEGACY_KEY, own: `${LEGACY_KEY}-own`, lastUsed: 1000 });
  // Older versions kept the selected own salon at the unsuffixed key.
  expect(pick(legacySnapshot(storage({ [LEGACY_KEY]: own, [`${LEGACY_KEY}-demo`]: demo, [`${LEGACY_KEY}-last-used`]: "2000" }))))
    .toEqual({ primary: "own", demo: `${LEGACY_KEY}-demo`, own: LEGACY_KEY, lastUsed: 2000 });
  // Corrupt text and a salon of the wrong kind are not imported, as the old load refused them.
  expect(pick(legacySnapshot(storage({ [LEGACY_KEY]: "{not json", [`${LEGACY_KEY}-own`]: demo }))))
    .toEqual({ primary: "demo", demo: null, own: null, lastUsed: null });
});

it("imports once, writes the marker in the same transaction and removes the legacy keys", async () => {
  const db = open();
  const legacy = storage({ [LEGACY_KEY]: demo, [`${LEGACY_KEY}-own`]: own, [`${LEGACY_KEY}-own-last-used`]: "1000" });
  const deleted: string[] = [];
  const result = await importLegacy(db, legacy, { ...options, caches: { delete: async (name: string) => { deleted.push(name); return true; } } });
  expect(result.ok && result.value).toEqual({ marker: { at: NOW, primary: "demo" }, imported: true });
  const salons = await db.readAll();
  expect(salons.demo).toMatchObject({ version: 1, doc: demo });
  expect(salons.own).toMatchObject({ version: 1, doc: own });
  expect(salons.demo!.epoch).not.toBe(salons.own!.epoch);
  expect(await markerOf(db)).toMatchObject({ ok: true, value: [{ at: NOW, primary: "demo" }, 1000] });
  expect([...legacy.items.keys()]).toEqual([]);
  expect(deleted.sort()).toEqual(["concept-booking-sequence", "concept-studio-store"]);
});

it("keeps the primary workspace of a browser whose unsuffixed key held the trial salon", async () => {
  const db = open();
  const result = await importLegacy(db, storage({ [LEGACY_KEY]: own, [`${LEGACY_KEY}-demo`]: demo }), options);
  expect(result.ok && result.value.marker?.primary).toBe("own");
  expect((await db.read("own"))!.doc).toBe(own);
});

it("never resurrects a deleted trial salon from a reappearing legacy key", async () => {
  const factory = new IDBFactory();
  const db = open(factory);
  await importLegacy(db, storage({ [`${LEGACY_KEY}-own`]: own }), options);
  await db.write({}, (tx) => tx.deleteSalon("own"));
  // An old tab or a test's init script writes the legacy key again.
  const again = storage({ [`${LEGACY_KEY}-own`]: own, [LEGACY_KEY]: demo });
  const result = await importLegacy(open(factory), again, { ...options, now: NOW + 1 });
  expect(result.ok && result.value).toEqual({ marker: { at: NOW, primary: "demo" }, imported: false });
  expect(await db.readAll()).toEqual({ demo: null, own: null });
  expect([...again.items.keys()]).toEqual([]);
});

it("imports exactly once when two tabs race", async () => {
  const factory = new IDBFactory();
  const results = await Promise.all([
    importLegacy(open(factory), storage({ [LEGACY_KEY]: demo }), options),
    importLegacy(open(factory), storage({ [LEGACY_KEY]: demo }), options),
  ]);
  expect(results.map((result) => result.ok && result.value.imported).sort()).toEqual([false, true]);
  expect((await open(factory).read("demo"))!.version).toBe(1);
});

it("never overwrites a salon already in the database", async () => {
  const db = open();
  await db.write({}, (tx) => tx.putSalon("demo", { version: 9, epoch: "current", doc: demo }));
  await importLegacy(db, storage({ [LEGACY_KEY]: JSON.stringify({ salon: { name: "Older copy" } }) }), options);
  expect(await db.read("demo")).toEqual({ version: 9, epoch: "current", doc: demo });
});

it("writes a marker even with nothing to import", async () => {
  const db = open();
  const result = await importLegacy(db, storage(), options);
  expect(result.ok && result.value.imported).toBe(true);
  expect(await db.readAll()).toEqual({ demo: null, own: null });
  const later = await importLegacy(db, storage({ [LEGACY_KEY]: demo }), options);
  expect(later.ok && later.value.imported).toBe(false);
});

it("seeds memory mode without touching the legacy keys", async () => {
  const db = new MemorySalonDb();
  const legacy = storage({ [LEGACY_KEY]: demo });
  await importLegacy(db, legacy, { ...options, removeLegacy: false });
  expect((await db.read("demo"))!.doc).toBe(demo);
  expect(legacy.items.get(LEGACY_KEY)).toBe(demo);
});

function unreadable(entries: Record<string, string>, failing: string) {
  const legacy = storage(entries);
  const removed: string[] = [];
  return {
    items: legacy.items,
    removed,
    getItem: (key: string) => { if (key === failing) throw new DOMException("denied", "SecurityError"); return legacy.getItem(key); },
    removeItem: (key: string) => { removed.push(key); legacy.removeItem(key); },
  };
}

it("leaves no marker and removes nothing when legacy storage cannot be read, so the next open retries", async () => {
  const db = open();
  const failing = unreadable({ [LEGACY_KEY]: demo, [`${LEGACY_KEY}-own`]: own }, `${LEGACY_KEY}-own`);
  const result = await importLegacy(db, failing, options);
  expect(result.ok && result.value).toEqual({ marker: null, imported: false });
  expect(await db.readAll()).toEqual({ demo: null, own: null });
  expect(await markerOf(db)).toEqual({ ok: true, value: [undefined, undefined], changes: [] });
  expect(failing.removed).toEqual([]);
  // Readable again: everything is imported.
  const retried = await importLegacy(db, storage(Object.fromEntries(failing.items)), options);
  expect(retried.ok && retried.value.imported).toBe(true);
  expect((await db.read("own"))!.doc).toBe(own);
});

it("keeps the marker and skips cleanup when storage is unreadable after an import", async () => {
  const db = open();
  await importLegacy(db, storage({ [LEGACY_KEY]: demo }), options);
  const failing = unreadable({ [LEGACY_KEY]: demo }, LEGACY_KEY);
  const result = await importLegacy(db, failing, options);
  expect(result.ok && result.value).toEqual({ marker: { at: NOW, primary: "demo" }, imported: false });
  expect(failing.removed).toEqual([]);
});

it("imports a demo left under its suffixed key after the primary trial salon was removed", async () => {
  const db = open();
  const legacy = storage({ [`${LEGACY_KEY}-demo`]: demo });
  const result = await importLegacy(db, legacy, options);
  expect(result.ok && result.value.imported).toBe(true);
  expect((await db.read("demo"))!.doc).toBe(demo);
  expect([...legacy.items.keys()]).toEqual([]);
});

it("prefers the key the old store read and removes a stale copy only once the workspace is covered", async () => {
  const db = open();
  const stale = JSON.stringify({ salon: { name: "Older demo" } });
  const legacy = storage({ [LEGACY_KEY]: demo, [`${LEGACY_KEY}-demo`]: stale });
  await importLegacy(db, legacy, options);
  expect((await db.read("demo"))!.doc).toBe(demo);
  expect([...legacy.items.keys()]).toEqual([]);
});

it("treats missing or throwing localStorage as unreadable, never as an empty store", async () => {
  const db = open();
  expect(await importLegacy(db, null, options)).toMatchObject({ ok: true, value: { marker: null, imported: false } });
  // The default acquisition is guarded: a getter that throws (blocked site data) is unavailable too.
  vi.stubGlobal("localStorage", undefined);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => { throw new DOMException("denied", "SecurityError"); } });
  expect(browserLegacyStorage()).toBeNull();
  expect(await importLegacy(db, undefined, options)).toMatchObject({ ok: true, value: { marker: null, imported: false } });
  expect(await markerOf(db)).toEqual({ ok: true, value: [undefined, undefined], changes: [] });
  // Storage comes back: the salons are imported then.
  const legacy = storage({ [LEGACY_KEY]: demo, [`${LEGACY_KEY}-own`]: own });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get: () => legacy });
  const retried = await importLegacy(db, undefined, options);
  expect(retried.ok && retried.value.imported).toBe(true);
  expect((await db.read("own"))!.doc).toBe(own);
  expect([...legacy.items.keys()]).toEqual([]);
});

it("keeps a committed import when Cache Storage cannot even be reached", async () => {
  const db = open();
  vi.stubGlobal("caches", undefined);
  Object.defineProperty(globalThis, "caches", { configurable: true, get: () => { throw new DOMException("denied", "SecurityError"); } });
  const legacy = storage({ [LEGACY_KEY]: demo });
  const result = await importLegacy(db, legacy, { ...options, caches: undefined });
  expect(result.ok && result.value.imported).toBe(true);
  expect([...legacy.items.keys()]).toEqual([]);
  // A delete that throws synchronously or rejects is ignored as well.
  const failing = { delete: (name: string) => { if (name.includes("booking")) throw new Error("denied"); return Promise.reject(new Error("denied")); } };
  const other = open();
  const again = await importLegacy(other, storage({ [LEGACY_KEY]: demo }), { ...options, caches: failing as unknown as Pick<CacheStorage, "delete"> });
  expect(again.ok && again.value.imported).toBe(true);
});
