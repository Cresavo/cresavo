import { describe, expect, it } from "vitest";
import { PUBLIC_WINDOW_DAYS, publicSalonView } from "@/concept/booking/public-projection";
import type { CheckoutHold } from "@/concept/booking/protection";
import { openSlots, suggestSlots } from "@/concept/booking/suggest";
import { addDays, weekday } from "@/concept/data/dates";
import { openingFor } from "@/concept/data/slots";
import { pageCss } from "@/concept/page/config";
import { sanitizeCss } from "@/concept/page/css";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";

// What the server sends to anyone opening a booking page. Fictional data and a fixed date only.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const TODAY = "2026-11-16";
const base = createDemoState(TODAY);
const [first] = base.bookings;
const customer = base.customers[0];
const hold = (id: string, date: string, expiresAt: number): CheckoutHold => ({
  id, serviceId: first.serviceId, staffId: first.staffId, date, start: 600, duration: 60, expiresAt,
  terms: { version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 65000, depositMinor: 10000 },
  guest: { name: "Fictional Holder", phone: "0700001234", email: "holder@example.test", at: { date: TODAY, time: 600 } },
  notice: { title: "Fictional hold title", body: "Fictional hold body" },
});
const visit = (id: string, date: string, status: DemoState["bookings"][number]["status"], extra: object = {}) =>
  ({ ...first, id, date, start: 540, status, ...extra });

const state: DemoState = {
  ...base,
  modules: { ...base.modules, reviews: true },
  services: base.services.map((service, index) => index === 0 ? { ...service, hidden: true, consumption: [{ stockId: "x", quantity: 1 }] } : service),
  exceptions: [...base.exceptions, { id: "ex-1", staffId: base.staff[0].id, date: "2026-11-17", kind: "off", reason: "sick" }],
  bookings: [
    visit("b-private", "2026-11-17", "booked", { note: "Allergic to fictional lavender" }),
    visit("b-cancelled", "2026-11-18", "cancelled", { cancelReason: "Fictional family matter" }),
    visit("b-done", "2026-11-17", "completed"),
    visit("b-noshow", "2026-11-17", "noshow"),
    visit("b-past", "2026-11-10", "booked"),
    visit("b-ended", TODAY, "booked", { start: 480, duration: 30 }),
    visit("b-later", TODAY, "booked", { start: 660, duration: 30 }),
    visit("b-far", addDays(TODAY, PUBLIC_WINDOW_DAYS + 1), "booked"),
    visit("b-edge", addDays(TODAY, PUBLIC_WINDOW_DAYS), "booked"),
  ],
  checkoutHolds: [hold("h-live", "2026-11-19", NOW.getTime() + 60_000), hold("h-expired", "2026-11-19", NOW.getTime() - 1)],
  customers: base.customers.map((c, index) => index === 0 ? { ...c, note: "Fictional private note", tags: ["fictional-vip"] } : c),
  reviews: [
    { id: "r-ok", customerId: customer.id, bookingId: "b-private", staffId: base.staff[0].id, date: "2026-11-10", rating: 5, text: "Fictional approved text", source: "Booking page", approved: true, reply: "Thank you" },
    { id: "r-pending", customerId: customer.id, staffId: base.staff[0].id, date: "2026-11-10", rating: 1, text: "Fictional unapproved text", source: "Booking page", approved: false },
    { id: "r-legacy", customerId: customer.id, staffId: base.staff[0].id, date: "2026-11-10", rating: 4, text: "Fictional legacy text", source: "Google" },
  ],
};

