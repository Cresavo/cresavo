import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemorySalonDb } from "@/concept/store/memory-salon-db";
import {
  createSalonDb,
  SalonDbClosedError,
  runChange,
  runTransaction,
  SynchronousChangeError,
  type ChannelLike,
  type SalonChange,
  type SalonDb,
  type SalonDbHandle,
  type SalonRecord,
  type Workspace,
} from "@/concept/store/salon-db";

// The storage core of docs/design/BROWSER_STORE_IDB.md on fake-indexeddb.
// Each handle is its own connection, as each tab would be; handles that share
// a factory share one database. Documents are small fictional JSON texts.

const handles: SalonDbHandle[] = [];
afterEach(() => {
  handles.splice(0).forEach((handle) => handle.close());
  vi.restoreAllMocks();
});

/** BroadcastChannel as tabs share it: delivered later, to every other member. */
function channelBus() {
  const members = new Set<ChannelLike>();
  return (): ChannelLike => {
    const channel: ChannelLike = {
      onmessage: null,
      postMessage(message) {
        for (const other of members) if (other !== channel) setTimeout(() => other.onmessage?.({ data: structuredClone(message) }));
      },
      close() { members.delete(channel); },
    };
    members.add(channel);
    return channel;
  };
}

function open(factory: IDBFactory, options: Parameters<typeof createSalonDb>[0] = {}) {
  const handle = createSalonDb({ factory, channel: null, ...options });
  handles.push(handle);
  return handle;
}

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean, ms = 1000) {
  for (let waited = 0; !check(); waited += 5) {
    if (waited > ms) throw new Error("timed out");
    await sleep(5);
  }
}

const record = (count: number, version = 1, epoch = "e1"): SalonRecord => ({ version, epoch, doc: JSON.stringify({ salon: "Salong Eko", count }) });
const countOf = (salon: SalonRecord | null) => (salon ? (JSON.parse(salon.doc) as { count: number }).count : null);

/** A read-modify-write in one transaction: the pattern every commit uses. */
const increment = (db: SalonDb, workspace: Workspace = "demo") => db.write({ salons: [workspace] }, (tx) => {
  const current = tx.salon(workspace);
  const next = current ? { ...current, version: current.version + 1, doc: JSON.stringify({ salon: "Salong Eko", count: countOf(current)! + 1 }) } : record(1);
  tx.putSalon(workspace, next);
  return next.version;
});

const adapters: Array<[string, () => SalonDb]> = [
  ["IndexedDB", () => open(new IDBFactory())],
  ["memory", () => new MemorySalonDb()],
];

