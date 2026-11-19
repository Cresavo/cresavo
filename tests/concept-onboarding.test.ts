import { afterEach, describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { migrateState } from "@/concept/data/migrate";
import { DEMO_VERSION } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import { checklistProgress, createSalon, INDUSTRIES, salonDraft, suggestedSlug, suggestedTreatments, weeklyHours } from "@/concept/onboarding/salon";

const monday = "2026-11-23";

describe("browser salon setup", () => {
  it.each(INDUSTRIES)("builds a bookable %s salon without sample clients or business records", industry => {
    const draft = { ...salonDraft("sv"), industry, name: "Ådala Studio", people: ["Lo Demo", "Kim Demo", "Nico Demo"],
      treatments: suggestedTreatments(industry, "sv"), currency: "EUR" };
    const state = createSalon(monday, draft);
    expect(state.version).toBe(DEMO_VERSION);
    expect(state.industry).toBe(industry);
    expect(state.salon.slug).toBe("adala-studio");
    expect(state.localization).toEqual({ language: "sv", bilingual: false, currency: "EUR" });
    expect(state.services.map(s => s.name)).toEqual(draft.treatments.map(s => s.name));
    expect(state.services[0].staffIds).toEqual(state.staff.map(p => p.id));
    expect(state.services[0].staffIds).toHaveLength(3);
    expect(freeStarts(state, state.staff[2].id, monday, needOf(state.services[0]))).toContain(540);
    for (const list of [state.bookings, state.customers, state.inbox, state.journals, state.costs, state.monthHistory,
      state.campaigns, state.stock, state.reviews, state.log, state.trash]) expect(list).toEqual([]);
  });

  it("uses a valid fallback for a reserved or empty name and refuses a taken address", () => {
    const draft = salonDraft("sv");
    expect(suggestedSlug({ ...draft, name: "Studio" })).toBe("min-salong");
    expect(createSalon(monday, draft).staff).toHaveLength(1);
    expect(() => createSalon(monday, { ...draft, slug: "salong-eko" })).toThrow();
    expect(migrateState({ ...createSalon(monday, draft), version: 18, industry: undefined })?.industry).toBeNull();
  });

  it("detects progress from working hours, visible treatments, the current link, bookings and the optional assistant", () => {
    const draft = { ...salonDraft("en"), treatments: [], hours: {} };
    let state = createSalon(monday, draft);
    expect(checklistProgress(state)).toEqual({ addServices: false, setHours: false, share: false, first: false, connect: false });
    state = createSalon(monday, { ...draft, hours: weeklyHours(), treatments: [{ name: "Trim", duration: 20, price: 250 }] });
    state = reduce(state, { type: "online/book", serviceId: state.services[0].id, staffId: state.staff[0].id,
      date: monday, start: 540, guest: { name: "Guest Demo", phone: "0700000011", at: { date: monday, time: 420 } }, notice: { title: "Booking", body: "Test" } });
    state = reduce(state, { type: "card/dismiss", id: `shared:${state.salon.slug}` });
    state = reduce(state, { type: "module/toggle", key: "assistant" });
    expect(Object.values(checklistProgress(state))).toEqual([true, true, true, true, true]);
    expect(checklistProgress(reduce(state, { type: "salon/slug", slug: "another-salon" })).share).toBe(false);
  });

  it("opens skipped days for staff when the owner sets hours later", () => {
    const initial = createSalon(monday, { ...salonDraft("sv"), hours: {} });
    expect(checklistProgress(initial).setHours).toBe(false);
    const state = reduce(initial, { type: "salon/hours", hours: weeklyHours(), lunch: null });
    expect(checklistProgress(state).setHours).toBe(true);
    expect(freeStarts(state, state.staff[0].id, monday, needOf(state.services[0]))).toContain(540);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("preserves an edited salon overnight and through a round trip to the demo", async () => {
    vi.resetModules();
    const storage = new Map<string, string>();
    const draft = { ...salonDraft("sv"), name: "Lilla salongen" };
    storage.set("salong-eko-demo", JSON.stringify(createSalon("2020-01-01", draft)));
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value) } });
    const store = await import("@/concept/store");
    const { currentState, switchSalon, dispatch } = store;
    expect(currentState()!.salon.name).toBe(draft.name);
    dispatch({ type: "card/dismiss", id: "first-steps" });
    await switchSalon("demo");
    expect(currentState()!.bookings.length).toBeGreaterThan(0);
    await store.openBookingWorkspace("unknown-salon");
    expect(currentState()!.industry).toBeNull();
    await store.openBookingWorkspace("lilla-salongen");
    expect(currentState()!.salon.name).toBe(draft.name);
    expect(currentState()!.dismissedCards).toContain("first-steps");
    expect(currentState()!.bookings).toEqual([]);
  });
});