describe("publicSalonView", () => {
  const view = publicSalonView(state, NOW);
  const text = JSON.stringify(view);

  it("sends no customer detail, note, journal, inbox text or log", () => {
    expect(state.customers.length).toBeGreaterThan(0);
    expect(state.journals.length).toBeGreaterThan(0);
    expect(state.inbox.length).toBeGreaterThan(0);
    const secrets = [
      ...state.customers.flatMap((c) => [c.firstName, c.lastName, c.phone, c.email, c.note, c.tags.includes("fictional-vip") ? "fictional-vip" : undefined]),
      ...state.journals.flatMap((j) => [j.treatment, j.observations, j.advice]),
      ...state.inbox.flatMap((item) => [item.title, item.body, item.fromName]),
      ...state.bookings.flatMap((b) => [b.note, b.cancelReason]),
      ...state.staff.flatMap((person) => [person.phone, person.lastName, person.role]),
      state.salon.orgNumber,
      "Fictional unapproved text", "Fictional legacy text", "Fictional Holder", "0700001234", "holder@example.test", "Fictional hold",
    ].filter((value): value is string => !!value && value.length > 3);
    // The one reviewer's first name is shown on purpose, with an initial.
    expect([...new Set(secrets.filter((secret) => text.includes(secret) && secret !== customer.firstName))]).toEqual([]);
    for (const key of ["journals", "inbox", "log", "trash", "memory", "giftCards", "tickets", "campaigns", "customers"] as const) expect(view[key]).toEqual([]);
  });

  it("reduces bookings to busy blocks inside the booking window, by the store's occupancy rule, leaving out what has ended", () => {
    // Everything but a cancelled visit occupies time, completed and no-show included; an hour already over today does not.
    expect(view.bookings.map((b) => [b.date, b.start])).toEqual([
      ["2026-11-17", 540], ["2026-11-17", 540], ["2026-11-17", 540], [TODAY, 660], [addDays(TODAY, PUBLIC_WINDOW_DAYS), 540],
    ]);
    expect(view.bookings[0]).toEqual({
      id: "busy-0", customerId: "", staffId: first.staffId, serviceId: "", date: "2026-11-17", start: 540,
      duration: first.duration, price: 0, status: "booked", source: "online", resourceId: first.resourceId,
    });
    for (const id of ["b-private", "b-cancelled", "b-done", "b-noshow", "b-past", "b-ended", "b-later", "b-far"]) expect(text).not.toContain(id);
  });

  it("keeps a live hold's expiry, without its guest, and drops an expired one", () => {
    expect(view.checkoutHolds).toHaveLength(1);
    expect(view.checkoutHolds[0]).toMatchObject({ id: "held-0", date: "2026-11-19", start: 600, duration: 60, expiresAt: NOW.getTime() + 60_000, serviceId: "" });
    expect(view.checkoutHolds[0].guest).toEqual({ name: "", phone: "", at: { date: "2026-11-19", time: 0 } });
  });

  it("keeps what the page needs: bookable treatments, team shifts, hours and the address", () => {
    expect(view.services.map((s) => s.id)).toEqual(state.services.slice(1).map((s) => s.id));
    expect(view.services.every((s) => s.consumption === undefined)).toBe(true);
    expect(view.staff.map((p) => [p.id, p.firstName, p.week])).toEqual(state.staff.map((p) => [p.id, p.firstName, p.week]));
    expect(view.salon.hours).toEqual(state.salon.hours);
    expect(view.salon).toMatchObject({ name: state.salon.name, slug: state.salon.slug, phone: state.salon.phone, orgNumber: "" });
    expect(view.exceptions).toContainEqual({ id: "ex-1", staffId: state.staff[0].id, date: "2026-11-17", kind: "off", reason: "other" });
  });

  it("drops a field nobody listed, however it got into the stored document", () => {
    const extra = { secret: "Fictional smuggled value" };
    const stored = {
      ...state,
      salon: { ...state.salon, ...extra },
      staff: state.staff.map((person) => ({ ...person, ...extra, lastName: "Fictionalsson", role: "Fictional employee" })),
      services: state.services.map((service) => ({ ...service, ...extra })),
      categories: state.categories.map((category) => ({ ...category, ...extra })),
      resources: state.resources.map((resource) => ({ ...resource, ...extra })),
      cancellationPolicy: { ...state.cancellationPolicy, ...extra },
    } as DemoState;
    const out = JSON.stringify(publicSalonView(stored, NOW));
    for (const value of ["Fictional smuggled value", "Fictionalsson", "Fictional employee"]) expect(out).not.toContain(value);
  });

  it("sends team titles and bios only when the page shows them on cards", () => {
    const person = state.staff[0];
    expect(person.bio).toBeTruthy();
    const names = { ...state, page: { ...state.page, sections: [{ kind: "staff" as const, variant: "names" }] } };
    expect(publicSalonView(names, NOW).staff[0]).toMatchObject({ firstName: person.firstName, title: "", bio: "", lastName: "", role: "" });
    const cards = { ...state, page: { ...state.page, sections: [{ kind: "staff" as const, variant: "cards" }] } };
    expect(publicSalonView(cards, NOW).staff[0]).toMatchObject({ title: person.title, bio: person.bio, lastName: "", role: "" });
  });
});

const withSections = (sections: Array<{ kind: "reviews" | "staff" | "treatments"; variant: string }>) => ({ ...state, page: { ...state.page, sections } });

