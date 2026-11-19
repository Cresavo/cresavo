import { afterEach, describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { migrateState } from "@/concept/data/migrate";
import { addDays } from "@/concept/data/dates";
import { DEMO_VERSION } from "@/concept/data/generate";
import { freeStarts, needOf, openingFor } from "@/concept/data/slots";
import { staffViewer } from "@/concept/ops/access";
import {
  addExampleBookings, CHECKLIST_ROWS, checklistProgress, createSalon, INDUSTRIES, pageSeenCard, salonDraft, SETUP_TYPES,
  suggestedSlug, suggestedTreatments, treatmentIssue, treatmentsValid, weeklyHours,
} from "@/concept/onboarding/salon";
import { DURATION_STEP, MAX_DURATION, MIN_DURATION } from "@/concept/services/edit";
import { FEW_BOOKINGS, SCHEDULE_ROWS, scheduleRows, suggestionLimit } from "@/concept/studio/today/limits";

const monday = "2026-11-23";
const saturday = "2026-11-28";

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

  it("starts with only the core: every module off, whatever the salon type", () => {
    for (const industry of INDUSTRIES) {
      const state = createSalon(monday, { ...salonDraft("en"), industry, treatments: suggestedTreatments(industry, "en") });
      expect(Object.values(state.modules).every(on => !on), industry).toBe(true);
    }
  });

  it("fills everything setup no longer asks with defaults: weekday hours, SEK, the owner alone and an address from the name", () => {
    const state = createSalon(monday, { ...salonDraft("sv"), name: "Studio Linnea" });
    expect(state.salon.hours).toEqual(weeklyHours());
    expect(openingFor(state.salon, monday)).toEqual({ open: 540, close: 1020 });
    expect(openingFor(state.salon, saturday)).toBeNull();
    expect(state.localization).toEqual({ language: "sv", bilingual: false, currency: "SEK" });
    expect(state.salon.slug).toBe("studio-linnea");
    expect(state.staff).toHaveLength(1);
    // A one-person salon has no owner/staff switch.
    expect(staffViewer(state)).toBeNull();
  });

  it("uses a valid fallback for a reserved or empty name and refuses a taken address", () => {
    const draft = salonDraft("sv");
    expect(suggestedSlug({ ...draft, name: "Studio" })).toBe("min-salong");
    expect(createSalon(monday, draft).staff).toHaveLength(1);
    expect(() => createSalon(monday, { ...draft, slug: "salong-eko" })).toThrow();
    expect(migrateState({ ...createSalon(monday, draft), version: 18, industry: undefined })?.industry).toBeNull();
  });
});

describe("suggested treatments", () => {
  it("offers the six setup types, mapped to existing packs", () => {
    expect(SETUP_TYPES).toEqual(["hair", "beauty", "nails", "lashes", "massage", "skin"]);
    expect(SETUP_TYPES).not.toContain("clinic");
    expect(SETUP_TYPES).not.toContain("foot");
    expect(createSalon(monday, { ...salonDraft(), industry: "lashes" }).pack).toBe("nails");
    expect(createSalon(monday, { ...salonDraft(), industry: "skin" }).pack).toBe("nails");
    expect(createSalon(monday, { ...salonDraft(), industry: "hair" }).pack).toBe("hair");
  });

  it.each(SETUP_TYPES)("suggests 3 to 5 typical %s treatments with valid lengths and Swedish prices in both languages", type => {
    for (const language of ["en", "sv"] as const) {
      const list = suggestedTreatments(type, language);
      expect(list.length).toBeGreaterThanOrEqual(3);
      expect(list.length).toBeLessThanOrEqual(5);
      expect(treatmentsValid(list)).toBe(true);
      for (const item of list) {
        expect(item.duration % DURATION_STEP).toBe(0);
        expect(item.duration).toBeGreaterThanOrEqual(MIN_DURATION);
        expect(item.duration).toBeLessThanOrEqual(MAX_DURATION);
        expect(item.price).toBeGreaterThanOrEqual(200);
        expect(item.price).toBeLessThanOrEqual(2500);
      }
    }
    expect(suggestedTreatments(type, "sv").map(item => item.price)).toEqual(suggestedTreatments(type, "en").map(item => item.price));
  });

  it("names them in the chosen language", () => {
    expect(suggestedTreatments("hair", "en")[0].name).toBe("Haircut");
    expect(suggestedTreatments("hair", "sv")[0].name).toBe("Klippning");
    expect(suggestedTreatments("nails", "sv").map(item => item.name)).toContain("Manikyr");
  });

  it("explains what stops an edited treatment", () => {
    const list = suggestedTreatments("nails", "en");
    expect(treatmentIssue([...list, { name: " ", duration: 30, price: 0 }], list.length)).toBe("name");
    expect(treatmentIssue([...list, { name: "manicure", duration: 30, price: 0 }], list.length)).toBe("nameTaken");
    expect(treatmentIssue([{ name: "Trim", duration: 30, price: -1 }], 0)).toBe("price");
    expect(treatmentIssue([{ name: "Trim", duration: 32, price: 300 }], 0)).toBe("duration");
    expect(treatmentIssue([{ name: "Trim", duration: Number.NaN, price: 300 }], 0)).toBe("duration");
    expect(treatmentIssue([{ name: "Trim", duration: 30, price: 300 }], 0)).toBeNull();
  });
});

