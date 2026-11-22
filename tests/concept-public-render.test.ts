import { createElement, type ComponentType, type ReactNode } from "react";
import type { Locale } from "@/lib/locale";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailsStep } from "@/concept/booking/details-step";
import { publicSalonView } from "@/concept/booking/public-projection";
import { PageProvider } from "@/concept/booking/page-context";
import { Reviews } from "@/concept/booking/salon-info";
import { SalonPage } from "@/concept/booking/salon-page";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, t } from "@/concept/i18n";
import { ConceptLanguage } from "@/concept/i18n/boundary";
import { ServerSalonProvider } from "@/concept/server-salon";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useParams: () => ({ slug: "x" }), usePathname: () => "/", useRouter: () => ({ push: () => undefined, replace: () => undefined }) }));

// What the server renders for a live salon: the first response has the salon in it, reviews need no
// customer records, and the closed booking says so before any contact details are asked for.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const base = createDemoState("2026-11-16");
const customer = base.customers[0];
const state = publicSalonView({
  ...base,
  modules: { ...base.modules, reviews: true },
  reviews: [{ id: "r1", customerId: customer.id, staffId: base.staff[0].id, date: "2026-11-10", rating: 5, text: "Fictional approved text", source: "Booking page", approved: true }],
}, NOW);

// Children are given as createElement arguments, not as a prop.
const Language = ConceptLanguage as unknown as ComponentType<{ language: Locale; currency: string; immediate?: boolean; children?: ReactNode }>;

const Server = ServerSalonProvider as unknown as ComponentType<{ state: typeof state; children?: ReactNode }>;

afterEach(() => setLocale("en"));

describe("ConceptLanguage with a salon from the server", () => {
  const Greeting = () => createElement("p", null, t("booking.confirm"));

  it("renders its children in the first response, in the salon's language", () => {
    const html = renderToString(createElement(Language, { language: "sv", currency: "SEK", immediate: true }, createElement(Greeting)));
    expect(html).toContain("Bekräfta bokning");
  });

  it("still waits for the browser by default, as the demo does", () => {
    expect(renderToString(createElement(Language, { language: "en", currency: "SEK" }, createElement(Greeting)))).toBe("");
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

describe("the salon page on the server", () => {
  it("has the salon in the first response: its name, treatments and reviews", () => {
    const page = createElement(Server, { state }, createElement(PageProvider, null, createElement(SalonPage)));
    const html = renderToString(createElement(Language, { language: "en", currency: "SEK", immediate: true }, page));
    expect(html).toContain(state.salon.name);
    expect(html).toContain(state.services[0].name);
    expect(html).toContain("Fictional approved text");
  });
});
