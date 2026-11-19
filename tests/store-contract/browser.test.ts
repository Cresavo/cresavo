import { afterEach, expect, it, vi } from "vitest";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import { salonDraft } from "@/concept/onboarding/salon";
import { bookableServices } from "@/concept/selectors";
import { runStudioStoreContract } from "./contract";

// The adapter over the existing browser store, in a stubbed window with the
// storage keys the studio uses today (as tests/concept-workspaces.test.ts does).

const today = toKey(new Date());

function storage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
}
type Storage = ReturnType<typeof storage>;

/** Web Locks and Cache Storage as a browser shares them between tabs. */
function browserServices() {
  const queues = new Map<string, Promise<unknown>>();
  const requested: string[] = [];
  const locks = {
    request<T>(name: string, run: () => T | Promise<T>): Promise<T> {
      requested.push(name);
      const result = (queues.get(name) ?? Promise.resolve()).then(run);
      queues.set(name, result.catch(() => undefined));
      return result;
    },
  };
  const entries = new Map<string, string>();
  const cache = {
    match: async (url: string) => (entries.has(url) ? new Response(entries.get(url)) : undefined),
    put: async (url: string, response: Response) => { entries.set(url, await response.text()); },
  };
  return { locks, requested, entries, caches: { open: async () => cache } };
}
type Services = ReturnType<typeof browserServices>;

function windowFor(localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">, sessionStorage: Storage, services?: Services) {
  return Object.assign(new EventTarget(), {
    localStorage, sessionStorage, setTimeout,
    location: { origin: "https://studio.invalid" },
    ...(services ? { caches: services.caches } : {}),
  });
}

/** A fresh tab: new module instances over the given storage. */
async function openTab(localStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">, options: { session?: Storage; services?: Services } = {}) {
  vi.resetModules();
  const view = windowFor(localStorage, options.session ?? storage(), options.services);
  vi.stubGlobal("window", view);
  if (options.services) vi.stubGlobal("navigator", { locks: options.services.locks });
  const legacy = await import("@/concept/store");
  const { demoOutbox } = await import("@/concept/connections/demo");
  const { BrowserStudioStore } = await import("@/concept/store/browser-studio-store");
  return { legacy, demoOutbox, view, BrowserStudioStore, store: new BrowserStudioStore() };
}

afterEach(() => vi.unstubAllGlobals());

runStudioStoreContract("BrowserStudioStore", async (seeds) => {
  const local = storage();
  local.setItem("salong-eko-demo", JSON.stringify(seeds.a));
  local.setItem("salong-eko-demo-own", JSON.stringify(seeds.b));
  const { legacy, store, demoOutbox } = await openTab(local);
  return {
    store,
    tenants: { a: "demo", b: "own" },
    open: async (tenantId) => { await legacy.switchSalon(tenantId as "demo" | "own"); },
    // Both workspaces of a tab share one simulated outbox; the contract reads it for one tenant at a time.
    payments: () => demoOutbox.list("payments"),
  };
});

function slotIn(state: ReturnType<typeof createDemoState>) {
  const service = bookableServices(state)[1];
  const staffId = service.staffIds[0];
  const date = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1)).find((day) => freeStarts(state, staffId, day, needOf(service)).length)!;
  const start = freeStarts(state, staffId, date, needOf(service))[0];
  const [first, second] = state.customers;
  const booking = (customerId: string) => ({ type: "booking/create" as const, customerId, serviceId: service.id, staffId, date, start, source: "phone" as const });
  return { booking, first, second, date, start, staffId };
}

it("keeps the existing storage keys and the legacy dispatch path", async () => {
  const local = storage();
  const { legacy, store } = await openTab(local);
  expect((await store.apply("demo", { type: "card/dismiss", id: "via-adapter" })).ok).toBe(true);
  expect(legacy.dispatch({ type: "card/dismiss", id: "via-dispatch" })).toBe(true);
  expect(JSON.parse(local.getItem("salong-eko-demo")!).dismissedCards).toEqual(["via-adapter", "via-dispatch"]);
  // The legacy write counts as a change the adapter saw, but it is not in the adapter's log.
  expect((await store.load("demo"))?.version).toBe(2);
  expect((await store.history("demo", { limit: 10 })).entries.map((e) => e.seq)).toEqual([1]);
  expect([...local.items.keys()].sort()).toEqual(["salong-eko-demo"]);
});

it("refuses a tenant that is not open in this tab", async () => {
  const { store } = await openTab(storage());
  expect(await store.load("own")).toBeNull();
  expect(await store.apply("own", { type: "card/dismiss", id: "x" })).toEqual({ ok: false, reason: "not-found" });
});

it("shares versions, keys and history between adapters in one tab", async () => {
  const { store, BrowserStudioStore } = await openTab(storage());
  const other = new BrowserStudioStore();
  const toggle = { type: "module/toggle" as const, key: "stock" as const };
  const first = await store.apply("demo", toggle, {}, { idempotencyKey: "toggle-1" });
  const again = await other.apply("demo", toggle, {}, { idempotencyKey: "toggle-1" });
  expect(again).toMatchObject({ ok: true, replayed: true, version: first.ok ? first.version : -1 });
  expect((await other.load("demo"))?.state.modules.stock).toBe(first.ok && first.state.modules.stock);
  expect((await other.history("demo", { limit: 10 })).entries).toHaveLength(1);
});

