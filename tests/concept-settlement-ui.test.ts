import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { MyBookings } from "@/concept/booking/my-bookings";
import { bookingPage } from "@/concept/booking/links";
import { quote } from "@/concept/booking/protection";
import { BookingSheet } from "@/concept/studio/booking/booking-sheet";
import { RedeemSheet } from "@/concept/studio/giftcards/redeem-sheet";
import { createDemoState } from "@/concept/data/generate";
import { redeemable } from "@/concept/giftcards/cards";
import { t } from "@/concept/i18n";

const day = "2026-11-17";
const clock = { today: day, minutes: 600, instant: Date.parse(day + "T09:00:00Z") };
let state = createDemoState(day);
vi.mock("@/concept/studio/use-studio", () => ({ useStudio: () => ({ state, ...clock }) }));
vi.mock("@/concept/store", () => ({ usePublicDemo: () => state }));
vi.mock("@/concept/use-now", () => ({ useSalonNow: () => clock }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams({ ref: state.customers[0].id }) }));

beforeEach(() => {
  state = createDemoState(day);
  const service = { ...state.services[0], price: 500 };
  const terms = quote({ ...state.cancellationPolicy, deposits: { [service.id]: 10050 }, latePercent: 50 }, service, "SEK", true);
  state.bookings = [{ ...state.bookings[0], customerId: state.customers[0].id, serviceId: service.id,
    date: "2026-11-20", start: 600, status: "booked", price: service.price,
    protection: { terms, deposit: { id: "demo-deposit", method: "card" } } }];
});

it("links both a refunded cancellation and a decided no-show from the customer's history", () => {
  const [booking] = state.bookings;
  const protection = booking.protection!;
  state.bookings = [
    { ...booking, id: "refunded", status: "cancelled", protection: { ...protection, refund: { id: "demo-refund", amountMinor: 10050 } } },
    { ...booking, id: "missed", status: "noshow", protection: { ...protection, decision: {
      incident: "noshow", outcome: "charge", actor: "owner", at: clock.instant, proposedMinor: 10050, chargedMinor: 0,
    } } },
    { ...booking, id: "unsettled", status: "cancelled", protection: undefined },
  ];
  const html = renderToStaticMarkup(createElement(MyBookings));
  for (const id of ["refunded", "missed"]) expect(html).toContain(`href="${bookingPage(state.salon.slug, id)}"`);
  expect(html).not.toContain(bookingPage(state.salon.slug, "unsettled"));
});

it("offers the customer-requested reason when a protected booking is cancelled on time", () => {
  const html = renderToStaticMarkup(createElement(BookingSheet, {
    bookingId: state.bookings[0].id, initialMode: "cancel", onClose: () => {},
  }));
  expect(html).toContain(t("cancel.reason.customer"));
  expect(html).toContain(t("cancel.reason.salon"));
});

it("shows the exact gift-card balance due in the currency agreed at booking", () => {
  const [booking] = state.bookings;
  state.localization = { ...state.localization, currency: "EUR" };
  const card = { id: "gift", code: "DEMO2345", amount: 500, recipient: "Demo Guest", soldOn: day, message: "", redemptions: [] };
  state.giftCards = [card];
  expect(redeemable(state, card, booking)).toBe(399.5);
  const html = renderToStaticMarkup(createElement(RedeemSheet, { bookingId: booking.id, onClose: () => {}, onBack: () => {} }));
  expect(html).toContain(new Intl.NumberFormat("en-GB", { style: "currency", currency: "SEK" }).format(399.5));
});
