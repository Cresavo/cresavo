import { createElement, type ComponentType, type ReactNode } from "react";
import type { Locale } from "@/lib/locale";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { DetailsStep } from "@/concept/booking/details-step";
import { publicSalonView } from "@/concept/booking/public-projection";
import { Reviews } from "@/concept/booking/salon-info";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, t } from "@/concept/i18n";
import { ConceptLanguage } from "@/concept/i18n/boundary";
import { ServerSalonProvider } from "@/concept/server-salon";

// A live salon on the booking page: the salon renders in the browser, reviews need no customer records,
// and the closed booking says so before any contact details are asked for.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const base = createDemoState("2026-11-16");
const customer = base.customers[0];
const state = publicSalonView({
  ...base,
  modules: { ...base.modules, reviews: true },
  reviews: [{ id: "r1", customerId: customer.id, staffId: base.staff[0].id, date: "2026-11-10", rating: 5, text: "Fictional approved text", source: "Booking page", approved: true }],
}, NOW);

// Children are given as createElement arguments, not as a prop.
const Language = ConceptLanguage as unknown as ComponentType<{ language: Locale; currency: string; children?: ReactNode }>;

const Server = ServerSalonProvider as unknown as ComponentType<{ state: typeof state; children?: ReactNode }>;

afterEach(() => setLocale("en"));

describe("the salon's own language and currency", () => {
  it("are applied in the browser after hydration: the server response holds no salon content", () => {
    const Greeting = () => createElement("p", null, t("booking.confirm"));
    expect(renderToString(createElement(Language, { language: "sv", currency: "SEK" }, createElement(Greeting)))).toBe("");
  });
});

describe("the booking page without customer records", () => {
  it("shows a review under its display name", () => {
    expect(state.customers).toEqual([]);
    const html = renderToString(createElement(Reviews, { state }));
    expect(html).toContain("Fictional approved text");
    expect(html).toContain(`${customer.firstName} ${customer.lastName[0]}.`);
  });

  it("says booking opens soon, with the salon's phone, instead of asking for name and phone", () => {
    const service = state.services[0];
    const slot = { staffId: service.staffIds[0], date: "2026-11-17", start: 600 };
    const props = {
      state, now: { today: "2026-11-16", minutes: 600, instant: NOW.getTime() }, serviceId: service.id, slot, suggested: false,
      contact: { guest: { name: "", phone: "" }, setGuest: () => undefined, remember: false, chooseRemember: () => undefined },
      onTaken: () => undefined, onBooked: () => undefined, onHeld: () => undefined,
    };
    const html = renderToString(createElement(Server, { state }, createElement(DetailsStep, props as never)));
    expect(html).toContain("Online booking opens soon");
    expect(html).toContain(state.salon.phone);
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
  });
});