it("tells subscribers about legacy dispatches and other tabs' writes, once each", async () => {
  const local = storage();
  const { legacy, store, view } = await openTab(local);
  await store.load("demo");
  const versions: (number | string)[] = [];
  const stop = store.subscribe("demo", (change) => versions.push(change.entry ? `own-${change.version}` : change.version));
  expect(legacy.dispatch({ type: "card/dismiss", id: "legacy" })).toBe(true);
  await store.apply("demo", { type: "card/dismiss", id: "adapter" });
  const saved = JSON.parse(local.getItem("salong-eko-demo")!);
  local.setItem("salong-eko-demo", JSON.stringify({ ...saved, dismissedCards: [...saved.dismissedCards, "other-tab"] }));
  view.dispatchEvent(Object.assign(new Event("storage"), { storageArea: local, key: "salong-eko-demo" }));
  expect(versions).toEqual([1, "own-2", 3]);
  stop();
});

it("ends a trial salon's records when it is deleted or expires", async () => {
  const local = storage();
  const session = storage();
  const { legacy, store } = await openTab(local, { session });
  const draft = { ...salonDraft("en"), name: "Studio Vide" };
  await legacy.switchSalon("own", draft);
  expect((await store.apply("own", { type: "card/dismiss", id: "old" }, {}, { idempotencyKey: "k" })).ok).toBe(true);
  legacy.deleteTrialSalon();
  expect(await store.history("own", { limit: 10 })).toEqual({ entries: [], next: null });
  await legacy.switchSalon("own", draft);
  const fresh = await store.apply("own", { type: "card/dismiss", id: "old" }, {}, { idempotencyKey: "k" });
  expect(fresh).toMatchObject({ ok: true, replayed: false, version: 1 });
  expect(legacy.expireIdleTrial(Date.now() + 25 * 3_600_000)).toBe(true);
  expect((await store.history("own", { limit: 10 })).entries).toEqual([]);
  // Switching workspaces keeps the records.
  await legacy.switchSalon("own", draft);
  await store.apply("own", { type: "card/dismiss", id: "kept" });
  await legacy.switchSalon("demo");
  await legacy.switchSalon("own");
  expect((await store.history("own", { limit: 10 })).entries).toHaveLength(1);
});

it("sees another tab's booking: a stale version conflicts and the same slot is refused", async () => {
  const local = storage();
  const base = createDemoState(today);
  local.setItem("salong-eko-demo", JSON.stringify(base));
  const { booking, first, second, date, start, staffId } = slotIn(base);

  const tabB = await openTab(local);
  const seen = await tabB.store.load("demo");
  const tabA = await openTab(local);
  expect((await tabA.store.apply("demo", booking(first.id))).ok).toBe(true);

  vi.stubGlobal("window", tabB.view);
  expect(await tabB.store.apply("demo", booking(second.id), {}, { expectedVersion: seen!.version })).toMatchObject({ ok: false, reason: "conflict" });
  expect(await tabB.store.apply("demo", booking(second.id))).toMatchObject({ ok: false, reason: "rejected" });
  const bookings = JSON.parse(local.getItem("salong-eko-demo")!).bookings as { customerId: string; date: string; start: number; staffId: string }[];
  expect(bookings.filter((b) => b.date === date && b.start === start && b.staffId === staffId).map((b) => b.customerId)).toEqual([first.id]);
});

it("waits for a lagging storage read before checking a version, even for changes without a sequence bump", async () => {
  const shared = storage();
  shared.setItem("salong-eko-demo", JSON.stringify(createDemoState(today)));
  const services = browserServices();
  const session = storage();
  // Tab B's renderer keeps returning the old text for a few reads after tab A writes.
  let stale: string | null = null;
  let lag = 0;
  const lagging = {
    getItem: (key: string) => (lag > 0 && stale !== null && key === "salong-eko-demo" ? (lag--, stale) : shared.getItem(key)),
    setItem: shared.setItem,
    removeItem: shared.removeItem,
  };
  const tabB = await openTab(lagging, { session, services });
  const seen = (await tabB.store.load("demo"))!;
  const tabA = await openTab(shared, { services });
  stale = shared.getItem("salong-eko-demo");
  lag = 5;
  expect((await tabA.store.apply("demo", { type: "card/dismiss", id: "from-a" })).ok).toBe(true);

  vi.stubGlobal("window", tabB.view);
  const result = await tabB.store.apply("demo", { type: "card/dismiss", id: "from-b" }, {}, { expectedVersion: seen.version });
  expect(result).toMatchObject({ ok: false, reason: "conflict" });
  expect(JSON.parse(shared.getItem("salong-eko-demo")!).dismissedCards).toEqual(["from-a"]);
});

it("reports a booking-receipt timeout as a retryable conflict, not a missing salon", async () => {
  const services = browserServices();
  const { store } = await openTab(storage(), { services });
  services.entries.set("https://studio.invalid/concept-booking-sequence", JSON.stringify({ day: today, seq: 1e9 }));
  const result = await store.apply("demo", { type: "card/dismiss", id: "x" });
  expect(result).toMatchObject({ ok: false, reason: "conflict" });
}, 10_000);

it("takes the shared address lock for address changes only", async () => {
  const services = browserServices();
  const { store } = await openTab(storage(), { services });
  await store.apply("demo", { type: "card/dismiss", id: "x" });
  expect(services.requested).not.toContain("concept-salon-address");
  expect((await store.apply("demo", { type: "salon/slug", slug: "studio-ljus" })).ok).toBe(true);
  expect(services.requested).toContain("concept-salon-address");
});
