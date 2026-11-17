import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toKey } from "@/concept/data/dates";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { migrateState, OLDEST_MIGRATABLE } from "@/concept/data/migrate";
import type { DemoState } from "@/concept/data/types";
import { DEFAULT_PAGE } from "@/concept/page/config";
import { PALETTES } from "@/concept/page/theme";

const today = "2026-11-17";

/** A Salong Eko save from before the rebrand (v14), with edits the owner made. */
function v14Save(day = today) {
  const fresh = createDemoState(day);
  const booking = fresh.bookings.find((b) => b.status === "booked")!;
  return {
    ...fresh,
    version: 14,
    bookings: fresh.bookings.map((b) => (b.id === booking.id ? { ...b, status: "cancelled" as const } : b)),
    customers: fresh.customers.map((c, i) => (i === 0 ? { ...c, firstName: "Edited" } : c)),
    stock: fresh.stock.map((s, i) => (i === 0 ? { ...s, inStock: 99 } : s)),
    page: { ...fresh.page, theme: { ...fresh.page.theme, colors: PALETTES.rose }, css: ".hero { letter-spacing: 1px }" },
    cancelledId: booking.id,
  };
}

describe("migrateState", () => {
  it("keeps every edit in a v14 save and lifts it to the current version", () => {
    const { cancelledId, ...saved } = v14Save();
    const migrated = migrateState(JSON.parse(JSON.stringify(saved)))!;
    expect(migrated.version).toBe(DEMO_VERSION);
    expect(migrated.bookings.find((b) => b.id === cancelledId)!.status).toBe("cancelled");
    expect(migrated.customers[0].firstName).toBe("Edited");
    expect(migrated.stock[0].inStock).toBe(99);
    expect(migrated.page.theme.colors).toEqual(PALETTES.rose);
    expect(migrated.page.css).toBe(".hero { letter-spacing: 1px }");
  });

  it("does not repaint a v14 page that had no palette: only new fixtures get Forest", () => {
    const fresh = createDemoState(today);
    expect(fresh.page.theme.colors).toEqual(PALETTES.forest);
    const saved = { ...fresh, version: 14, page: DEFAULT_PAGE };
    expect(migrateState(saved)!.page.theme.colors).toBeNull();
  });

  it("adds what v13 and v14 introduced to older saves", () => {
    const fresh = createDemoState(today);
    const v12: Partial<DemoState> = { ...fresh, version: 12 };
    delete v12.page;
    delete v12.domain;
    delete v12.memory;
    delete v12.routines;
    const migrated = migrateState(v12)!;
    expect(migrated.version).toBe(DEMO_VERSION);
    expect(migrated.memory).toEqual([]);
    expect(migrated.routines).toEqual([]);
    expect(migrated.page).toEqual(DEFAULT_PAGE);
    expect(migrated.domain).toBeNull();
    expect(migrated.bookings).toEqual(fresh.bookings);
  });

  it("rejects unknown, too old, newer and malformed saves", () => {
    const fresh = createDemoState(today);
    expect(migrateState({ ...fresh, version: OLDEST_MIGRATABLE - 1 })).toBeNull();
    expect(migrateState({ ...fresh, version: DEMO_VERSION + 1 })).toBeNull();
    expect(migrateState(null)).toBeNull();
    expect(migrateState("v14")).toBeNull();
    expect(migrateState({ bookings: [] })).toBeNull();
  });
});

describe("store load", () => {
  const storage = new Map<string, string>();
  beforeEach(() => {
    vi.resetModules();
    storage.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens a same-day v14 save with its edits instead of fresh fixtures", async () => {
    const { cancelledId, ...saved } = v14Save(toKey(new Date()));
    storage.set("salong-eko-demo", JSON.stringify(saved));
    const { currentState } = await import("@/concept/store");
    const state = currentState()!;
    expect(state.version).toBe(DEMO_VERSION);
    expect(state.bookings.find((b) => b.id === cancelledId)!.status).toBe("cancelled");
    expect(state.customers[0].firstName).toBe("Edited");
    expect(state.page.theme.colors).toEqual(PALETTES.rose);
  });
});
