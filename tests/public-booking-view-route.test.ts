import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/public/salons/[slug]/bookings/[id]/route";
import { bookingTokenExpiry, mintBookingToken } from "@/lib/booking-token";
import { createDemoState } from "@/concept/data/generate";
import type { Booking } from "@/concept/data/types";
import { addressProof } from "../scripts/client-address.mjs";

// The read-only booking view behind the e-mail link. Stub database, fixed
// clock, fictional data.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const SECRET = "synthetic-address-secret";
const SLUG = "salong-fiktiv";
const TENANT = "tenant-fiktiv";
const REF = "0b7e2c1a-4d5f-4a6b-9c8d-1e2f3a4b5c6d";

const query = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { $queryRaw: query } }));

const base = createDemoState("2026-11-16");
const booking: Booking = {
  id: "b-1", publicRef: REF, customerId: base.customers[0].id, staffId: base.staff[0].id, serviceId: base.services[0].id, date: "2026-11-24", start: 600, duration: 60,
  price: 500, status: "booked", source: "online", note: "Private note", contactEmail: "lisa@example.test",
  protection: { terms: { version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 50000, depositMinor: 0 } },
};
const doc = { ...base, salon: { ...base.salon, slug: SLUG, phone: "08-555 01 02" }, bookings: [booking] };
const scope = { tenantId: TENANT, bookingId: "b-1", ref: REF, customerId: booking.customerId, purpose: "manage", contactEmail: "lisa@example.test" };
const goodToken = () => mintBookingToken(scope, bookingTokenExpiry(booking));

let counter = 0;
function post(body: unknown, { id = REF, slug = SLUG }: { id?: string; slug?: string } = {}) {
  const ip = `10.2.${Math.floor(counter / 250)}.${counter++ % 250}`;
  return POST(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings/${id}`, {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug, id }) });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  query.mockReset().mockResolvedValue([{ tenant_id: TENANT, doc }]);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("POST /api/public/salons/[slug]/bookings/[id]", () => {
  it("shows a valid token's booking with the allowed fields only", async () => {
    const response = await post({ token: goodToken() });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { booking: view } = await response.json();
    expect(Object.keys(view).sort()).toEqual(["closesAt", "date", "duration", "freeUntil", "salon", "serviceId", "staffFirstName", "staffId", "start", "status", "treatment"]);
    expect(view).toMatchObject({ date: "2026-11-24", start: 600, duration: 60, status: "booked", salon: { phone: "08-555 01 02" }, freeUntil: { date: "2026-11-23", time: 600 }, closesAt: Date.parse("2026-11-23T10:00:00+01:00") });
    expect(Object.keys(view.salon).sort()).toEqual(["address", "email", "phone"]);
    const text = JSON.stringify(view);
    for (const secret of ["Private note", "lisa@example.test", booking.customerId, booking.id, base.customers[0].lastName, base.customers[0].phone]) expect(text).not.toContain(secret);
  });

  it("answers every bad token with the same 404", async () => {
    const good = goodToken();
    const [v, id, exp, mac] = good.split(".");
    const answers = await Promise.all([
      post({ token: [v, id, exp, `${mac.slice(0, -1)}${mac.endsWith("0") ? "1" : "0"}`].join(".") }),
      post({ token: mintBookingToken(scope, Math.floor(NOW.getTime() / 1000) - 10) }),
      post({ token: mintBookingToken({ ...scope, tenantId: "tenant-annan" }, bookingTokenExpiry(booking)) }),
      post({ token: mintBookingToken({ ...scope, purpose: "cancel" }, bookingTokenExpiry(booking)) }),
      post({ token: good }, { id: "another-ref" }),
      post({ token: "" }),
      post({ token: good, extra: 1 }),
      post("not json"),
      post({}),
    ]);
    for (const answer of answers) {
      expect(answer.status).toBe(404);
      expect(await answer.json()).toEqual({ error: "not_found" });
    }
    query.mockResolvedValue([]); // an unknown address
    expect((await post({ token: good })).status).toBe(404);
  });

  it("stops at a week after the visit as it stands now, even when the token was signed for a later one", async () => {
    // Signed when the visit was a month later; the owner then moved it to the 24th.
    const late = mintBookingToken(scope, bookingTokenExpiry({ date: "2026-12-24", start: 600, duration: 60 }));
    vi.setSystemTime(new Date("2026-12-01T10:00:00+01:00"));
    expect((await post({ token: late })).status).toBe(200);
    vi.setSystemTime(new Date("2026-12-01T11:00:00+01:00"));
    expect((await post({ token: late })).status).toBe(404);
  });

  it("keeps a moved booking's link working until a week after the new visit, and not the old link past its own expiry", async () => {
    const moved = { ...booking, date: "2026-12-10" };
    query.mockResolvedValue([{ tenant_id: TENANT, doc: { ...doc, bookings: [moved] } }]);
    vi.setSystemTime(new Date("2026-12-05T10:00:00+01:00")); // after the old visit's week, before the new visit
    const fresh = await post({ token: mintBookingToken(scope, bookingTokenExpiry(moved)) });
    expect([fresh.status, (await fresh.json()).booking.date]).toEqual([200, "2026-12-10"]);
    expect((await post({ token: goodToken() })).status).toBe(404);
    vi.setSystemTime(new Date("2026-12-18T10:00:00+01:00")); // a week after the new visit
    expect((await post({ token: mintBookingToken(scope, bookingTokenExpiry(moved)) })).status).toBe(404);
  });

  it("refuses an oversized body", async () => {
    expect((await post({ token: "x".repeat(2000) })).status).toBe(413);
  });

  it("is forbidden in read-only mode and absent while the flag is off", async () => {
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await post({ token: goodToken() })).status).toBe(403);
    vi.stubEnv("PUBLIC_READONLY", "");
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "");
    expect((await post({ token: goodToken() })).status).toBe(404);
  });

  it("refuses a cross-origin request", async () => {
    const ip = "10.9.9.9";
    const response = await POST(new NextRequest(`http://localhost/api/public/salons/${SLUG}/bookings/${REF}`, {
      method: "POST", body: JSON.stringify({ token: goodToken() }),
      headers: { "content-type": "application/json", host: "localhost", origin: "https://evil.example", "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
    }), { params: Promise.resolve({ slug: SLUG, id: REF }) });
    expect(response.status).toBe(403);
  });
});
