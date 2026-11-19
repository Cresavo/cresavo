import { afterEach, expect, it, vi } from "vitest";
import { toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import { bookableServices } from "@/concept/selectors";
import { runStudioStoreContract } from "./contract";

// The adapter over the existing browser store, in a stubbed window with the
// storage keys the studio uses today (as tests/concept-workspaces.test.ts does).

function storage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  };
}

/** A fresh tab: new module instances over the given storage. */
async function openTab(localStorage: ReturnType<typeof storage>, sessionStorage = storage()) {
  vi.resetModules();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage }));
  const legacy = await import("@/concept/store");
  const { BrowserStudioStore } = await import("@/concept/store/browser-studio-store");
  return { legacy, store: new BrowserStudioStore() };
}

afterEach(() => vi.unstubAllGlobals());

runStudioStoreContract("BrowserStudioStore", async (seeds) => {
  const local = storage();
  local.setItem("salong-eko-demo", JSON.stringify(seeds.a));
  local.setItem("salong-eko-demo-own", JSON.stringify(seeds.b));
  const { legacy, store } = await openTab(local);
  return {
    store,
    tenants: { a: "demo", b: "own" },
    open: async (tenantId) => { await legacy.switchSalon(tenantId as "demo" | "own"); },
  };
});

it("keeps the existing storage keys and the legacy dispatch path", async () => {
  const local = storage();
  const { legacy, store } = await openTab(local);
  expect((await store.apply("demo", { type: "card/dismiss", id: "via-adapter" })).ok).toBe(true);
  expect(legacy.dispatch({ type: "card/dismiss", id: "via-dispatch" })).toBe(true);
  expect(JSON.parse(local.getItem("salong-eko-demo")!).dismissedCards).toEqual(["via-adapter", "via-dispatch"]);
  // The legacy write counts as a change the adapter saw, but it is not in the adapter's log.
  expect((await store.load("demo"))?.version).toBe(2);
  expect((await store.history("demo", { limit: 10 })).entries.map((e) => e.seq)).toEqual([1]);
});

it("refuses a tenant that is not open in this tab", async () => {
  const { store } = await openTab(storage());
  expect(await store.load("own")).toBeNull();
  expect(await store.apply("own", { type: "card/dismiss", id: "x" })).toEqual({ ok: false, reason: "not-found" });
});

it("sees another tab's booking: a stale version conflicts and the same slot is refused", async () => {
  const today = toKey(new Date());
  const local = storage();
  const base = createDemoState(today);
  local.setItem("salong-eko-demo", JSON.stringify(base));
  const service = bookableServices(base)[1];
  const staffId = service.staffIds[0];
  const date = Array.from({ length: 14 }, (_, i) => toKey(new Date(Date.now() + (i + 1) * 86_400_000)))
    .find((day) => freeStarts(base, staffId, day, needOf(service)).length)!;
  const start = freeStarts(base, staffId, date, needOf(service))[0];
  const [first, second] = base.customers;
  const booking = (customerId: string) => ({ type: "booking/create" as const, customerId, serviceId: service.id, staffId, date, start, source: "phone" as const });

  const tabB = await openTab(local);
  const seen = await tabB.store.load("demo");
  const tabA = await openTab(local);
  expect((await tabA.store.apply("demo", booking(first.id))).ok).toBe(true);

  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: local, sessionStorage: storage() }));
  expect(await tabB.store.apply("demo", booking(second.id), {}, { expectedVersion: seen!.version })).toMatchObject({ ok: false, reason: "conflict" });
  expect(await tabB.store.apply("demo", booking(second.id))).toMatchObject({ ok: false, reason: "rejected" });
  const bookings = JSON.parse(local.getItem("salong-eko-demo")!).bookings as { customerId: string; date: string; start: number; staffId: string }[];
  expect(bookings.filter((b) => b.date === date && b.start === start && b.staffId === staffId).map((b) => b.customerId)).toEqual([first.id]);
});
