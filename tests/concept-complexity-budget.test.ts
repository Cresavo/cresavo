import { describe, expect, it } from "vitest";
import { enabledModules } from "@/concept/modules/registry";
import { CHECKLIST_ROWS, createSalon, salonDraft, SETUP_TYPES, suggestedTreatments } from "@/concept/onboarding/salon";
import { MORE_TAB, moreMenu, PRIMARY_NAV } from "@/concept/studio/nav";

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

  it("has a getting-started checklist of at most 4 rows", () => {
    expect(CHECKLIST_ROWS.length).toBeLessThanOrEqual(4);
  });
});
