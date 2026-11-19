import { afterEach, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { toKey } from "@/concept/data/dates";

function storage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
  };
}
const draft = { ...salonDraft("en"), name: "Studio Vide" };

async function openTab(localStorage: ReturnType<typeof storage>, sessionStorage = storage()) {
  vi.resetModules();
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage, sessionStorage }));
  return import("@/concept/store");
}
afterEach(() => vi.unstubAllGlobals());

it("resolves booking links per tab and reads same-workspace edits before saving", async () => {
  const local = storage();
  const session = storage();
  const studio = await openTab(local, session);
  await studio.switchSalon("own", draft);
  const booking = await openTab(local);
  await booking.openBookingWorkspace("studio-vide");
  booking.dispatch({ type: "card/dismiss", id: "from-booking" });
  await booking.openBookingWorkspace("salong-eko");
  expect(booking.currentState()?.industry).toBeNull();
  studio.dispatch({ type: "card/dismiss", id: "from-studio" });
  expect(studio.currentState()?.salon.slug).toBe("studio-vide");
  expect(studio.currentState()?.dismissedCards).toEqual(["from-booking", "from-studio"]);
  expect((await openTab(local, session)).currentState()?.salon.slug).toBe("studio-vide");
});

it("retains the latest legacy salon when storage cannot hold a parked copy", async () => {
  const local = storage();
  const salon = createSalon(toKey(new Date()), draft);
  local.setItem("salong-eko-demo-own", JSON.stringify(salon));
  salon.dismissedCards.push("latest");
  local.setItem("salong-eko-demo", JSON.stringify(salon));
  const write = local.setItem;
  local.setItem = (key, value) => {
    if (key !== "salong-eko-demo") throw new Error("quota");
    write(key, value);
  };
  const studio = await openTab(local);
  await studio.switchSalon("demo");
  expect(studio.currentState()?.industry).toBeNull();
  const reloaded = await openTab(local);
  await reloaded.openBookingWorkspace("studio-vide");
  expect(reloaded.currentState()?.dismissedCards).toContain("latest");
});

it("refuses the other salon's address during setup, edits and undo", async () => {
  const studio = await openTab(storage());
  const log = studio.dispatchWithLog({ type: "salon/slug", slug: "studio-vide" });
  expect(typeof log).toBe("string");
  expect(await studio.switchSalon("own", draft)).toBe(false);
  expect(await studio.switchSalon("own", { ...draft, slug: "studio-lime" })).toBe(true);
  expect(studio.dispatch({ type: "salon/slug", slug: "studio-vide" })).toBe(false);
  await studio.switchSalon("demo");
  expect(studio.dispatch({ type: "salon/slug", slug: "studio-lime" })).toBe(false);
  const changed = studio.dispatchWithLog({ type: "salon/slug", slug: "studio-fern" });
  await studio.switchSalon("own");
  expect(studio.dispatch({ type: "salon/slug", slug: "studio-vide" })).toBe(true);
  await studio.switchSalon("demo");
  expect(studio.dispatch({ type: "log/undo", id: String(changed) })).toBe(false);
});

it("opens a solo salon in the owner role after viewing the demo as staff", async () => {
  const studio = await openTab(storage());
  const { currentRole, setRole } = await import("@/concept/ops/role");
  await studio.switchSalon("own", draft);
  await studio.switchSalon("demo");
  setRole("staff");
  await studio.openBookingWorkspace("studio-vide");
  expect(currentRole()).toBe("owner");
});

it("keeps captured customer facts local when work resumes in the demo", async () => {
  const studio = await openTab(storage());
  await studio.switchSalon("own", draft);
  const localOnly = !!studio.currentState()?.industry;
  const facts = { sinceYear: 2026, regular: false, visits: 0, service: null, intervalWeeks: null,
    traits: [], prefersStaff: null, timeOfDay: null, note: "Fictional customer note" };
  const { runAiTask, isAiConfigured } = await import("@/concept/ai/api-client");
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await studio.switchSalon("demo");
  expect(await isAiConfigured(localOnly)).toBe(false);
  expect((await runAiTask("summarize-customer", facts, localOnly)).log.source).toBe("rules");
  expect(fetch).not.toHaveBeenCalled();
});

it("repairs a previously shared slug without changing the local booking link", async () => {
  const local = storage();
  const date = toKey(new Date());
  const demo = createDemoState(date);
  demo.salon.slug = "studio-vide";
  local.setItem("salong-eko-demo", JSON.stringify(demo));
  local.setItem("salong-eko-demo-own", JSON.stringify(createSalon(date, draft)));
  const studio = await openTab(local);
  expect(studio.currentState()?.salon.slug).toBe("salong-eko");
  studio.openBookingWorkspace("studio-vide");
  expect(studio.currentState()?.industry).toBe("hair");
  studio.openBookingWorkspace("salong-eko");
  expect(studio.currentState()?.industry).toBeNull();
});

it("refuses a second setup draft and resumes the existing salon by its address", async () => {
  const studio = await openTab(storage());
  await studio.switchSalon("own", draft);
  await studio.switchSalon("demo");
  expect(await studio.switchSalon("own", { ...draft, name: "Second salon" })).toBe(false);
  expect(studio.currentState()?.industry).toBeNull();
  expect(await studio.switchSalon("own")).toBe(true);
  expect(studio.currentState()?.salon.name).toBe(draft.name);
});

it("refuses a queued booking if the same tab changes salons before the lock opens", async () => {
  const studio = await openTab(storage());
  await studio.switchSalon("own", draft);
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const request = vi.fn((_key: string, run: () => unknown) => waiting.then(run));
  vi.stubGlobal("navigator", { locks: { request } });
  const book = vi.fn();
  const pending = studio.withBookingLock(book);
  await studio.switchSalon("demo");
  release();
  expect(await pending).toBe(false);
  expect(book).not.toHaveBeenCalled();
});