describe.each(adapters)("%s adapter", (_name, make) => {
  it("round-trips salons and meta, with detached copies", async () => {
    const db = make();
    expect(await db.read("demo")).toBeNull();
    const result = await db.write({}, (tx) => { tx.putSalon("demo", record(3)); tx.putMeta("lastUsed:own", 42); return "done"; });
    expect(result).toEqual({ ok: true, value: "done", changes: [{ workspace: "demo", record: record(3) }] });
    const read = (await db.read("demo"))!;
    read.doc = "changed";
    expect(await db.readAll()).toEqual({ demo: record(3), own: null });
    const meta = await db.write({ meta: ["lastUsed:own"] }, (tx) => tx.meta<number>("lastUsed:own"));
    expect(meta.ok && meta.value).toBe(42);
  });

  it("aborts on a throw and writes nothing staged before it", async () => {
    const db = make();
    await db.write({}, (tx) => tx.putSalon("demo", record(1)));
    await expect(db.write({ salons: ["demo"] }, (tx) => {
      tx.putSalon("demo", record(99, 2));
      tx.deleteSalon("own");
      throw new Error("refused by the reducer");
    })).rejects.toThrow("refused by the reducer");
    expect(await db.read("demo")).toEqual(record(1));
  });

  it("refuses a change that is not synchronous and writes nothing", async () => {
    const db = make();
    const asyncChange = async (tx: Parameters<Parameters<SalonDb["write"]>[1]>[0]) => { tx.putSalon("demo", record(1)); };
    await expect(db.write({}, asyncChange)).rejects.toBeInstanceOf(SynchronousChangeError);
    await expect(db.write({}, (tx) => { tx.putSalon("demo", record(1)); return Promise.resolve(); })).rejects.toBeInstanceOf(SynchronousChangeError);
    expect(await db.read("demo")).toBeNull();
  });

  it("leaves no unhandled rejection behind a refused async change", async () => {
    const db = make();
    const unhandled: unknown[] = [];
    const record = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", record);
    try {
      await expect(db.write({}, async () => { throw new Error("async change failed"); })).rejects.toBeInstanceOf(SynchronousChangeError);
      await sleep(20);
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", record);
    }
  });

  it("reads only what the scope names", async () => {
    const db = make();
    await db.write({}, (tx) => tx.putSalon("own", record(1)));
    await expect(db.write({ exists: ["own"] }, (tx) => tx.salon("own"))).rejects.toThrow(RangeError);
    await expect(db.write({ salons: ["demo"] }, (tx) => tx.meta("lastUsed:own"))).rejects.toThrow(RangeError);
    // `exists` answers without the document: how marking the trial used stays small.
    const marked = await db.write({ exists: ["own", "demo"], meta: ["lastUsed:own"] }, (tx) => {
      if (tx.has("own")) tx.putMeta("lastUsed:own", 1000);
      return [tx.has("own"), tx.has("demo")];
    });
    expect(marked).toEqual({ ok: true, value: [true, false], changes: [] });
  });

  it("refuses an invalid record", async () => {
    const db = make();
    await expect(db.write({}, (tx) => tx.putSalon("demo", { version: 0, epoch: "", doc: "{}" }))).rejects.toThrow(TypeError);
  });

  it("serializes concurrent read-modify-writes: none is lost", async () => {
    const db = make();
    const versions = await Promise.all(Array.from({ length: 20 }, () => increment(db)));
    expect(versions.map((result) => result.ok && result.value).sort((a, b) => Number(a) - Number(b))).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(countOf(await db.read("demo"))).toBe(20);
  });

  it("settles a committed write even when a subscriber throws, and reports the error", async () => {
    const db = make();
    const errors: unknown[] = [];
    db.onListenerError((error) => errors.push(error));
    const seen: SalonChange[] = [];
    db.subscribe(() => { throw new Error("broken subscriber"); });
    db.subscribe((change) => seen.push(change));
    const result = await db.write({}, (tx) => tx.putSalon("demo", record(1)));
    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(errors).toEqual([new Error("broken subscriber")]);
    expect(await db.read("demo")).toEqual(record(1));
  });

  it("returns a snapshot of both salons that existed together", async () => {
    const db = make();
    await db.write({}, (tx) => { tx.putSalon("demo", record(1)); tx.putSalon("own", record(1)); });
    const before = db.readAll();
    const replaced = db.write({ salons: ["demo", "own"] }, (tx) => { tx.putSalon("demo", record(2, 2)); tx.putSalon("own", record(2, 2)); });
    const [snapshot] = await Promise.all([before, replaced]);
    expect([countOf(snapshot.demo), countOf(snapshot.own)]).toEqual([1, 1]);
    expect(await db.readAll()).toEqual({ demo: record(2, 2), own: record(2, 2) });
  });

  it("tells subscribers about its own commits, deletions included", async () => {
    const db = make();
    const seen: SalonChange[] = [];
    const stop = db.subscribe((change) => seen.push(change));
    await db.write({}, (tx) => tx.putSalon("own", record(1)));
    await db.write({}, (tx) => tx.deleteSalon("own"));
    await db.write({}, (tx) => tx.putMeta("lastUsed:own", 5));
    stop();
    await db.write({}, (tx) => tx.putSalon("demo", record(1)));
    expect(seen).toEqual([{ workspace: "own", record: record(1) }, { workspace: "own", record: null }]);
  });
});

