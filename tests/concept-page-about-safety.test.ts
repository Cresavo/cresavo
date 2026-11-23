import { describe, expect, it } from "vitest";
import { publicSalonView } from "@/concept/booking/public-projection";
import { reduce } from "@/concept/actions";
import { eraseCustomer } from "@/concept/customers/erase";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { migrateState } from "@/concept/data/migrate";
import type { Customer, DemoState } from "@/concept/data/types";
import { translate } from "@/concept/i18n";
import { salonCopy, studioSalonCopy } from "@/concept/i18n/salon-eko-copy";
import { applyAction } from "@/concept/log/capture";
import type { LogMeta } from "@/concept/log/types";
import { undoBlockReason, undoEntry } from "@/concept/log/undo";
import { EMPTY_ABOUT } from "@/concept/page/about";
import { DEFAULT_SECTIONS } from "@/concept/page/sections";
import { OWNER_ACTION_SCHEMAS } from "@/lib/owner-actions/schemas";

// The About text beside the rest of the product: customer erasure, what the
// public page is sent, older saves, undo and older clients. Fictional data only.

const today = "2026-11-17";
const now = new Date(`${today}T08:00:00Z`);
const meta: LogMeta = { actor: "owner", source: "button", at: 0 };
const demo = createDemoState(today);
const fixtureText = translate("en", "fixture.eko.about");
const pageSet = OWNER_ACTION_SCHEMAS["page/set"];

describe("erasing a customer named in the About text", () => {
  const customer: Customer = {
    id: "k-about", firstName: "Fictional", lastName: "Erasable", phone: "0700001234", email: "erasable@example.test",
    category: demo.customers[0].category, preferredStaff: demo.staff[0].id, since: today, isRegular: false, tags: [], waitlist: false,
  };
  const named = { heading: "Thank you, Fictional Erasable", text: "Our first guest was Fictional Erasable.\n\nWrite to erasable@example.test." };
  const withText = (sections: DemoState["page"]["sections"]) =>
    applyAction({ ...demo, customers: [...demo.customers, customer] }, { type: "page/set", page: { ...demo.page, sections, about: named } }, meta);

  it.each([["published", demo.page.sections], ["switched off", DEFAULT_SECTIONS]])("removes their name and address while the section is %s", (_, sections) => {
    const state = withText(sections);
    expect(JSON.stringify(state.page.about)).toContain("Fictional Erasable");
    const erased = eraseCustomer(state, customer.id);
    const left = JSON.stringify([erased.page, erased.log, publicSalonView(erased, now).page]);
    expect(left).not.toContain("Erasable");
    expect(left).not.toContain("erasable@example.test");
    expect(erased.page.about.text).toContain("Our first guest was");
    expect(erased.page.sections).toEqual(state.page.sections);
  });
});

describe("what the public page is sent", () => {
  it("sends neither heading nor section while the body is empty", () => {
    const draft = { ...demo, page: { ...demo.page, about: { heading: "A heading in progress", text: " \n " } } };
    const view = publicSalonView(draft, now);
    expect(view.page.about).toEqual(EMPTY_ABOUT);
    expect(view.page.sections.some((section) => section.kind === "about")).toBe(false);
    expect(publicSalonView(demo, now).page.sections.some((section) => section.kind === "about")).toBe(true);
  });
});

