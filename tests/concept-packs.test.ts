import { afterEach, describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import type { PackId } from "@/concept/data/types";
import { t, tc, setVocabulary, term } from "@/concept/i18n";
import { menuVisible } from "@/concept/modules/registry";
import { HELP_WISHES, setupFromAnswers, setupOf } from "@/concept/onboarding/setup";
import { getPack, PACKS } from "@/concept/packs";
import { currentState, dispatch, startBusiness } from "@/concept/store";

const today = "2026-11-16";
const states = Object.fromEntries(PACKS.map((pack) => [pack.id, createDemoState(today, { pack: pack.id })])) as Record<PackId, ReturnType<typeof createDemoState>>;
const FOOT_WORDS = getPack("foot-massage").vocabulary;

afterEach(() => setVocabulary(FOOT_WORDS));

describe.each(PACKS)("industry pack $id", (pack) => {
  const state = states[pack.id];
  const stockIds = new Set(pack.stock.map((s) => s.id));
  const serviceIds = new Set(pack.services.map((s) => s.id));

  it("is complete: services, stock and seeds all point at things that exist", () => {
    expect(pack.services.length).toBeGreaterThanOrEqual(6);
    for (const service of pack.services) {
      expect(pack.categories).toContain(service.category);
      for (const use of service.consumption ?? []) expect(stockIds).toContain(use.stockId);
    }
    for (const id of [...pack.featured, pack.requests.returning.serviceId, pack.requests.newClient.serviceId, ...pack.campaigns.flatMap((c) => c.serviceIds), ...pack.popular.flatMap((p) => Object.keys(p))]) {
      expect(serviceIds).toContain(id);
    }
    for (const id of Object.keys(pack.journalFor)) expect(serviceIds).toContain(id);
    for (const delivery of pack.looseNote.deliveries) expect(stockIds).toContain(delivery.stockId);
    for (const item of pack.stock) expect(pack.suppliers.map((s) => s.name)).toContain(item.supplier);
    expect(pack.stock.some((s) => s.salePrice)).toBe(true);
  });

  it("has a name, description, category labels and journal templates in the dictionary", () => {
    expect(t(`pack.${pack.id}.name`)).not.toBe("");
    expect(t(`pack.${pack.id}.description`)).not.toBe("");
    for (const category of pack.categories) expect(t(`category.${category}`)).not.toBe("");
    for (const template of pack.journalTemplates) {
      for (const field of ["label", "treatment", "observations", "advice", "nextVisit"] as const) expect(t(`journal.template.${template.id}.${field}`)).not.toBe("");
    }
  });

  it("generates a living business the same way every time", () => {
    expect(JSON.stringify(createDemoState(today, { pack: pack.id }))).toBe(JSON.stringify(state));
    expect(state.pack).toBe(pack.id);
    expect(state.services.map((s) => s.name)).toEqual(pack.services.map((s) => s.name));
    expect(state.customers).toHaveLength(360);
    expect(state.bookings.filter((b) => b.date === today).length).toBeGreaterThan(3);
    expect(new Set(state.bookings.map((b) => b.serviceId)).size).toBeGreaterThanOrEqual(pack.services.length - 2);
    expect(state.journals.length).toBeGreaterThan(20);
    expect(state.reviews.length).toBeGreaterThan(20);
    expect(state.campaigns.map((c) => c.id)).toEqual(["c-autumn", "c-bundle"]);
    expect(state.holidays.every((h) => h.serviceIds.every((id) => serviceIds.has(id)))).toBe(true);
  });

  it("never double-books anyone", () => {
    const active = state.bookings.filter((b) => b.status !== "cancelled");
    for (const b of active) {
      const clash = active.find((o) => o !== b && o.staffId === b.staffId && o.date === b.date && o.start < b.start + b.duration && b.start < o.start + o.duration);
      expect(clash).toBeUndefined();
    }
  });

  it("has something low in stock and an inbox to work through", () => {
    expect(state.stock.some((s) => s.inStock <= s.reorderAt)).toBe(true);
    expect(state.inbox.some((i) => i.kind === "request")).toBe(true);
    expect(state.inbox.filter((i) => i.kind === "review")).toHaveLength(2);
  });

  it("works as a one-person business", () => {
    const solo = createDemoState(today, { pack: pack.id, solo: true });
    expect(solo.staff.map((s) => s.id)).toEqual(["anna"]);
    expect(solo.services.every((s) => s.staffIds.join() === "anna")).toBe(true);
    expect(solo.bookings.every((b) => b.staffId === "anna")).toBe(true);
    expect(new Set(solo.bookings.map((b) => b.serviceId)).size).toBeGreaterThanOrEqual(pack.services.length - 2);
  });
});

describe("switching pack", () => {
  it("replaces services, words and starting modules", () => {
    const foot = states["foot-massage"];
    const hair = states.hair;
    expect(foot.services.map((s) => s.name)).toContain("Medical foot care");
    expect(hair.services.map((s) => s.name)).toContain("Women's cut and blow-dry");
    expect(hair.services.map((s) => s.name)).not.toContain("Medical foot care");
    expect(hair.stock.map((s) => s.name)).not.toEqual(foot.stock.map((s) => s.name));
    expect(hair.salon.tagline).not.toBe(foot.salon.tagline);
    expect(states.clinic.modules.campaigns).toBe(false);
    expect(foot.modules.campaigns).toBe(true);
  });

  it("applies the pack words as soon as the store starts a business", () => {
    startBusiness({ pack: "hair" });
    expect(t("nav.customers")).toBe("Clients");
    startBusiness();
    expect(t("nav.customers")).toBe("Customers");
  });

  it("starts the store with the chosen pack and modules", () => {
    startBusiness({ pack: "trainer", modules: ["stock", "assistant"] });
    expect(t("nav.services")).toBe("Sessions & prices");
    expect(currentState()?.modules).toMatchObject({ stock: true, finance: false });
    expect(dispatch({ type: "module/toggle", key: "stock" })).toBe(true);
    expect(currentState()?.modules.stock).toBe(false);
  });
});

describe("vocabulary", () => {
  it("swaps customer and treatment words in plain text, keeping capitals and plurals", () => {
    setVocabulary(getPack("clinic").vocabulary);
    expect(t("nav.customers")).toBe("Patients");
    expect(t("nav.services")).toBe("Treatments & prices");
    setVocabulary(getPack("trainer").vocabulary);
    expect(t("nav.services")).toBe("Sessions & prices");
    expect(t("services.subtitle", { count: 4 })).toBe("4 sessions");
    setVocabulary(getPack("hair").vocabulary);
    expect(t("nav.customers")).toBe("Clients");
    expect(t("nav.services.description")).toBe("Services, durations and prices");
  });

  it("leaves {placeholders} and their values alone", () => {
    setVocabulary(getPack("hair").vocabulary);
    expect(t("command.book.title", { name: "Eva Berg", service: "Customer care" })).toBe("Book Eva Berg for Customer care");
  });

  it("handles plural messages and the term helper", () => {
    setVocabulary(getPack("clinic").vocabulary);
    expect(tc("suggest.recall.title", 3)).toContain("patients");
    expect(term("customer")).toBe("patient");
    expect(term("customer", { plural: true, capital: true })).toBe("Patients");
    expect(term("service")).toBe("treatment");
  });

  it("gives every pack plain words for both", () => {
    for (const pack of PACKS) {
      expect(pack.vocabulary.customer).toMatch(/^[a-z]+$/);
      expect(pack.vocabulary.service).toMatch(/^[a-z]+$/);
    }
  });
});

describe("onboarding result", () => {
  it("turns the three answers into a setup", () => {
    expect(setupFromAnswers({ pack: "hair", team: "solo", help: ["stock", "reviews"] })).toEqual({ pack: "hair", solo: true, modules: ["stock", "reviews", "assistant"] });
    expect(setupFromAnswers({ pack: "nails", team: "small", help: [] })).toEqual({ pack: "nails", solo: false, modules: getPack("nails").modules });
    expect(setupFromAnswers({ pack: "clinic", team: "large", help: [...HELP_WISHES] }).modules).toHaveLength(HELP_WISHES.length + 1);
  });

  it("builds the studio the answers describe", () => {
    const state = createDemoState(today, setupFromAnswers({ pack: "trainer", team: "solo", help: ["journal", "waitlist"] }));
    expect(state.pack).toBe("trainer");
    expect(state.staff).toHaveLength(1);
    expect(state.modules).toEqual({ journal: true, stock: false, campaigns: false, finance: false, reviews: false, waitlist: true, assistant: true, giftcards: false, packages: false, domain: false });
    expect(menuVisible(state.modules, "/studio/more/stock")).toBe(false);
    expect(menuVisible(state.modules, "/studio/more/finance")).toBe(false);
  });

  it("lets Reset demo rebuild the same business", () => {
    const state = createDemoState(today, setupFromAnswers({ pack: "nails", team: "solo", help: ["campaigns"] }));
    expect(setupOf(state)).toEqual({ pack: "nails", solo: true, modules: ["campaigns", "assistant"] });
    expect(createDemoState(today, setupOf(state)).modules).toEqual(state.modules);
  });
});