describe("IndexedDB transactions", () => {
  it("never awaits inside a transaction", () => {
    // An await on anything but an IDB request lets the transaction commit before its writes.
    for (const fn of [runTransaction, runChange]) {
      const source = fn.toString();
      expect(source).not.toMatch(/\bawait\b|\basync\b|\.then\(|setTimeout|queueMicrotask/);
    }
  });

  it("models auto-commit, which is why the guard matters", async () => {
    const factory = new IDBFactory();
    await open(factory).ready();
    const raw = await new Promise<IDBDatabase>((resolve) => { const request = factory.open("concept-store", 1); request.onsuccess = () => resolve(request.result); });
    const tx = raw.transaction("salons", "readwrite");
    await sleep(10);
    expect(() => tx.objectStore("salons").put(record(1), "demo")).toThrow(/inactive|TransactionInactive/i);
    raw.close();
  });

  it("keeps read-modify-writes atomic across two connections (two tabs)", async () => {
    const factory = new IDBFactory();
    const [tabA, tabB] = [open(factory), open(factory)];
    await Promise.all([tabA.ready(), tabB.ready()]);
    await Promise.all(Array.from({ length: 30 }, (_, i) => increment(i % 2 ? tabA : tabB)));
    expect(countOf(await tabA.read("demo"))).toBe(30);
    expect((await tabB.read("demo"))!.version).toBe(30);
  });

  it("loses updates without the single transaction (the bug this replaces)", async () => {
    const factory = new IDBFactory();
    const [tabA, tabB] = [open(factory), open(factory)];
    await tabA.write({}, (tx) => tx.putSalon("demo", record(0)));
    const naive = async (db: SalonDb) => {
      const seen = (await db.read("demo"))!;
      await sleep(1);
      await db.write({}, (tx) => tx.putSalon("demo", { ...seen, version: seen.version + 1, doc: JSON.stringify({ count: countOf(seen)! + 1 }) }));
    };
    await Promise.all([naive(tabA), naive(tabB)]);
    expect(countOf(await tabA.read("demo"))).toBe(1);
  });

  it("aborts on a quota error, reports it to failure listeners and writes nothing", async () => {
    const db = open(new IDBFactory());
    await db.write({}, (tx) => tx.putSalon("demo", record(1)));
    const failures: Array<string | undefined> = [];
    db.onStorageFailure((error) => failures.push(error));
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    const result = await db.write({ salons: ["demo"] }, (tx) => { tx.putSalon("demo", record(2, 2)); tx.putMeta("lastUsed:own", 1); });
    expect(result).toEqual({ ok: false, reason: "storage", error: "QuotaExceededError" });
    expect(failures).toEqual(["QuotaExceededError"]);
    vi.restoreAllMocks();
    expect(await db.read("demo")).toEqual(record(1));
  });
});

describe("epochs and normalization", () => {
  // The commit layer (a later PR) works this way: a command carries the epoch it
  // was rendered from, normalization runs first and persists even when the
  // command is refused, and a refusal writes no action changes.
  const DAY = "2026-11-20";
  const salon = (day: string, epoch: string, version: number, bookings: string[] = []): SalonRecord => ({ version, epoch, doc: JSON.stringify({ day, bookings }) });
  const docOf = (value: SalonRecord) => JSON.parse(value.doc) as { day: string; bookings: string[] };

  function commit(db: SalonDb, target: { epoch: string }, booking: string, today: string, nextEpoch: string) {
    return db.write({ salons: ["demo"] }, (tx) => {
      let current = tx.salon("demo")!;
      let normalized = false;
      if (docOf(current).day !== today) {
        current = salon(today, nextEpoch, current.version + 1);
        normalized = true;
      }
      const write = (record: SalonRecord) => tx.putSalon("demo", record);
      if (current.epoch !== target.epoch) {
        if (normalized) write(current);
        return "replaced" as const;
      }
      if (docOf(current).bookings.includes(booking)) {
        if (normalized) write(current);
        return "rejected" as const;
      }
      write({ ...current, version: current.version + (normalized ? 0 : 1), doc: JSON.stringify({ ...docOf(current), bookings: [...docOf(current).bookings, booking] }) });
      return "ok" as const;
    });
  }

  it("refuses a command for a replaced salon but persists the new day once", async () => {
    const factory = new IDBFactory();
    const [tabA, tabB] = [open(factory), open(factory)];
    await tabA.write({}, (tx) => tx.putSalon("demo", salon("2026-11-19", "yesterday", 4, ["b-1"])));
    // Two tabs click after midnight on yesterday's salon: the first regenerates, neither lands.
    const results = await Promise.all([commit(tabA, { epoch: "yesterday" }, "b-2", DAY, "today-a"), commit(tabB, { epoch: "yesterday" }, "b-2", DAY, "today-b")]);
    expect(results.map((result) => result.ok && result.value)).toEqual(["replaced", "replaced"]);
    const stored = (await tabB.read("demo"))!;
    expect(stored).toEqual(salon(DAY, "today-a", 5));
    // A command rendered from the new salon lands; a retry is refused without another regeneration.
    expect((await commit(tabB, { epoch: "today-a" }, "b-2", DAY, "unused")).ok).toBe(true);
    const retried = await commit(tabA, { epoch: "today-a" }, "b-2", DAY, "unused");
    expect(retried.ok && retried.value).toBe("rejected");
    expect(retried.ok && retried.changes).toEqual([]);
    expect(await tabA.read("demo")).toEqual(salon(DAY, "today-a", 6, ["b-2"]));
  });

  it("persists normalization when the action itself is refused", async () => {
    const db = open(new IDBFactory());
    await db.write({}, (tx) => tx.putSalon("demo", salon("2026-11-19", "today", 2, ["b-1"])));
    // Same epoch (an erasure or expired hold rather than a new salon), refused action.
    const result = await db.write({ salons: ["demo"] }, (tx) => {
      const current = tx.salon("demo")!;
      tx.putSalon("demo", { ...current, version: current.version + 1, doc: JSON.stringify({ ...docOf(current), bookings: [] }) });
      return "rejected";
    });
    expect(result.ok && result.value).toBe("rejected");
    expect(docOf((await db.read("demo"))!).bookings).toEqual([]);
  });
});

describe("opening", () => {
  it("uses memory only when IndexedDB is confirmed unavailable", async () => {
    const missing = createSalonDb({ factory: null, channel: null });
    expect(await missing.ready()).toBe("memory");
    expect(missing.status()).toBe("memory");
    await increment(missing);
    expect(countOf(await missing.read("demo"))).toBe(1);

    const throwing = createSalonDb({ factory: { open: () => { throw new DOMException("denied", "SecurityError"); } } as unknown as IDBFactory, channel: null });
    expect(await throwing.ready()).toBe("memory");

    const request = {} as IDBOpenDBRequest;
    const denying = createSalonDb({ factory: { open: () => request } as unknown as IDBFactory, channel: null });
    const ready = denying.ready();
    await sleep();
    request.onerror!({ preventDefault() {} } as unknown as Event);
    expect(await ready).toBe("memory");
  });

  it("keeps waiting on a slow open instead of falling back", async () => {
    const slow = createSalonDb({ factory: { open: () => ({}) } as unknown as IDBFactory, channel: null });
    let settled = false;
    void slow.write({}, (tx) => tx.putSalon("demo", record(1))).then(() => { settled = true; });
    await sleep(50);
    expect(slow.status()).toBe("opening");
    expect(settled).toBe(false);
  });

  it("reports blocked while an older connection stays open, then opens", async () => {
    const factory = new IDBFactory();
    const old = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open("concept-store", 1);
      request.onupgradeneeded = () => { request.result.createObjectStore("salons"); request.result.createObjectStore("meta"); };
      request.onsuccess = () => resolve(request.result);
    });
    const statuses: string[] = [];
    const newer = open(factory, { version: 2 });
    newer.onStatus((status) => statuses.push(status));
    const ready = newer.ready();
    await until(() => newer.status() === "blocked");
    old.close();
    expect(await ready).toBe("indexeddb");
    expect(statuses).toEqual(["blocked", "open"]);
  });

  it("closes on versionchange and refuses writes as outdated", async () => {
    const factory = new IDBFactory();
    const current = open(factory);
    await current.write({}, (tx) => tx.putSalon("demo", record(1)));
    const upgraded = open(factory, { version: 2 });
    expect(await upgraded.ready()).toBe("indexeddb");
    expect(current.status()).toBe("outdated");
    expect(await current.write({}, (tx) => tx.putSalon("demo", record(2)))).toEqual({ ok: false, reason: "outdated" });
    await expect(current.read("demo")).rejects.toThrow(/newer version/);
    expect(await upgraded.read("demo")).toEqual(record(1));
  });

  it("closes a connection that arrives after the handle was closed", async () => {
    const factory = new IDBFactory();
    const early = open(factory);
    const pending = early.ready();
    early.close();
    await expect(pending).rejects.toBeInstanceOf(SalonDbClosedError);
    await sleep(20);
    expect(early.status()).not.toBe("open");
    // Not blocked: the late connection was closed at once.
    const upgraded = open(factory, { version: 2 });
    const statuses: string[] = [];
    upgraded.onStatus((status) => statuses.push(status));
    expect(await upgraded.ready()).toBe("indexeddb");
    expect(statuses).not.toContain("blocked");
  });

  it("reopens and re-reads both salons, deletions included", async () => {
    const factory = new IDBFactory();
    const [tabA, tabB] = [open(factory), open(factory)];
    await tabA.write({}, (tx) => { tx.putSalon("demo", record(1)); tx.putSalon("own", record(1)); });
    await tabB.write({}, (tx) => tx.deleteSalon("own"));
    tabA.reopen();
    expect(await tabA.readAll()).toEqual({ demo: record(1), own: null });
    expect(tabA.status()).toBe("open");
  });
});

