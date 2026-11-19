import { describe, expect, it } from "vitest";
import { enabledModules, menuVisible, MODULES, presetModules } from "@/concept/modules/registry";
import { CHECKLIST_ROWS, createSalon, salonDraft, SETUP_TYPES, suggestedTreatments } from "@/concept/onboarding/salon";
import { ADVANCED_PAGE, MORE_TAB, moreMenu, PRIMARY_NAV, SETTINGS_NAV, SETTINGS_SECTIONS } from "@/concept/studio/nav";

// The budget a brand-new salon must stay within, so trying Cresavo stays simple.
// Raise a limit only together with a product decision.
const monday = "2026-11-23";

describe("complexity budget for a fresh salon", () => {
  for (const industry of SETUP_TYPES) {
    const state = createSalon(monday, { ...salonDraft("en"), industry, treatments: suggestedTreatments(industry, "en") });

    it(`${industry}: at most 5 primary navigation items and no module switched on`, () => {
      expect([...PRIMARY_NAV, MORE_TAB].length).toBeLessThanOrEqual(5);
      expect(enabledModules(state.modules)).toEqual([]);
    });

    it(`${industry}: at most 6 entries in More`, () => {
      const menu = moreMenu(state);
      expect(menu.business.length + menu.settings.length).toBeLessThanOrEqual(6);
    });
  }

  it("has a Settings overview of at most 6 sections, ending in Advanced", () => {
    expect(SETTINGS_SECTIONS.length).toBeLessThanOrEqual(6);
    expect(SETTINGS_SECTIONS.at(-1)?.href).toBe(ADVANCED_PAGE);
    expect(new Set(SETTINGS_SECTIONS.map((section) => section.id)).size).toBe(SETTINGS_SECTIONS.length);
  });

  it("lets no module add a Settings section, and each module at most 1 entry in More", () => {
    const off = presetModules("essentials");
    for (const section of SETTINGS_SECTIONS) expect(menuVisible(off, section.href), section.id).toBe(true);
    const baseline = moreMenu({ modules: off });
    for (const manifest of MODULES) {
      const menu = moreMenu({ modules: { ...off, [manifest.id]: true } });
      const added = menu.business.length + menu.settings.length - baseline.business.length - baseline.settings.length;
      expect(added, manifest.id).toBeLessThanOrEqual(1);
    }
  });

  it("keeps History and Advanced out of the More lists", () => {
    const menu = moreMenu({ modules: presetModules("everything") });
    const hrefs = [...menu.business, ...menu.settings].map((item) => item.href);
    expect(hrefs).not.toContain("/studio/more/log");
    expect(hrefs).not.toContain(ADVANCED_PAGE);
    expect(SETTINGS_NAV.map((item) => item.href)).not.toContain("/studio/more/memory");
  });

  it("has a getting-started checklist of at most 4 rows", () => {
    expect(CHECKLIST_ROWS.length).toBeLessThanOrEqual(4);
  });
});
