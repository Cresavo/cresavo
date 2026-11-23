import { describe, expect, it } from "vitest";
import { publicSalonView } from "@/concept/booking/public-projection";
import { reduce } from "@/concept/actions";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { migrateState } from "@/concept/data/migrate";
import type { DemoState } from "@/concept/data/types";
import { translate } from "@/concept/i18n";
import { salonCopy } from "@/concept/i18n/salon-eko-copy";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { aboutParagraphs, EMPTY_ABOUT, MAX_ABOUT_HEADING, MAX_ABOUT_TEXT, normalizeAbout } from "@/concept/page/about";
import { DEFAULT_PAGE, hasSection, normalizePage } from "@/concept/page/config";
import { designRequest } from "@/concept/page/design-request";
import { changedAspects } from "@/concept/page/diff";
import { addSection, addSectionAfter, DEFAULT_SECTIONS, normalizeSections } from "@/concept/page/sections";
import { OWNER_ACTION_SCHEMAS } from "@/lib/owner-actions/schemas";

const pageSet = OWNER_ACTION_SCHEMAS["page/set"];

const today = "2026-11-23";
const kinds = (sections: { kind: string }[]) => sections.map((section) => section.kind);

describe("the booking page's About text", () => {
  it("keeps paragraphs and line breaks as plain text", () => {
    const about = normalizeAbout({ heading: "  Our \n story\t ", text: "First line\r\nsecond line  \n\n\n\nNext <b>paragraph</b>\u0000\n\n" });
    expect(about).toEqual({ heading: "Our story", text: "First line\nsecond line\n\nNext <b>paragraph</b>" });
    expect(aboutParagraphs(about.text)).toEqual(["First line\nsecond line", "Next <b>paragraph</b>"]);
    expect(aboutParagraphs("")).toEqual([]);
  });

  it("cuts long input and drops anything that is not text", () => {
    const about = normalizeAbout({ heading: "h".repeat(200), text: "t".repeat(5000) });
    expect(about.heading).toHaveLength(MAX_ABOUT_HEADING);
    expect(about.text).toHaveLength(MAX_ABOUT_TEXT);
    expect(normalizeAbout(undefined)).toEqual(EMPTY_ABOUT);
    expect(normalizeAbout({ heading: 4, text: ["x"] } as never)).toEqual(EMPTY_ABOUT);
    expect(normalizePage({ about: "x" as never }).about).toEqual(EMPTY_ABOUT);
  });

  it("is a section that is off by default and can be added, once", () => {
    expect(kinds(DEFAULT_SECTIONS)).not.toContain("about");
    expect(DEFAULT_PAGE.about).toEqual(EMPTY_ABOUT);
    const added = addSection(DEFAULT_SECTIONS, "about");
    expect(added.at(-1)).toEqual({ kind: "about", variant: "plain" });
    expect(normalizeSections([{ kind: "about", variant: "huge" }, { kind: "about", variant: "card" }])).toEqual([{ kind: "about", variant: "plain" }]);
    expect(kinds(addSectionAfter(DEFAULT_SECTIONS, "about", "staff"))).toEqual(["hero", "treatments", "staff", "about", "reviews", "map", "giftcards"]);
    expect(kinds(addSectionAfter(DEFAULT_SECTIONS, "about", "faq")).at(-1)).toBe("about");
    expect(addSectionAfter(added, "about", "staff")).toEqual(added);
  });

  it("starts the demo salon with invented text and a new salon without any", () => {
    const demo = createDemoState(today);
    expect(hasSection(demo.page, "about")).toBe(true);
    expect(demo.page.about).toEqual({ heading: "", text: translate("en", "fixture.eko.about") });
    expect(normalizePage(demo.page)).toEqual(demo.page);
    expect(salonCopy(demo, "sv").page.about.text).toBe(translate("sv", "fixture.eko.about"));
    const edited = { ...demo, page: { ...demo.page, about: { heading: "", text: "Our own words." } } };
    expect(salonCopy(edited, "sv").page.about.text).toBe("Our own words.");

    const own = createSalon(today, { ...salonDraft("en"), industry: "foot" });
    expect(hasSection(own.page, "about")).toBe(false);
    expect(own.page.about).toEqual(EMPTY_ABOUT);
  });

  it("migrates a saved page with the section off", () => {
    const fresh = createDemoState(today);
    const oldPage: Partial<DemoState["page"]> = { ...fresh.page, sections: DEFAULT_SECTIONS };
    delete oldPage.about;
    const saved = { ...fresh, version: 23, page: oldPage } as unknown as DemoState;
    const migrated = migrateState(saved)!;
    expect(migrated.version).toBe(DEMO_VERSION);
    expect(hasSection(migrated.page, "about")).toBe(false);
    expect(migrated.page.about).toEqual({ heading: "", text: translate("en", "fixture.eko.about") });
    // The editor compares the saved page with its normalised draft as JSON, so the key order has to match.
    expect(JSON.stringify(normalizePage(migrated.page))).toBe(JSON.stringify(migrated.page));

    const own = migrateState({ ...saved, industry: "foot" })!;
    expect(own.page.about).toEqual(EMPTY_ABOUT);
  });

  it("is saved through page/set, logged as its own aspect and validated on the server", () => {
    const state = createDemoState(today);
    const page = { ...state.page, about: { heading: " About Eko ", text: "Hello\n\n\n\nthere" } };
    const next = reduce(state, { type: "page/set", page });
    expect(next.page.about).toEqual({ heading: "About Eko", text: "Hello\n\nthere" });
    expect(changedAspects(state.page, next.page)).toEqual(["about"]);

    const sent = next.page;
    expect(pageSet.safeParse({ type: "page/set", page: sent }).success).toBe(true);
    expect(pageSet.safeParse({ type: "page/set", page: { ...sent, about: { heading: "", text: "t".repeat(MAX_ABOUT_TEXT + 1) } } }).success).toBe(false);
    expect(pageSet.safeParse({ type: "page/set", page: { ...sent, about: { heading: "", text: "", html: "<b>" } } }).success).toBe(false);
  });

  it("does not send the text to the public page while the section is off", () => {
    const state = createDemoState(today);
    const now = new Date(`${today}T08:00:00Z`);
    expect(publicSalonView(state, now).page.about.text).toBe(state.page.about.text);
    const off = { ...state, page: { ...state.page, sections: DEFAULT_SECTIONS } };
    expect(publicSalonView(off, now).page.about).toEqual(EMPTY_ABOUT);
  });

  it("is added or removed when the owner asks in English or Swedish", () => {
    const added = designRequest("add an about us section", DEFAULT_PAGE) as { page: typeof DEFAULT_PAGE };
    expect(kinds(added.page.sections)).toContain("about");
    expect(kinds((designRequest("ta bort om oss", added.page) as { page: typeof DEFAULT_PAGE }).page.sections)).not.toContain("about");
    expect(designRequest("add a note about Anna's booking", DEFAULT_PAGE)).toBeNull();
  });
});
