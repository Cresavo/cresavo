import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { ClaimOffer } from "@/concept/booking/claim-offer";
import type { Booking, DemoState } from "@/concept/data/types";
import { t } from "@/concept/i18n";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined }) }));

// The personal offer page for a fictional salon: Thursday 19 November 2026, 10:00 in Stockholm.
const day = "2026-11-19";
const now = Date.parse(`${day}T10:00:00+01:00`);
const date = "2026-11-20";
const salon = createSalon(day, { ...salonDraft("en"), name: "Studio Demo", people: ["Alex Demo"] });
const staffId = salon.staff[0].id;

function offered(packages: boolean): DemoState {
  const base: DemoState = {
    ...salon,
    services: [{ ...salon.services[0], duration: 60, staffIds: [staffId] }],
    modules: { ...salon.modules, waitlist: true, packages },
    waitlistRules: { ...salon.waitlistRules, mode: "automatic" },
  };
  const visit: Booking = { id: "visit", date, start: 600, duration: 60, staffId, serviceId: base.services[0].id, customerId: "original", source: "phone", status: "booked", price: 550 };
  const joined = reduce({ ...base, bookings: [visit] }, {
    type: "online/waitlist", serviceId: base.services[0].id, days: [date], notice: { title: "Demo", body: "Fictional" },
    guest: { name: "Demo Guest", phone: "0701234561", at: { date: day, time: 600 } },
  }, now);
  return reduce(joined, { type: "booking/cancel", id: "visit" }, now);
}

describe("the personal offer page", () => {
  it.each([true, false])("shows prepaid-package terms only when packages are on (%s)", (packages) => {
    const state = offered(packages);
    const html = renderToStaticMarkup(createElement(ClaimOffer, { state, now: { today: day, minutes: 600, instant: now }, id: state.waitlistOffers[0].id }));
    expect(html).toContain(t("offers.claim"));
    expect(html.includes(t("booking.summary.atSalonWithPackages"))).toBe(packages);
  });
});