describe("reviews in the public view", () => {
  it("are sent with text and author only when approved and shown, with no customer, staff or booking id", () => {
    const { reviews, customers } = publicSalonView(withSections([{ kind: "reviews", variant: "cards" }]), NOW);
    expect(customers).toEqual([]);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ id: "review-0", text: "Fictional approved text", reply: "Thank you", approved: true, customerId: "", staffId: "staff-0", rating: 5 });
    expect(reviews[0]).not.toHaveProperty("bookingId");
    expect(reviews[0].author).toBe(`${customer.firstName} ${customer.lastName[0]}.`);
    const out = JSON.stringify(publicSalonView(state, NOW));
    expect(out).not.toContain(customer.id);
    expect(out).not.toContain("r-ok");
  });

  it("carry ratings alone when the page has no reviews section, so the hero still has its average", () => {
    const view = publicSalonView(withSections([{ kind: "treatments", variant: "list" }]), NOW);
    expect(view.reviews).toHaveLength(1);
    expect(view.reviews[0]).toMatchObject({ rating: 5, text: "", approved: true });
    expect(view.reviews[0].author).toBeUndefined();
    expect(view.reviews[0].reply).toBeUndefined();
    const out = JSON.stringify(view);
    for (const value of ["Fictional approved text", "Thank you", customer.firstName]) expect(out).not.toContain(value);
  });

  it("send text for only as many reviews as the section shows", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, customerId: customer.id, staffId: base.staff[0].id, date: `2026-11-0${i + 1}`, rating: 5 as const, text: `Fictional text ${i}`, source: "Booking page" as const, approved: true }));
    const quote = publicSalonView({ ...withSections([{ kind: "reviews", variant: "quote" }]), reviews: many }, NOW);
    expect(quote.reviews).toHaveLength(5);
    expect(quote.reviews.filter((r) => r.text)).toHaveLength(1);
    expect(quote.reviews.find((r) => r.text)!.text).toBe("Fictional text 4");
    expect(publicSalonView({ ...withSections([{ kind: "reviews", variant: "cards" }]), reviews: many }, NOW).reviews.filter((r) => r.text)).toHaveLength(3);
  });

  it("are left out entirely while the salon has reviews switched off", () => {
    const view = publicSalonView({ ...state, modules: { ...state.modules, reviews: false } }, NOW);
    expect(view.reviews).toEqual([]);
    expect(view.modules.reviews).toBe(false);
  });
});

describe("nested stored data", () => {
  it("is dropped unless it is of the expected type: an object in image keeps its note off the page", () => {
    const stored = {
      ...state,
      services: state.services.map((service, index) => index === 1 ? { ...service, image: { url: "x", internalNote: "Fictional internal note" } } : service),
      staff: state.staff.map((person) => ({ ...person, photo: { internalNote: "Fictional photo note" }, firstName: ["Fictional", "array"] })),
    } as unknown as DemoState;
    const view = publicSalonView(stored, NOW);
    expect(JSON.stringify(view)).not.toContain("internalNote");
    expect(view.services.find((s) => s.id === state.services[1].id)!.image).toBeUndefined();
    expect(view.staff[0].photo).toBeUndefined();
    expect(view.staff[0].firstName).toBe("");
  });

  it("sends only the categories, resources and deposits of treatments the page offers", () => {
    const [hidden, shown] = state.services;
    const stored: DemoState = {
      ...state,
      categories: [...state.categories, { id: "unused-heading", name: "Fictional unused heading" }],
      resources: [...state.resources, { id: "unused-room", name: "Fictional unused room", kind: "room" }, { id: "used-room", name: "Fictional used room", kind: "room" }],
      services: state.services.map((s) => s.id === shown.id ? { ...s, resourceIds: ["used-room"] } : s),
      cancellationPolicy: { ...state.cancellationPolicy, deposits: { [hidden.id]: 100, [shown.id]: 200 }, exemptServices: [hidden.id, shown.id] },
    };
    const view = publicSalonView(stored, NOW);
    expect(view.categories.map((c) => c.id)).not.toContain("unused-heading");
    expect(view.categories.map((c) => c.id)).toContain(shown.category);
    expect(view.resources.map((r) => r.id)).toContain("used-room");
    expect(view.resources.map((r) => r.id)).not.toContain("unused-room");
    expect(view.cancellationPolicy.deposits).toEqual({ [shown.id]: 200 });
    expect(view.cancellationPolicy.exemptServices).toEqual([shown.id]);
  });

  it("sends the sanitised stylesheet only, never the editor's text or comments", () => {
    const css = "/* Fictional editor note */ h1 { color: red } @import url(https://example.test/x.css);";
    const view = publicSalonView({ ...state, page: { ...state.page, css } }, NOW);
    const out = JSON.stringify(view);
    expect(out).not.toContain("Fictional editor note");
    expect(out).not.toContain("@import");
    expect(view.page.css).toBe("");
    expect(view.page.sanitizedCss).toBe(sanitizeCss(css));
    expect(pageCss(view.page)).toBe(sanitizeCss(css));
    expect(pageCss(view.page)).toContain(".booking-theme");
  });
});

describe("the public horizon", () => {
  const view = publicSalonView(state, NOW);
  const need = { serviceId: view.services[0].id, from: TODAY };
  const clock = { today: TODAY, minutes: 600 };

  it("closes every day after the window, so no search path offers one", () => {
    const edge = addDays(TODAY, PUBLIC_WINDOW_DAYS);
    const beyond = addDays(TODAY, PUBLIC_WINDOW_DAYS + 7);
    expect(openingFor(view.salon, edge)).not.toBeNull();
    expect(openingFor(view.salon, addDays(edge, 1))).toBeNull();
    const query = { ...need, from: beyond, to: addDays(beyond, 3) };
    expect(suggestSlots(state, query, clock, 5).length).toBeGreaterThan(0);
    expect(suggestSlots(view, query, clock, 5)).toEqual([]);
    expect(openSlots(view, view.services[0].id, beyond, { today: beyond, minutes: 0 })).toEqual([]);
    // The stored salon has no horizon: the owner's own calendar is unaffected.
    expect(openingFor(state.salon, beyond)).toEqual(state.salon.hours[weekday(beyond)] ?? null);
  });
});
