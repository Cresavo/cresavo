import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Confirmation } from "@/concept/booking/confirmation";
import { publicSalonView } from "@/concept/booking/public-projection";
import { createDemoState } from "@/concept/data/generate";
import { routeHost, UNKNOWN_PATH } from "@/concept/page/resolve";
import { ServerSalonProvider } from "@/concept/server-salon";
import { DEMO_DIRECTORY } from "@/concept/page/directory";

// The live booking journey on both kinds of address. Route level and render
// level only: no browser is driven here. Fictional data and a fixed clock.

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children?: ReactNode }) => createElement("a", { href }, children) }));

const product = "cresavo.com";
const slug = "salong-fiktiv";
const api = `/api/public/salons/${slug}`;

describe("a business's own address", () => {
  const route = (path: string, host = `${slug}.${product}`) => routeHost(host, path, DEMO_DIRECTORY, product);

  it("lets the page's own same-origin calls reach the public API: free times, booking and one booking's view", () => {
    expect(route(api)).toEqual({ action: "next" });
    expect(route(`${api}/bookings`)).toEqual({ action: "next" });
    expect(route(`${api}/bookings/0b7e2c1a-4d5f-4a6b-9c8d-1e2f3a4b5c6d`)).toEqual({ action: "next" });
  });

  it("lets through nothing else of the API, and no other business's", () => {
    for (const path of [`${api}/bookings/ref-1/cancel`, `${api}/bookings/`, `${api}/bookings/${"a".repeat(65)}`, `${api}/bookings/a.b`, "/api/public/salons/another-salong/bookings/ref-1", `${api}/other`, "/api/public/salons/another-salong", "/api/public/salons/another-salong/bookings", "/api/public/salons", "/api/owner/salon/actions"]) {
      expect(route(path), path).toEqual({ action: "rewrite", path: UNKNOWN_PATH });
    }
  });
});

describe("the product host's /boka/<slug>", () => {
  it("serves the page and the API as they are", () => {
    for (const host of ["cresavo.com", "demo.cresavo.com", "localhost:3000"]) {
      expect(routeHost(host, `/boka/${slug}`, DEMO_DIRECTORY, product)).toEqual({ action: "next" });
      expect(routeHost(host, `${api}/bookings`, DEMO_DIRECTORY, product)).toEqual({ action: "next" });
    }
  });
});

describe("the receipt on a live salon's page", () => {
  const NOW = new Date("2026-11-16T10:00:00+01:00");
  const base = createDemoState("2026-11-16");
  const state = publicSalonView({ ...base, salon: { ...base.salon, slug } }, NOW);
  const service = state.services[0];
  const visit = {
    id: "ref-fictional", customerId: "", staffId: service.staffIds[0], serviceId: service.id, date: "2026-11-24", start: 600, duration: service.duration, price: service.price,
    status: "booked" as const, source: "online" as const, protection: { terms: { version: 0, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: service.price * 100, depositMinor: 0 } },
  };
  const Server = ServerSalonProvider as unknown as ComponentType<{ state: typeof state; issuedAt: string; children?: ReactNode }>;
  const render = (onBack?: () => void) => renderToString(createElement(Server, { state: { ...state, bookings: [...state.bookings, visit] }, issuedAt: "fictional-token" }, createElement(Confirmation, { id: visit.id, onBack })));

  it("shows the booking from the page's own state, not a route that is not there, and keeps the salon's own records out of reach", () => {
    const html = render(() => undefined);
    expect(html).toContain("You are booked");
    expect(html).toContain(service.name);
    expect(html).toContain(`call the salon on ${state.salon.phone}`);
    expect(html).not.toContain("/booking/");
    expect(html).not.toContain("My bookings");
    expect(html).not.toContain("Simulated");
  });

  it("goes back to the salon in place, without a link that would leave the receipt where it is", () => {
    const html = render(() => undefined);
    expect(html).toContain("<button");
    expect(html).not.toContain(`href="/boka/${slug}"`);
  });
});
