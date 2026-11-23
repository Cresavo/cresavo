import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toKey } from "@/concept/data/dates";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { migrateState, OLDEST_MIGRATABLE } from "@/concept/data/migrate";
import type { DemoState } from "@/concept/data/types";
import { translate } from "@/concept/i18n";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { jsonEqual } from "@/concept/data/json-equal";
import { DEFAULT_PAGE } from "@/concept/page/config";
import { addSectionAfter, DEFAULT_SECTIONS } from "@/concept/page/sections";
import { applyTemplate } from "@/concept/page/templates";
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
    // The demo salon gets its About text ready (v24), with the section still off.
    expect(migrated.page).toEqual({ ...DEFAULT_PAGE, about: { heading: "", text: translate("en", "fixture.eko.about") } });
    expect(migrated.domain).toBeNull();
    expect(migrated.bookings).toEqual(fresh.bookings);
  });

  it("moves a v15 page that was still on the old default sections to the new default, and leaves an arranged one alone", () => {
    const fresh = createDemoState(today);
    const old = [{ kind: "hero", variant: "photo" }, { kind: "treatments", variant: "list" }, { kind: "giftcards", variant: "check" }, { kind: "reviews", variant: "cards" }, { kind: "map", variant: "full" }];
    expect(migrateState({ ...fresh, version: 15, page: { ...fresh.page, sections: old } })!.page.sections).toEqual(DEFAULT_PAGE.sections);
    const arranged = [...old].reverse();
    expect(migrateState({ ...fresh, version: 15, page: { ...fresh.page, sections: arranged } })!.page.sections).toEqual(arranged);
  });

  it("adds portraits by staff ID and preserves edited staff and solo rosters from v16", () => {
    const fresh = createDemoState(today);
    const staff = [...fresh.staff].reverse().map((person) => ({ ...person, photo: undefined, bio: "Edited" }));
    const saved = { ...fresh, version: 16, staff };
    const migrated = migrateState(saved)!;
    expect(migrated.staff).toEqual([
      { ...staff[0], photo: "/demo/staff-erik.webp" },
      { ...staff[1], photo: "/demo/staff-anna.webp" },
    ]);
    expect(migrateState({ ...saved, staff: [staff[1]] })!.staff).toEqual([migrated.staff[1]]);
  });

  it("adds the current booking defaults to a v17 Salong Eko save", () => {
    const saved: Partial<DemoState> = { ...createDemoState(today), version: 17 };
    delete saved.localization;
    const migrated = migrateState(saved)!;
    expect(migrated.localization).toEqual({ language: "en", bilingual: true, currency: "SEK" });
    expect(migrated.bookings).toEqual(saved.bookings);
  });

  it("updates the booking defaults on a v19 Salong Eko save while preserving its other edits", () => {
    const { cancelledId, ...edited } = v14Save();
    const saved = { ...edited, version: 19, localization: { language: "sv", bilingual: false, currency: "SEK" } };
    const migrated = migrateState(saved)!;
    expect(migrated.version).toBe(DEMO_VERSION);
    expect(migrated.localization).toEqual({ language: "en", bilingual: true, currency: "SEK" });
    expect(migrated.bookings.find((b) => b.id === cancelledId)?.status).toBe("cancelled");
    expect(migrated.page).toEqual(saved.page);
  });

  it("preserves an owner's salon and localization when migrating from v19", () => {
    const own = createSalon(today, { ...salonDraft("sv"), industry: "foot", currency: "EUR" });
    const saved = { ...own, version: 19 };
    expect(migrateState(saved)).toEqual({ ...saved, version: DEMO_VERSION });
  });

  it.each([20, 21])("migrates a v%i salon to fee-free terms and preserves reminder preferences", version => {
    const saved: Partial<DemoState> = { ...createDemoState(today), version };
    delete saved.cancellationPolicy;
    delete saved.checkoutHolds;
    if (version === 20) delete saved.reminderSettings;
    else saved.reminderSettings = { channel: "email", smsPriceOre: 70 };
    const migrated = migrateState(saved)!;
    expect(migrated).toEqual({
      ...saved, version: DEMO_VERSION, checkoutHolds: [],
      cancellationPolicy: { version: 1, freeHours: 24, noShowPercent: 0, latePercent: 0, deposits: {}, newCustomersOnly: false, exemptServices: [] },
      reminderSettings: saved.reminderSettings ?? { channel: "sms", smsPriceOre: 45 },
    });
  });

  it.each([21, 22])("preserves a deposit-branch v%i save that predates reminder settings", version => {
    const fresh = createDemoState(today);
    const saved: Partial<DemoState> = { ...fresh, version, cancellationPolicy: {
      ...fresh.cancellationPolicy, version: 3, freeHours: 48, deposits: { [fresh.services[0].id]: 12550 },
    } };
    delete saved.reminderSettings;
    expect(migrateState(saved)).toEqual({
      ...saved, version: DEMO_VERSION, reminderSettings: { channel: "sms", smsPriceOre: 45 },
    });
  });

  it("lifts a v22 salon to the current version and keeps its modules, bookings, page and reminder preferences", () => {
    const own = createSalon(today, { ...salonDraft("en"), name: "Studio Vide" }, { examplesAfter: 0 });
    const saved = { ...own, version: 22, modules: { ...own.modules, finance: true, campaigns: true } };
    expect(migrateState(saved)).toEqual({ ...saved, version: DEMO_VERSION });
    expect(migrateState(saved)!.bookings.every((booking) => booking.example)).toBe(true);
  });

  describe("v25: section style and the ready-made designs", () => {
    const fresh = createDemoState(today);
    const { style: _style, ...oldTheme } = { ...DEFAULT_PAGE.theme, colors: PALETTES.forest };
    void _style;
    const about = { heading: "", text: translate("en", "fixture.eko.about") };
    // The demo page as v24 generated it: forest colours, the About section after the team, no section style yet.
    const generated = { ...DEFAULT_PAGE, theme: oldTheme, sections: addSectionAfter(DEFAULT_SECTIONS, "about", "staff"), about };
    const lift = (page: unknown, extra: object = {}) => migrateState({ ...fresh, version: 24, page, ...extra })!;

    it("gives the demo salon the Eko design and keeps its About section and text", () => {
      const page = lift(generated).page;
      const eko = applyTemplate(DEFAULT_PAGE, "eko");
      expect(page.theme).toEqual(eko.theme);
      expect(page.sections).toEqual(addSectionAfter(eko.sections, "about", "staff"));
      expect(page.about).toEqual(about);
    });

    it("gives it to a demo page migrated from v23 too, which has the text but no About section", () => {
      const page = lift({ ...generated, sections: DEFAULT_SECTIONS }).page;
      expect(page.sections).toEqual(applyTemplate(DEFAULT_PAGE, "eko").sections);
      expect(page.about).toEqual(about);
    });

    it("leaves a page the owner changed alone and only adds the style", () => {
      const edited = { ...generated, theme: { ...oldTheme, corners: "round" as const } };
      expect(lift(edited).page).toEqual({ ...edited, theme: { ...edited.theme, style: "boxed" } });
    });

    it("leaves an own salon's page alone even when it looks like the demo's", () => {
      expect(lift(generated, { industry: "other" }).page).toEqual({ ...generated, theme: { ...oldTheme, style: "boxed" } });
    });

    it("leaves the page alone once the owner has edited it, even back to the generated look, so that edit can still be undone", () => {
      const edit = { id: "log-1", patch: { values: { page: { before: { ...generated, css: "h1 { margin: 0 }" }, after: generated } } } };
      const state = lift(generated, { log: [edit] });
      expect(state.page).toEqual({ ...generated, theme: { ...oldTheme, style: "boxed" } });
      const log = state.log as unknown as (typeof edit)[];
      expect(jsonEqual(log[0].patch.values.page.after, state.page)).toBe(true);
    });

    it("leaves a demo page with its own About text alone", () => {
      const own = { ...generated, about: { heading: "", text: "Our own words." } };
      expect(lift(own).page).toEqual({ ...own, theme: { ...oldTheme, style: "boxed" } });
    });

    it("fills in the About text of a v24 save from the designs' preview builds, which had the style but no About", () => {
      const { about: _about, ...preview } = { ...applyTemplate(DEFAULT_PAGE, "eko") };
      void _about;
      const edit = { id: "log-1", patch: { values: { page: { before: preview, after: { ...preview, css: "h1 { margin: 0 }" } } } } };
      const state = lift({ ...preview, css: "h1 { margin: 0 }" }, { log: [edit] });
      expect(state.page.about).toEqual(about);
      const log = state.log as unknown as { patch: { values: { page: { before: { about: unknown }; after: unknown } } } }[];
      expect(log[0].patch.values.page.before.about).toEqual(about);
      expect(jsonEqual(log[0].patch.values.page.after, state.page)).toBe(true);
      expect(lift(preview, { industry: "other" }).page.about).toEqual({ heading: "", text: "" });
    });

    it("adds the style to page snapshots in the activity log, so an earlier page edit can still be undone", () => {
      const entry = { id: "log-1", patch: { values: { page: { before: generated, after: { ...generated, css: "h1 { margin: 0 }" } } } } };
      const log = lift(generated, { log: [entry] }).log as unknown as (typeof entry)[];
      expect(log[0].patch.values.page.before.theme).toMatchObject({ style: "boxed" });
      expect(log[0].patch.values.page.after.theme).toMatchObject({ style: "boxed" });
      expect(log[0].patch.values.page.after.css).toBe("h1 { margin: 0 }");
    });
  });

  it("is one linear chain: every saved version from the oldest to the current reaches DEMO_VERSION", () => {
    const fresh = createDemoState(today);
    for (let version = OLDEST_MIGRATABLE; version <= DEMO_VERSION; version++) {
      expect(migrateState({ ...fresh, version })?.version, `from v${version}`).toBe(DEMO_VERSION);
    }
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
