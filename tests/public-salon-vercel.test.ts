import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/public/salons/[slug]/route";

// A native Vercel function has no proxy proof: the platform's x-real-ip is the client address.

const rate = vi.hoisted(() => ({ check: vi.fn(async () => 1) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: rate.check }));
vi.mock("@/lib/db", () => ({ db: { $queryRaw: async () => [] } }));

afterEach(() => vi.unstubAllEnvs());

it("charges the platform's client address once, and does not fail for lack of a proof header", async () => {
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("BOOKING_RUNTIME", "vercel");
  vi.stubEnv("VERCEL", "1");
  const request = new NextRequest("http://localhost/api/public/salons/salong-fiktiv", { headers: { "x-real-ip": "192.0.2.44" } });
  const response = await GET(request, { params: Promise.resolve({ slug: "salong-fiktiv" }) });
  expect(response.status).toBe(404);
  expect(rate.check).toHaveBeenCalledTimes(1);
  expect(rate.check).toHaveBeenCalledWith("public-read", "192.0.2.44");
});
