import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addressProof } from "../scripts/client-address.mjs";

// A booking request that is not served (demo build, flag off, read-only mode,
// the demo's host) answers 403 or 404 without the database or the store ever
// being loaded: both modules throw if anything imports them.

vi.mock("@/lib/db", () => { throw new Error("the database was loaded"); });
vi.mock("@/lib/owner-store", () => { throw new Error("the store was loaded"); });

const SECRET = "synthetic-address-secret";
const ip = "192.0.2.9";

const ROUTES = {
  create: () => import("@/app/api/public/salons/[slug]/bookings/route"),
  view: () => import("@/app/api/public/salons/[slug]/bookings/[id]/route"),
  cancel: () => import("@/app/api/public/salons/[slug]/bookings/[id]/cancel/route"),
  move: () => import("@/app/api/public/salons/[slug]/bookings/[id]/move/route"),
};

async function post(headers: Record<string, string> = {}, route: keyof typeof ROUTES = "create") {
  const { POST } = await ROUTES[route]();
  return POST(new NextRequest(`http://localhost/api/public/salons/salong-fiktiv/bookings${route === "create" ? "" : "/ref-1"}`, {
    method: "POST", body: "{}",
    headers: { host: "localhost", origin: "http://localhost", "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET), ...headers },
  }), { params: Promise.resolve({ slug: "salong-fiktiv", id: "ref-1" }) });
}

const live = () => {
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
};

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/public/salons/[slug]/bookings before its guards have passed", () => {
  it("is absent with the flag off", async () => {
    expect((await post()).status).toBe(404);
  });

  it("is forbidden in the demo build", async () => {
    live();
    vi.stubEnv("NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO", "1");
    expect((await post()).status).toBe(403);
  });

  it("is forbidden in read-only mode", async () => {
    live();
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await post()).status).toBe(403);
  });

  it("is absent on the demo's own host", async () => {
    live();
    vi.stubEnv("BOOKING_RUNTIME", "vercel");
    vi.stubEnv("VERCEL", "1");
    expect((await post({ host: "demo.book.example", "x-forwarded-host": "demo.book.example" })).status).toBe(404);
  });

  it("refuses a foreign origin before it reads a body", async () => {
    live();
    expect((await post({ origin: "https://evil.example" })).status).toBe(403);
  });

  it.each(["view", "cancel", "move"] as const)("holds for the booking %s too", async (route) => {
    expect((await post({}, route)).status).toBe(404);
    live();
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await post({}, route)).status).toBe(403);
    vi.stubEnv("PUBLIC_READONLY", "");
    expect((await post({ origin: "https://evil.example" }, route)).status).toBe(403);
  });
});