describe("older saves", () => {
  const v23 = (state: DemoState) => {
    const page: Partial<DemoState["page"]> = { ...state.page, sections: DEFAULT_SECTIONS };
    delete page.about;
    const strip = (value: unknown) => {
      const snapshot = { ...(value as DemoState["page"]) } as Partial<DemoState["page"]>;
      delete snapshot.about;
      return snapshot;
    };
    const log = state.log.map((entry) => entry.patch?.values.page
      ? { ...entry, patch: { ...entry.patch, values: { ...entry.patch.values, page: { before: strip(entry.patch.values.page.before), after: strip(entry.patch.values.page.after) } } } }
      : entry);
    return JSON.parse(JSON.stringify({ ...state, version: 23, page, log }));
  };

  it("keeps Undo working for a page edit made before the About text existed", () => {
    const old = { ...demo, page: { ...demo.page, sections: DEFAULT_SECTIONS } };
    const edited = applyAction(old, { type: "page/set", page: { ...old.page, css: ".hero { letter-spacing: 1px }" } }, meta);
    const migrated = migrateState(v23(edited))!;
    expect(undoBlockReason(migrated, migrated.log[0])).toBeUndefined();
    const undone = undoEntry(migrated, migrated.log[0].id);
    expect(undone.page.css).toBe("");
    expect(undone.page.about).toEqual(migrated.page.about);
  });

  it("opens a current save whose page has no About object", () => {
    const page: Partial<DemoState["page"]> = { ...demo.page };
    delete page.about;
    const migrated = migrateState(JSON.parse(JSON.stringify({ ...demo, page })))!;
    expect(migrated.page.about).toEqual(EMPTY_ABOUT);
    expect(() => studioSalonCopy(migrated, "sv")).not.toThrow();
  });

  it.each([12, 13, 14, 23])("gives a v%i Salong Eko save the demo text, with the section off", (version) => {
    const saved: Partial<DemoState> = JSON.parse(JSON.stringify(v23(demo)));
    if (version < 14) delete saved.page;
    const migrated = migrateState({ ...saved, version })!;
    expect(migrated.version).toBe(DEMO_VERSION);
    expect(migrated.page.about).toEqual({ heading: "", text: fixtureText });
    expect(migrated.page.sections.some((section) => section.kind === "about")).toBe(false);
  });
});

describe("undo and the studio language", () => {
  it("does not treat the translated demo text as a change", () => {
    const edited = applyAction(demo, { type: "page/set", page: { ...demo.page, css: ".hero { letter-spacing: 1px }" } }, meta);
    expect(undoBlockReason(edited, edited.log[0])).toBeUndefined();
    // The activity list checks the saved salon; the translated view alone would look like a change.
    expect(undoBlockReason(studioSalonCopy(edited, "sv"), edited.log[0])).toBe("changed");
    // The Swedish studio shows the page with the translated text and saves it back unchanged.
    const shown = studioSalonCopy(edited, "sv").page;
    expect(shown.about.text).toBe(translate("sv", "fixture.eko.about"));
    const resaved = applyAction(edited, { type: "page/set", page: { ...shown, css: ".hero { letter-spacing: 2px }" } }, meta);
    expect(resaved.page.about.text).toBe(fixtureText);
    expect(resaved.log[0].summary).not.toContain("About");
    // An owner's own text in the same field is saved as typed.
    const own = reduce(edited, { type: "page/set", page: { ...shown, about: { heading: "", text: "Våra egna ord." } } });
    expect(own.page.about.text).toBe("Våra egna ord.");
    expect(salonCopy(own, "en").page.about.text).toBe("Våra egna ord.");
  });
});

describe("a page saved by an editor from before the About text", () => {
  const { about: _about, ...older } = demo.page;
  void _about;

  it("is accepted and keeps the stored About text", () => {
    const parsed = pageSet.safeParse({ type: "page/set", page: { ...older, css: ".hero { letter-spacing: 1px }" } });
    expect(parsed.success).toBe(true);
    const next = reduce(demo, parsed.data as Parameters<typeof reduce>[1]);
    expect(next.page.css).toBe(".hero { letter-spacing: 1px }");
    expect(next.page.about).toEqual(demo.page.about);
  });

  it("keeps the stored section style when the editor is from before it existed", () => {
    const lined = reduce(demo, { type: "page/set", page: { ...demo.page, theme: { ...demo.page.theme, style: "lined" } } });
    const { style: _style, ...theme } = lined.page.theme;
    void _style;
    const parsed = pageSet.safeParse({ type: "page/set", page: { ...lined.page, theme, css: ".hero { letter-spacing: 1px }" } });
    expect(parsed.success).toBe(true);
    const next = reduce(lined, parsed.data as Parameters<typeof reduce>[1]);
    expect(next.page.theme.style).toBe("lined");
    expect(pageSet.safeParse({ type: "page/set", page: { ...lined.page, theme: { ...theme, style: "striped" } } }).success).toBe(false);
  });

  it("still refuses a wrong About object and unknown page fields", () => {
    for (const page of [{ ...older, about: null }, { ...older, about: { heading: "" } }, { ...older, about: "text" }, { ...older, extra: true }]) {
      expect(pageSet.safeParse({ type: "page/set", page }).success, JSON.stringify(page).slice(-40)).toBe(false);
    }
  });
});

describe("the one-person demo", () => {
  it("does not name a colleague who is not on the roster", () => {
    for (const language of ["en", "sv"] as const) expect(translate(language, "fixture.eko.about")).not.toContain("Erik");
  });
});