describe("opening after the first session", () => {
  /** A factory that delegates to fake-indexeddb until told to fail. */
  function flaky(factory: IDBFactory) {
    const control = { fail: false };
    const wrapped = { open: (name: string, version?: number) => {
      if (control.fail) throw new DOMException("gone", "UnknownError");
      return factory.open(name, version);
    } } as unknown as IDBFactory;
    return { control, wrapped };
  }

  it("treats a newer schema on open as outdated, never as memory", async () => {
    const factory = new IDBFactory();
    const upgraded = open(factory, { version: 2 });
    await upgraded.write({}, (tx) => tx.putSalon("demo", record(4)));
    upgraded.close();
    const older = open(factory);
    await expect(older.ready()).rejects.toThrow(/newer version/);
    expect(older.status()).toBe("outdated");
    expect(await older.write({}, (tx) => tx.putSalon("demo", record(1)))).toEqual({ ok: false, reason: "outdated" });
    await expect(older.read("demo")).rejects.toThrow(/newer version/);
    expect(await open(factory, { version: 2 }).read("demo")).toEqual(record(4));
  });

  it("reports a failed reopen instead of switching a persistent session to memory", async () => {
    const factory = new IDBFactory();
    const { control, wrapped } = flaky(factory);
    const db = open(wrapped);
    await db.write({}, (tx) => tx.putSalon("demo", record(1)));
    const failures: Array<string | undefined> = [];
    db.onStorageFailure((error) => failures.push(error));
    control.fail = true;
    db.reopen();
    expect(await db.write({}, (tx) => tx.putSalon("demo", record(2, 2)))).toEqual({ ok: false, reason: "storage", error: "UnknownError" });
    expect(db.status()).toBe("failed");
    expect(failures).toEqual(["UnknownError"]);
    await expect(db.read("demo")).rejects.toThrow(/could not be opened again/);
    // Once the browser lets it open again, the saved salon is still there.
    control.fail = false;
    db.reopen();
    expect(await db.read("demo")).toEqual(record(1));
    expect(db.status()).toBe("open");
  });

  it("settles operations waiting on an open when the handle closes, and fails fast afterwards", async () => {
    const factory = new IDBFactory();
    const old = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open("concept-store", 1);
      request.onupgradeneeded = () => { request.result.createObjectStore("salons"); request.result.createObjectStore("meta"); };
      request.onsuccess = () => resolve(request.result);
    });
    const db = createSalonDb({ factory, channel: null, version: 2 });
    const waiting = [db.ready(), db.read("demo"), db.write({}, (tx) => tx.putSalon("demo", record(1)))];
    await until(() => db.status() === "blocked");
    db.close();
    for (const operation of waiting) await expect(operation).rejects.toBeInstanceOf(SalonDbClosedError);
    old.close();
    await sleep(20);
    expect(db.status()).toBe("closed");
    await expect(db.readAll()).rejects.toBeInstanceOf(SalonDbClosedError);
    await expect(db.write({}, (tx) => tx.putSalon("demo", record(1)))).rejects.toBeInstanceOf(SalonDbClosedError);
    // The late connection was closed, so a newer schema opens without being blocked.
    const next = open(factory, { version: 3 });
    const statuses: string[] = [];
    next.onStatus((status) => statuses.push(status));
    expect(await next.ready()).toBe("indexeddb");
    expect(statuses).not.toContain("blocked");
    expect(await next.read("demo")).toBeNull();
  });

  it("releases the connection when an open-status listener closes the handle", async () => {
    const factory = new IDBFactory();
    const connections: IDBOpenDBRequest[] = [];
    const watched = { open: (name: string, version?: number) => { const request = factory.open(name, version); connections.push(request); return request; } } as unknown as IDBFactory;
    const db = createSalonDb({ factory: watched, channel: null });
    db.onStatus((status) => { if (status === "open") db.close(); });
    await db.ready().catch(() => undefined);
    await sleep(20);
    expect(db.status()).toBe("closed");
    // fake-indexeddb's close-pending flag: set by close(), never by anything else.
    expect(connections.map((request) => (request.result as unknown as { _closePending: boolean })._closePending)).toEqual([true]);
  });

  it("joins a pending open on reopen, so closing settles every waiting operation", async () => {
    const factory = new IDBFactory();
    const old = await new Promise<IDBDatabase>((resolve) => {
      const request = factory.open("concept-store", 1);
      request.onupgradeneeded = () => { request.result.createObjectStore("salons"); request.result.createObjectStore("meta"); };
      request.onsuccess = () => resolve(request.result);
    });
    const db = createSalonDb({ factory, channel: null, version: 2 });
    const first = db.ready();
    await until(() => db.status() === "blocked");
    db.reopen();
    const second = db.ready();
    db.close();
    await expect(first).rejects.toBeInstanceOf(SalonDbClosedError);
    await expect(second).rejects.toBeInstanceOf(SalonDbClosedError);
    old.close();
  });
});

