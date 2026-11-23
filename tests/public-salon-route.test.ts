import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/salons/[slug]/route";
import { addressProof } from "../scripts/client-address.mjs";

// The read-only salon route. No database: the lookup is stubbed to find nothing.

const query = vi.hoisted(() => vi.fn(async () => []));
vi.mock("@/lib/db", async () => ({ db: (await import("./helpers/scoped-db")).withStoreScopes({ $queryRaw: query }) }));

const SECRET = "synthetic-address-secret";
const ip = "192.0.2.7";

// The proxy vouches for the client address; without its proof the read shares one bucket.
const get = (slug = "salong-fiktiv", headers: Record<string, string> = { "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) }) =>
  GET(new NextRequest(`http://localhost/api/public/salons/${slug}`, { headers }), { params: Promise.resolve({ slug }) });

const live = () => {
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
};

beforeEach(() => {
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  query.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/public/salons/[slug]", () => {
  it("does not exist while public booking is off", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "");
    const response = await get();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("does not exist unless owner accounts are on too", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "");
    expect((await get()).status).toBe(404);
  });

  it("is forbidden in read-only mode", async () => {
    live();
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await get()).status).toBe(403);
  });

  it("is forbidden in the demo build whatever PUBLIC_READONLY says, before any lookup", async () => {
    live();
    vi.stubEnv("NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO", "1");
    vi.stubEnv("PUBLIC_READONLY", "0");
    expect((await get()).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it("does not exist on the demo's own host, before any rate store or lookup", async () => {
    live();
    vi.stubEnv("BOOKING_RUNTIME", "vercel");
    vi.stubEnv("VERCEL", "1");
    const response = await get("salong-fiktiv", { host: "demo.book.example", "x-forwarded-host": "demo.book.example" });
    expect(response.status).toBe(404);
    expect(query).not.toHaveBeenCalled();
  });

  it("answers 404 with a code only, never cached, for an unknown, reserved or invalid address", async () => {
    live();
    for (const slug of ["salong-fiktiv", "demo", "Not A Slug!"]) {
      const response = await get(slug);
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "not_found" });
    }
  });

  it("limits how often one address may read", async () => {
    live();
    const statuses = new Set<number>();
    let last: Response | undefined;
    for (let i = 0; i < 121; i++) statuses.add((last = await get()).status);
    expect(last!.status).toBe(429);
    expect(statuses).toEqual(new Set([404, 429]));
    expect(await last!.json()).toEqual({ error: "rate_limited" });
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("answers a request with no verifiable address from the shared bucket instead of failing", async () => {
    live();
    const response = await get("salong-fiktiv", {});
    expect(response.status).toBe(404);
  });
});
