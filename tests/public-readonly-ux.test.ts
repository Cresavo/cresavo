import { afterEach, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { NextRequest } from "next/server";
import { fixtureAvailability, fixtureBookingDate, fixtureServices, fixtureStaff } from "../src/lib/public-fixtures";

vi.mock("../src/lib/locale-server", () => ({ getLocale: async () => "en" }));
vi.mock("../src/lib/domain", async () => {
  const fixtures = await import("../src/lib/public-fixtures");
  return { listServices: async () => fixtures.fixtureServices(), publicCampaigns: async () => [],
    getAvailability: async (service: string, day: string, _: unknown, staff: string) => fixtures.fixtureAvailability(service, day, staff) };
});
vi.mock("../src/lib/workspace-config", async () => {
  const { fixtureStaff } = await import("../src/lib/public-fixtures");
  return { listStaff: async () => fixtureStaff() };
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

// Inspect rendered props/children without serializing framework component types.
const snapshot = (node: unknown) => JSON.stringify(node, (key, value) =>
  key === "type" || key === "_owner" || key === "_store" ? undefined : value);

it("diagnoses closed weekend fixtures and defaults to Monday with actual slots", () => {
  const sunday = DateTime.fromISO("2026-11-15T12:00:00", { zone: "Europe/Stockholm" });
  for (const service of fixtureServices()) for (const staff of fixtureStaff()) {
    expect(fixtureAvailability(service.id, "2026-11-15", staff.id, sunday)).toEqual([]);
    const day = fixtureBookingDate({ service: service.id, staff: staff.id }, sunday);
    expect(day).toBe("2026-11-16");
    expect(fixtureAvailability(service.id, day, staff.id, sunday).length).toBeGreaterThan(0);
  }
  expect(fixtureBookingDate({}, sunday.minus({ days: 1 }))).toBe("2026-11-16");
  expect(fixtureBookingDate({}, sunday.plus({ days: 1 }))).toBe("2026-11-16");
  expect(fixtureBookingDate({}, DateTime.fromISO("2026-11-15T23:30:00Z"))).toBe("2026-11-16");
});

it("honours explicit closed/open dates and safely falls back for invalid dates/selection", () => {
  const now = DateTime.fromISO("2026-11-15T12:00:00Z");
  for (const date of ["2026-11-15", "2026-11-16", "2026-11-21"])
    expect(fixtureBookingDate({ date }, now)).toBe(date);
  for (const date of ["invalid", "2026-11-14", "2027-02-01", "2026-02-30"])
    expect(fixtureBookingDate({ date, service: "missing", staff: "missing" }, now)).toBe("2026-11-16");
});

it.each(["/", "/product", "/landing", "/en/landing", "/future-page", "/admin", "/live"])("adds shared noindex header only in read-only mode: %s", async (path) => {
  const { proxy } = await import("../src/proxy");
  vi.stubEnv("PUBLIC_READONLY", "1");
  expect(proxy(new NextRequest(`http://localhost${path}`)).headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  vi.stubEnv("PUBLIC_READONLY", "0");
  expect(proxy(new NextRequest(`http://localhost${path}`)).headers.has("X-Robots-Tag")).toBe(false);
});

it("hides admin entries only in public mode and passes the fixture default to the form", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
  const { default: home } = await import("../src/app/page");
  const { default: product } = await import("../src/app/product/relay");
  vi.stubEnv("BOOKING_DEMO_ACCESS", undefined);
  vi.stubEnv("PUBLIC_READONLY", "1");
  const publicHome = snapshot(await home({ searchParams: Promise.resolve({}) }));
  expect(publicHome).not.toContain('"href":"/admin');
  expect(publicHome).toContain('"initialDate":"2026-11-16"');
  expect(snapshot(await home({ searchParams: Promise.resolve({ date: "2026-11-15" }) }))).toContain('"initialDate":"2026-11-15"');
  expect(snapshot(await product())).not.toContain('"href":"/admin');
  vi.stubEnv("PUBLIC_READONLY", "0");
  const normal = snapshot(await home({ searchParams: Promise.resolve({}) }));
  expect(normal).toContain('"href":"/admin"');
  expect(normal).not.toContain('"initialDate"');
  expect(snapshot(await product())).toContain('"href":"/admin/overview"');
});

it("uses honest synthetic-demo footer copy in both landing languages", async () => {
  const { default: landing } = await import("../src/components/landing/Landing");
  expect(snapshot(landing({ language: "sv" }))).toContain("Läs-demo med påhittade data – inga riktiga bokningar");
  expect(snapshot(landing({ language: "en" }))).toContain("Read-only demo with synthetic data — no real bookings");
});
