import { createElement, type ComponentType, type ReactNode } from "react";
import type { Locale } from "@/lib/locale";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { publicSalonView } from "@/concept/booking/public-projection";
import { Reviews } from "@/concept/booking/salon-info";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, t } from "@/concept/i18n";
import { ConceptLanguage } from "@/concept/i18n/boundary";

// A live salon on the booking page: the salon renders in the browser and reviews need no customer records.

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
});
