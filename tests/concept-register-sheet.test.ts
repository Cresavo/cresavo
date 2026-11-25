import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { quote } from "@/concept/booking/protection";
import { createDemoState } from "@/concept/data/generate";
import { t } from "@/concept/i18n";
import { RegisterSheet } from "@/concept/studio/register/register-sheet";

// The demo register sheet for one visit. Invented data.

const day = "2026-11-25";
const clock = { today: day, minutes: 720, instant: Date.parse(`${day}T11:00:00Z`) };
let state = createDemoState(day);
vi.mock("@/concept/studio/use-studio", () => ({ useStudio: () => ({ state, ...clock, target: { workspace: "demo", epoch: "sheet" } }) }));
vi.mock("@/concept/use-now", () => ({ useSalonNow: () => clock }));

beforeEach(() => {
  state = createDemoState(day);
  const service = { ...state.services[0], price: 500 };
  const terms = quote({ ...state.cancellationPolicy, deposits: { [service.id]: 10000 }, latePercent: 50 }, service, "SEK", true);
  state.bookings = [{ ...state.bookings[0], id: "visit", customerId: state.customers[0].id, serviceId: service.id, date: day, start: 600, status: "booked", price: 500,
    protection: { terms, deposit: { id: "demo-deposit", method: "card" } } }];
});

const render = () => renderToStaticMarkup(createElement(RegisterSheet, { bookingId: "visit", onBack: () => {}, onClose: () => {} }));

it("takes the rest of an open visit", () => {
  const html = render();
  expect(html).toContain(t("register.method"));
  expect(html).not.toContain(t("register.closedText"));
});

it("offers no checkout once a fee decision has closed the visit", () => {
  const [booking] = state.bookings;
  state.bookings = [{ ...booking, status: "noshow", protection: { ...booking.protection!, decision: {
    incident: "noshow", outcome: "charge", actor: "owner", at: clock.instant, proposedMinor: 10000, chargedMinor: 0,
  } } }];
  const html = render();
  expect(html).toContain(t("register.closedText"));
  expect(html).not.toContain(t("register.method"));
  expect(html).not.toContain(t("register.due"));
});
