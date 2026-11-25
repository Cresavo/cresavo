import { redactReplay } from "@/concept/store/erasure";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { Customer, DemoState } from "@/concept/data/types";
import { applyAction } from "@/concept/log/capture";
import { TRASH_DAYS } from "@/concept/trash/trash";

// The browser store erases a customer whose 30 days in the trash are over when
// it loads the saved salon, and writes that back. Fictional data only.

beforeEach(() => vi.resetModules());
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const NAME = "Fictional Expired";
const KEY = "salong-eko-demo";

/** Today's demo salon with a customer deleted 30 days ago (still in the trash and in the log's undo data). */
function savedWithExpiredCustomer(): string {
  const today = toKey(new Date());
  const base = createDemoState(today);
  const customer: Customer = {
    id: "k-expired", firstName: "Fictional", lastName: "Expired", phone: "0700005678", email: "", category: base.customers[0].category,
    preferredStaff: base.staff[0].id, since: today, isRegular: false, tags: [], waitlist: false,
  };
  const withCustomer: DemoState = { ...base, customers: [...base.customers, customer] };
  const deleted = applyAction({ ...withCustomer, generatedFor: addDays(today, -TRASH_DAYS) }, { type: "customer/delete", id: customer.id }, { actor: "owner", source: "button", at: 0 });
  return JSON.stringify({ ...deleted, generatedFor: today });
}

it("writes the erasure of an expired trash entry back to storage", async () => {
  let raw = savedWithExpiredCustomer();
  expect(raw).toContain(NAME);
  const localStorage = {
    getItem: vi.fn((key: string) => (key === KEY ? raw : null)),
    setItem: vi.fn((key: string, value: string) => { if (key === KEY) raw = value; }),
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  const { currentState } = await import("@/concept/store");
  expect(JSON.stringify(currentState())).not.toContain(NAME);
  expect(localStorage.setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
  expect(raw).not.toContain(NAME);
  // Reading again finds nothing more to do.
  currentState();
  expect(localStorage.setItem.mock.calls.filter(([key]) => key === KEY)).toHaveLength(1);
});

it("does not overwrite another tab's newer write with the erasure", async () => {
  const raw = savedWithExpiredCustomer();
  const newer = JSON.stringify({ ...JSON.parse(raw), seq: JSON.parse(raw).seq + 5 });
  // Another tab saves between this tab's read and its write-back check.
  const localStorage = {
    getItem: vi.fn((key: string) => (key !== KEY ? null : new Error().stack?.includes("persistErasure") ? newer : raw)),
    setItem: vi.fn(),
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  const { currentState } = await import("@/concept/store");
  expect(JSON.stringify(currentState())).not.toContain(NAME);
  expect(localStorage.setItem.mock.calls.filter(([key]) => key === KEY)).toEqual([]);
});

it("removes journal recordings of a customer whose trash period has expired", async () => {
  const today = toKey(new Date());
  const scope = `demo:legacy:${today}`;
  let raw = savedWithExpiredCustomer();
  const localStorage = {
    getItem: (key: string) => (key === KEY ? raw : null),
    setItem: (key: string, value: string) => { if (key === KEY) raw = value; },
    removeItem: () => {},
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }));
  const { journalAudioStore } = await import("@/concept/journals/audio-store");
  const audio = journalAudioStore();
  const bytes = new Uint8Array([1]).buffer;
  await audio.add({ id: "r-expired", customerId: "k-expired", scope, createdAt: 1, source: "recorded", mime: "audio/webm", seconds: 5, bytes });
  await audio.add({ id: "r-kept", customerId: "other", scope, createdAt: 2, source: "recorded", mime: "audio/webm", seconds: 5, bytes });
  const { currentState } = await import("@/concept/store");
  currentState();
  await vi.waitFor(async () => {
    expect((await audio.list("k-expired", scope)).map((row) => row.id)).toEqual([]);
  });
  expect((await audio.list("other", scope)).map((row) => row.id)).toEqual(["r-kept"]);
});


it("drops yesterday's demo recordings when a fresh tab opens on a new day", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-25T10:00:00+01:00"));
  const yesterday = "2026-11-24";
  const lifetime = "life1";
  const oldScope = `demo:${lifetime}:${yesterday}`;
  const items = new Map([[KEY, JSON.stringify({ ...createDemoState(yesterday), epoch: lifetime })]]);
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }));
  const { journalAudioStore } = await import("@/concept/journals/audio-store");
  const audio = journalAudioStore();
  await audio.add({ id: "r-old", customerId: "k001", scope: oldScope, createdAt: 1, source: "recorded", mime: "audio/webm", seconds: 5, bytes: new Uint8Array([1]).buffer });
  const { currentState } = await import("@/concept/store");
  currentState();
  await vi.waitFor(async () => {
    expect(await audio.list("k001", oldScope)).toEqual([]);
  });
});

it("drops yesterday's demo recordings when an unsaved tab rolls into a new day", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T10:00:00+01:00"));
  const items = new Map<string, string>();
  let failWrites = false;
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { if (failWrites) throw new Error("quota"); items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }));
  const { journalAudioStore } = await import("@/concept/journals/audio-store");
  const { currentState, currentTarget, dispatch, latestState } = await import("@/concept/store");
  currentState();
  const target = currentTarget();
  expect(target?.workspace).toBe("demo");
  const { audioScope } = await import("@/concept/journals/audio-store");
  const oldScope = audioScope(target!);
  const audio = journalAudioStore();
  await audio.add({ id: "r-old", customerId: "k001", scope: oldScope, createdAt: 1, source: "recorded", mime: "audio/webm", seconds: 5, bytes: new Uint8Array([1]).buffer });
  failWrites = true;
  expect(dispatch({ type: "card/dismiss", id: "x" })).toBe(true);
  vi.setSystemTime(new Date("2026-11-25T10:00:00+01:00"));
  latestState();
  await vi.waitFor(async () => {
    expect(await audio.list("k001", oldScope)).toEqual([]);
  });
});

describe("redactReplay", () => {
  it("redacts every personal field of the stored action of the erased customer's entry, and leaves another customer's alone", () => {
    const identifiers = ["Lena Exportsson", "0700001111"];
    const book = (customerPhone: string, text: string) => ({
      version: 3, state: { customers: [], bookings: [] }, effects: [],
      entry: { action: { type: "online/book", guest: { name: "Somebody", phone: customerPhone, email: "x@example.test" }, notice: { title: "Private title", body: text }, serviceId: "s-1" } },
    });
    const theirs = redactReplay(book("070 000 11 11", "Fictional private text"), "k-1", identifiers, new Set(["700001111"]), identifiers);
    expect(theirs.entry.action).toMatchObject({ type: "online/book", serviceId: "s-1", guest: { name: "[redacted]", phone: "[redacted]", email: "[redacted]" }, notice: { title: "[redacted]", body: "[redacted]" } });
    const other = redactReplay(book("070 000 99 99", "Fictional private text"), "k-1", identifiers, new Set(["700001111"]), identifiers);
    expect(other.entry.action).toMatchObject({ guest: { name: "Somebody" }, notice: { body: "Fictional private text" } });
  });
});

