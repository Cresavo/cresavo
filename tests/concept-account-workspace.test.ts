import { afterEach, expect, it, vi } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { toKey } from "@/concept/data/dates";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";

// The signed-in owner's salon in the studio store: shown from the server, never written to browser storage.

function storage() {
  const items = new Map<string, string>();
  return { items, getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value); }, removeItem: (key: string) => { items.delete(key); } };
}

async function openTab() {
  vi.resetModules();
  const localStorage = storage();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage: storage() }));
  return { store: await import("@/concept/store"), localStorage };
}

const salon = () => createSalon(toKey(new Date()), { ...salonDraft("sv"), name: "Studio Server", industry: "other", treatments: [] });
const service = { name: "Fotvård", duration: 60, price: 650, category: "menu", description: "", staffIds: ["staff-1" as const] };

afterEach(() => vi.unstubAllGlobals());

it("shows a change at once, hands it to the server and keeps it out of browser storage", async () => {
  const { store, localStorage } = await openTab();
  const sent: DemoAction[] = [];
  expect(store.openAccountSalon(salon(), (action) => sent.push(action))).toBe(true);
  const before = new Map(localStorage.items);
  expect(store.dispatch({ type: "service/add", service })).toBe(true);
  expect(store.currentState()?.services.map((s) => s.name)).toEqual(["Fotvård"]);
  expect(sent.map((action) => action.type)).toEqual(["service/add"]);
  expect([...localStorage.items.keys()].filter((key) => !before.has(key) && key.startsWith("salong-eko-demo"))).toEqual([]);
  expect(store.currentTarget()?.workspace).toBe("account");
});

it("takes the server's copy and returns to the sample business when closed", async () => {
  const { store } = await openTab();
  store.openAccountSalon(salon(), () => {});
  const fromServer = { ...salon(), salon: { ...salon().salon, name: "Studio Server (saved)" } };
  store.replaceAccountSalon(fromServer);
  expect(store.currentState()?.salon.name).toBe("Studio Server (saved)");
  store.closeAccountSalon();
  expect(store.currentState()?.industry).toBeNull();
});

it("leaves the demo and trial salons untouched while the account salon is open", async () => {
  const { store } = await openTab();
  const demoName = store.currentState()?.salon.name;
  store.openAccountSalon(salon(), () => {});
  store.dispatch({ type: "card/dismiss", id: "account-only" });
  store.closeAccountSalon();
  expect(store.currentState()?.salon.name).toBe(demoName);
  expect(store.currentState()?.dismissedCards).not.toContain("account-only");
});
