import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { ManageBooking } from "@/concept/booking/manage-booking";
import type { PublicBookingView } from "@/concept/booking/public-booking-view";
import { publicSalonView } from "@/concept/booking/public-projection";
import { createDemoState } from "@/concept/data/generate";
import { setLocale } from "@/concept/i18n";
import { ServerSalonProvider } from "@/concept/server-salon";

// What the holder of a booking link is offered: before the free-cancellation
// deadline the two changes, after it only the salon's phone number. Rendered
// on the server's salon; fictional data and a fixed clock.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const base = createDemoState("2026-11-16");
const state = publicSalonView({ ...base, salon: { ...base.salon, slug: "salong-fiktiv", phone: "08-555 01 02" } }, NOW);
const Server = ServerSalonProvider as unknown as ComponentType<{ state: typeof state; issuedAt: string; children?: ReactNode }>;

const view: PublicBookingView = {
  serviceId: state.services[0].id, staffId: state.services[0].staffIds[0], treatment: state.services[0].name, staffFirstName: "Anna",
  date: "2026-11-24", start: 600, duration: 60, status: "booked", salon: { phone: "08-555 01 02", email: "info@salong-fiktiv.example", address: "Dalagatan 34" },
};
const render = (over: Partial<PublicBookingView> = {}) => renderToString(createElement(Server, { state, issuedAt: "fictional-token" },
  createElement(ManageBooking, { slug: "salong-fiktiv", id: "ref-fictional", token: "fictional-token", view: { ...view, ...over }, onChanged: () => undefined })));

afterEach(() => setLocale("en"));

describe("the booking link's changes", () => {
  it("offers cancel and change of time, with the deadline, before the free-cancellation deadline", () => {
    const html = render({ freeUntil: { date: "2026-11-23", time: 600 } });
    expect(html).toMatch(/<button[^>]*>.*Change time<\/button>/);
    expect(html).toMatch(/<button[^>]*>.*Cancel booking<\/button>/);
    expect(html).toContain("Free cancellation until");
    expect(html).not.toContain("call the salon");
  });

  it("offers only the salon's contact details after the deadline, in either language", () => {
    const html = render();
    expect(html).not.toContain("Cancel booking");
    expect(html).not.toContain("Change time");
    expect(html).toContain("closed for this booking");
    expect(html).toContain('href="tel:0855501' + '02"');
    expect(html).toContain('href="mailto:info@salong-fiktiv.example"');
    expect(html).toContain("Dalagatan 34");
    setLocale("sv");
    expect(render()).toContain("Kontakta salongen");
  });

  it("still says so, and makes sense, for a salon with no contact details", () => {
    const html = render({ salon: { phone: "", email: "", address: "" } });
    expect(html).toContain("Please contact the salon to change or cancel it.");
    expect(html).not.toContain("href=");
  });

  it("offers nothing for a cancelled or completed visit", () => {
    for (const status of ["cancelled", "completed"] as const) expect(render({ status, freeUntil: { date: "2026-11-23", time: 600 } })).toBe("");
  });
});
