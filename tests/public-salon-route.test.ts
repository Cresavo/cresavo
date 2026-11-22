import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/salons/[slug]/route";
import { addressProof } from "../scripts/client-address.mjs";

// The read-only salon route. No database: the lookup is stubbed to find nothing.

vi.mock("@/lib/db", () => ({ db: { $queryRaw: async () => [] } }));

const SECRET = "synthetic-address-secret";
const ip = "192.0.2.7";

// The proxy vouches for the client address; without its proof a read is refused.
const get = (slug = "salong-fiktiv") =>
  GET(new NextRequest(`http://localhost/api/public/salons/${slug}`, {
    headers: { "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug }) });

beforeEach(() => vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET));
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/public/salons/[slug]", () => {
  it("does not exist while public booking is off", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "");
    const response = await get();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("does not exist while owner accounts are off, even with public booking on", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "");
    expect((await get()).status).toBe(404);
  });

  it("is forbidden in read-only mode", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await get()).status).toBe(403);
  });

  it("answers 404 with a code only, never cached, for an unknown or reserved address", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
    for (const slug of ["salong-fiktiv", "demo", "Not A Slug!"]) {
      const response = await get(slug);
      expect(response.status).toBe(404);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "not_found" });
    }
  });

  it("limits how often one address may read", async () => {
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
    vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
    const statuses = new Set<number>();
    let last: Response | undefined;
    for (let i = 0; i < 121; i++) statuses.add((last = await get()).status);
    expect(last!.status).toBe(429);
    expect(statuses).toEqual(new Set([404, 429]));
    expect(await last!.json()).toEqual({ error: "rate_limited" });
    expect(Number(last!.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
