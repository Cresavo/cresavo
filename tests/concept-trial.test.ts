import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { parseLastUse, TRIAL_IDLE_MS, trialExpired } from "@/concept/onboarding/trial";

const HOUR = 60 * 60 * 1000;
const start = Date.parse("2026-11-19T10:00:00Z");

describe("trial lifetime", () => {
  it("expires after 24 hours without use, never without a record", () => {
    expect(TRIAL_IDLE_MS).toBe(24 * HOUR);
    expect(trialExpired(start, start + 23 * HOUR)).toBe(false);
    expect(trialExpired(start, start + 24 * HOUR)).toBe(true);
    expect(trialExpired(null, start + 100 * HOUR)).toBe(false);
  });

  it("reads only a sensible stored time", () => {
    expect(parseLastUse(String(start))).toBe(start);
    for (const raw of [null, "", "soon", "-5", "0"]) expect(parseLastUse(raw)).toBeNull();
  });
});

describe("trial salon in the store", () => {
  // The store reads the clock when the studio opens; a fixed clock makes "a day later" exact.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function browser(items = new Map<string, string>()) {
    const store = (map: Map<string, string>) => ({
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value); },
      removeItem: (key: string) => { map.delete(key); },
    });
    vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage: store(items), sessionStorage: store(new Map()) }));
    return items;
  }

  async function openStudio(items: Map<string, string>) {
    vi.resetModules();
    browser(items);
    return import("@/concept/store");
  }

  const own = () => JSON.stringify(createSalon(toKey(new Date()), { ...salonDraft("en"), name: "Studio Vide" }));

  it("records use, keeps a salon used within a day and removes one idle for 24 hours", async () => {
    const items = new Map([["salong-eko-demo", JSON.stringify(createDemoState(toKey(new Date())))], ["salong-eko-demo-own", own()]]);
    let store = await openStudio(items);
    expect(await store.switchSalon("own")).toBe(true);
    store.markTrialUsed(start);
    expect(items.get("salong-eko-demo-own-last-used")).toBe(String(start));
    expect(store.expireIdleTrial(start + 23 * HOUR)).toBe(false);
    expect(store.currentState()?.industry).toBe("hair");

    store = await openStudio(items);
    expect(store.expireIdleTrial(start + 24 * HOUR)).toBe(true);
    expect(items.has("salong-eko-demo-own")).toBe(false);
    expect(items.has("salong-eko-demo-own-last-used")).toBe(false);
    expect(store.currentState()?.industry).toBeNull();
    expect(store.currentState()?.salon.name).toBe("Salong Eko");
    expect(await store.switchSalon("own")).toBe(false);
  });

  it("starts counting for an older salon without a record and never expires the demo salon", async () => {
    const items = new Map([["salong-eko-demo-own", own()]]);
    const store = await openStudio(items);
    expect(store.expireIdleTrial(start)).toBe(false);
    expect(items.get("salong-eko-demo-own-last-used")).toBe(String(start));
    const demoOnly = new Map([["salong-eko-demo", JSON.stringify(createDemoState(toKey(new Date())))]]);
    const demo = await openStudio(demoOnly);
    expect(demo.expireIdleTrial(start + 1000 * HOUR)).toBe(false);
    expect(demo.currentState()?.salon.name).toBe("Salong Eko");
  });

  it("removes an idle trial when the studio opens and deletes one on request", async () => {
    const items = new Map([["salong-eko-demo-own", own()], ["salong-eko-demo-own-last-used", String(Date.now() - 25 * HOUR)]]);
    let store = await openStudio(items);
    expect(store.currentState()?.industry).toBeNull();
    expect(items.has("salong-eko-demo-own")).toBe(false);

    store = await openStudio(items);
    expect(await store.switchSalon("own", { ...salonDraft("en"), name: "Studio Ny" })).toBe(true);
    expect(store.currentState()?.salon.slug).toBe("studio-ny");
    store.deleteTrialSalon();
    expect(store.currentState()?.industry).toBeNull();
    expect(items.has("salong-eko-demo-own")).toBe(false);
  });
});
