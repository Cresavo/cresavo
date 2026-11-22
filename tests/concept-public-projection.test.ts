import { describe, expect, it } from "vitest";
import { publicSalonView } from "@/concept/booking/public-projection";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";

// What the server sends to anyone opening a booking page. Fictional data and a fixed date only.

const base = createDemoState("2026-11-16");
const [first] = base.bookings;
const state: DemoState = {
  ...base,
  services: base.services.map((service, index) => index === 0 ? { ...service, hidden: true, consumption: [{ stockId: "x", quantity: 1 }] } : service),
  exceptions: [...base.exceptions, { id: "ex-1", staffId: base.staff[0].id, date: "2026-11-17", kind: "off", reason: "sick" }],
  bookings: [
    { ...first, id: "b-private", note: "Allergic to fictional lavender" },
    { ...first, id: "b-cancelled", status: "cancelled", cancelReason: "Fictional family matter" },
    ...base.bookings.slice(1),
  ],
  customers: base.customers.map((customer, index) => index === 0 ? { ...customer, note: "Fictional private note", tags: ["fictional-vip"] } : customer),
  reviews: [
    ...base.reviews,
    { id: "r-pending", customerId: base.customers[0].id, staffId: base.staff[0].id, date: "2026-11-10", rating: 1, text: "Fictional unapproved text", source: "Booking page", approved: false },
  ],
};

describe("publicSalonView", () => {
  const view = publicSalonView(state);
  const text = JSON.stringify(view);

  it("sends no customer detail, note, journal, inbox text or log", () => {
    expect(state.customers.length).toBeGreaterThan(0);
    expect(state.journals.length).toBeGreaterThan(0);
    expect(state.inbox.length).toBeGreaterThan(0);
    const secrets = [
      ...state.customers.flatMap((c) => [c.lastName, c.phone, c.email, c.note, c.tags.includes("fictional-vip") ? "fictional-vip" : undefined]),
      ...state.journals.flatMap((j) => [j.treatment, j.observations, j.advice]),
      ...state.inbox.filter((item) => item.kind !== "review").flatMap((item) => [item.title, item.body, item.fromName]),
      ...state.bookings.flatMap((b) => [b.note, b.cancelReason]),
      ...state.staff.map((person) => person.phone),
      state.salon.orgNumber,
      "Fictional unapproved text",
    ].filter((value): value is string => !!value && value.length > 3);
    expect([...new Set(secrets.filter((secret) => text.includes(secret)))]).toEqual([]);
    for (const key of ["journals", "inbox", "log", "trash", "memory", "giftCards", "tickets", "campaigns"] as const) expect(view[key]).toEqual([]);
  });

  it("reduces bookings to busy blocks without customers, prices or cancellations", () => {
    const active = state.bookings.filter((b) => b.status !== "cancelled");
    expect(view.bookings).toHaveLength(active.length);
    expect(view.bookings[0]).toEqual({
      id: "busy-0", customerId: "", staffId: first.staffId, serviceId: "", date: first.date, start: first.start,
      duration: first.duration, price: 0, status: "booked", source: "online", resourceId: first.resourceId,
    });
    expect(text).not.toContain("b-private");
    expect(text).not.toContain("b-cancelled");
  });

  it("keeps what the page needs: bookable treatments, team shifts, hours and approved reviews", () => {
    expect(view.services.map((s) => s.id)).toEqual(state.services.slice(1).map((s) => s.id));
    expect(view.services.every((s) => s.consumption === undefined)).toBe(true);
    expect(view.staff.map((p) => [p.id, p.firstName, p.week])).toEqual(state.staff.map((p) => [p.id, p.firstName, p.week]));
    expect(view.salon.hours).toEqual(state.salon.hours);
    expect(view.salon.name).toBe(state.salon.name);
    expect(view.exceptions).toContainEqual({ id: "ex-1", staffId: state.staff[0].id, date: "2026-11-17", kind: "off", reason: "other" });
    expect(view.reviews.every((r) => r.approved !== false && r.bookingId === undefined)).toBe(true);
  });

  it("shows a reviewer by first name and initial only", () => {
    expect(view.customers.length).toBeGreaterThan(0);
    for (const customer of view.customers) expect(customer.lastName.length).toBeLessThanOrEqual(1);
  });
});