describe("cross-tab notification", () => {
  it("still broadcasts and settles when a local subscriber throws", async () => {
    const factory = new IDBFactory();
    const channel = channelBus();
    const [tabA, tabB] = [open(factory, { channel }), open(factory, { channel })];
    await Promise.all([tabA.ready(), tabB.ready()]);
    tabA.onListenerError(() => undefined);
    tabA.subscribe(() => { throw new Error("broken subscriber"); });
    const seen: SalonChange[] = [];
    tabB.subscribe((change) => seen.push(change));
    expect((await tabA.write({}, (tx) => tx.putSalon("demo", record(1)))).ok).toBe(true);
    await until(() => seen.length === 1);
  });

  it("tells other tabs to re-read, deletions included", async () => {
    const factory = new IDBFactory();
    const channel = channelBus();
    const [tabA, tabB] = [open(factory, { channel }), open(factory, { channel })];
    await Promise.all([tabA.ready(), tabB.ready()]);
    const seen: SalonChange[] = [];
    tabB.subscribe((change) => seen.push(change));
    await tabA.write({}, (tx) => tx.putSalon("own", record(1, 1, "trial")));
    await until(() => seen.length === 1);
    expect(seen[0]).toEqual({ workspace: "own", record: record(1, 1, "trial") });
    await tabA.write({}, (tx) => tx.deleteSalon("own"));
    await until(() => seen.length === 2);
    expect(seen[1]).toEqual({ workspace: "own", record: null });
  });

  it("sends nothing for a refused or aborted write", async () => {
    const factory = new IDBFactory();
    const channel = channelBus();
    const [tabA, tabB] = [open(factory, { channel }), open(factory, { channel })];
    await Promise.all([tabA.ready(), tabB.ready()]);
    const seen: SalonChange[] = [];
    tabB.subscribe((change) => seen.push(change));
    await tabA.write({}, (tx) => { tx.putSalon("demo", record(1)); throw new Error("refused"); }).catch(() => undefined);
    await sleep(20);
    expect(seen).toEqual([]);
  });
});