describe("example bookings", () => {
  const draft = { ...salonDraft("en"), name: "Studio Linnea" };

  it("adds three fictional, clearly marked bookings within opening hours, later today first", () => {
    const state = createSalon(monday, draft, { examplesAfter: 9 * 60 });
    expect(state.bookings).toHaveLength(3);
    expect(state.customers).toHaveLength(3);
    expect(state.bookings.every(b => b.example && b.status === "booked" && b.staffId === "staff-1")).toBe(true);
    expect(state.customers.every(c => c.example && c.lastName === "Example")).toBe(true);
    expect(state.bookings[0]).toMatchObject({ date: monday, start: 600 });
    for (const booking of state.bookings) {
      const hours = openingFor(state.salon, booking.date)!;
      expect(booking.start).toBeGreaterThanOrEqual(hours.open);
      expect(booking.start + booking.duration).toBeLessThanOrEqual(hours.close);
      expect(state.customers.some(c => c.id === booking.customerId)).toBe(true);
    }
    const [a, b] = state.bookings;
    expect(b.date > a.date || b.start >= a.start + a.duration).toBe(true);
  });

  it("moves to the next open day when today is over or closed", () => {
    const evening = createSalon(monday, draft, { examplesAfter: 17 * 60 });
    expect(evening.bookings.every(b => b.date === addDays(monday, 1))).toBe(true);
    const weekend = createSalon(saturday, draft, { examplesAfter: 9 * 60 });
    expect(weekend.bookings.every(b => b.date === addDays(saturday, 2))).toBe(true);
  });

  it("names the examples in the salon's language and adds none without a treatment", () => {
    const swedish = createSalon(monday, { ...salonDraft("sv"), name: "Studio Linnea" }, { examplesAfter: 0 });
    expect(swedish.customers[0].lastName).toBe("Exempel");
    const empty = createSalon(monday, { ...draft, treatments: [] });
    expect(addExampleBookings(empty, monday, 0)).toBe(empty);
  });
});

describe("getting started", () => {
  it("has at most four core rows, none for the assistant or a migration", () => {
    expect(CHECKLIST_ROWS).toEqual(["addServices", "bookingPage", "share", "testBooking"]);
    expect(CHECKLIST_ROWS.length).toBeLessThanOrEqual(4);
  });

  it("detects visible treatments, a seen booking page, the shared link and a real test booking", () => {
    const draft = { ...salonDraft("en"), treatments: [] };
    let state = createSalon(monday, draft);
    expect(checklistProgress(state)).toEqual({ addServices: false, bookingPage: false, share: false, testBooking: false });
    state = createSalon(monday, { ...draft, treatments: [{ name: "Trim", duration: 20, price: 250 }] }, { examplesAfter: 0 });
    expect(checklistProgress(state)).toEqual({ addServices: true, bookingPage: false, share: false, testBooking: false });
    state = reduce(state, { type: "online/book", serviceId: state.services[0].id, staffId: state.staff[0].id,
      date: addDays(monday, 2), start: 540, guest: { name: "Guest Demo", phone: "0700000011", at: { date: monday, time: 420 } }, notice: { title: "Booking", body: "Test" } });
    state = reduce(state, { type: "card/dismiss", id: `shared:${state.salon.slug}` });
    state = reduce(state, { type: "card/dismiss", id: pageSeenCard(state.salon.slug) });
    expect(Object.values(checklistProgress(state))).toEqual([true, true, true, true]);
    expect(checklistProgress(reduce(state, { type: "salon/slug", slug: "another-salon" }))).toMatchObject({ share: false, bookingPage: false });
  });

  it("opens skipped days for staff when the owner sets hours later", () => {
    const initial = createSalon(monday, { ...salonDraft("sv"), hours: {} });
    const state = reduce(initial, { type: "salon/hours", hours: weeklyHours(), lunch: null });
    expect(freeStarts(state, state.staff[0].id, monday, needOf(state.services[0]))).toContain(540);
  });
});

describe("Today for a new salon", () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ start: 540 + i * 60, end: 585 + i * 60 }));

  it("shows the next five rows that have not ended, the day's last ones late in the day, or everything on request", () => {
    expect(scheduleRows(rows, 0)).toEqual(rows.slice(0, SCHEDULE_ROWS));
    expect(scheduleRows(rows, 11 * 60)).toEqual(rows.slice(2, 7));
    expect(scheduleRows(rows, 20 * 60)).toEqual(rows.slice(-SCHEDULE_ROWS));
    expect(scheduleRows(rows, 11 * 60, true)).toEqual(rows);
    expect(scheduleRows(rows.slice(0, 3), 0)).toHaveLength(3);
  });

  it("keeps a salon with few real bookings to one suggestion", () => {
    const salon = createSalon(monday, salonDraft("en"), { examplesAfter: 0 });
    expect(suggestionLimit(salon)).toEqual({ first: 1, more: false });
    const busy = { bookings: Array.from({ length: FEW_BOOKINGS }, () => salon.bookings[0]).map(b => ({ ...b, example: undefined })) };
    expect(suggestionLimit(busy)).toEqual({ first: 2, more: true });
  });
});

describe("own salon in the store", () => {
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

  it("creates a salon from setup with example bookings for today", async () => {
    vi.resetModules();
    const storage = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) } });
    const store = await import("@/concept/store");
    expect(await store.switchSalon("own", { ...salonDraft("en"), name: "Studio Vide" })).toBe(true);
    const state = store.currentState()!;
    expect(state.industry).toBe("hair");
    expect(state.bookings.length).toBeGreaterThanOrEqual(2);
    expect(state.bookings.every(b => b.example)).toBe(true);
    expect(Object.values(state.modules).some(Boolean)).toBe(false);
  });
});
