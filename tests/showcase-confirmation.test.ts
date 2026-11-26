import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { setLocale, t } from "@/concept/i18n";
import { ShowcaseConfirmation, showcaseCalendarLinks } from "@/concept/showcase/confirmation";

const day = "2026-11-25";
const clock = { today: day, minutes: 600, instant: Date.parse(`${day}T09:00:00Z`) };
let state = createDemoState(day);

vi.mock("@/concept/store", () => ({ usePublicDemo: () => state, targetOf: () => ({ workspace: "demo", epoch: "test" }) }));
vi.mock("@/concept/use-now", () => ({ useSalonNow: () => clock }));

const sharePath = "/showcase/salong-klassisk/boka";

function upcoming() {
  const service = state.services.find((item) => !item.hidden) ?? state.services[0];
  const staff = state.staff[0];
  const customer = state.customers[0];
  return {
    ...state.bookings[0],
    id: "showcase-booking",
    customerId: customer.id,
    serviceId: service.id,
    staffId: staff.id,
    date: "2026-11-27",
    start: 810,
    status: "booked" as const,
    price: service.price,
  };
}

beforeEach(() => {
  setLocale("sv");
  state = createDemoState(day);
  state.bookings = [upcoming()];
});

afterEach(() => setLocale("en"));

it("builds a Swedish Google Calendar link that never points at the engine booking page", () => {
  const links = showcaseCalendarLinks(state, state.bookings[0], sharePath, "sv");
  expect(links).not.toBeNull();
  const title = new URL(links!.googleHref).searchParams.get("text") ?? "";
  expect(title).toMatch(/hos Salong Eko/i);
  expect(title).not.toMatch(/ at /);
  expect(links!.sharePath).toBe(`${sharePath}?bokning=${state.bookings[0].id}`);
  expect(links!.sharePath).toContain("showcase");
  expect(links!.googleHref).not.toContain("/boka/");
});

it("keeps every confirmation action on the showcase site, in Swedish, with no platform name", () => {
  const html = renderToStaticMarkup(createElement(ShowcaseConfirmation, {
    id: "showcase-booking",
    sharePath,
    onBack: () => {},
    onOpen: () => {},
    onBookAgain: () => {},
  }));
  expect(html).toContain(t("booking.confirmation.title"));
  expect(html).toContain(t("booking.me.rebook"));
  expect(html).toContain('href="#manage"');
  expect(html).toContain(t("booking.googleCalendar"));
  const google = html.match(/href="(https:\/\/calendar\.google\.com[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  expect(google).toBeTruthy();
  expect(new URL(google!).searchParams.get("text")).toMatch(/hos Salong Eko/i);
  expect(html).not.toContain("/boka/");
  expect(html).not.toMatch(/cresavo/i);
  expect(html).not.toContain("Medical foot care");
});
