import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as CANCEL } from "@/app/api/public/salons/[slug]/bookings/[id]/cancel/route";
import { POST as MOVE } from "@/app/api/public/salons/[slug]/bookings/[id]/move/route";
import { bookingTokenExpiry, mintBookingToken } from "@/lib/booking-token";
import { createDemoState } from "@/concept/data/generate";
import type { Booking } from "@/concept/data/types";
import { addressProof } from "../scripts/client-address.mjs";

// A customer's cancel and move from their link: every status the routes map,
// the token checks and the guards. Stub database and store, fixed clock,
// fictional data.

const NOW = new Date("2026-11-16T10:00:00+01:00");
const SECRET = "synthetic-address-secret";
const SLUG = "salong-fiktiv";
const TENANT = "tenant-fiktiv";
const REF = "0b7e2c1a-4d5f-4a6b-9c8d-1e2f3a4b5c6d";

const query = vi.hoisted(() => vi.fn());
const apply = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { $queryRaw: query } }));
vi.mock("@/lib/owner-store", () => ({ ownerStore: () => ({ apply }) }));

const base = createDemoState("2026-11-16");
const booking: Booking = {
  id: "b-1", publicRef: REF, customerId: base.customers[0].id, staffId: base.staff[0].id, serviceId: base.services[0].id, date: "2026-11-24", start: 600, duration: 60,
  price: 500, status: "booked", source: "online", note: "Private note",
  protection: { terms: { version: 1, freeHours: 24, latePercent: 0, noShowPercent: 0, currency: "SEK", priceMinor: 50000, depositMinor: 0 } },
};
const doc = (over: Partial<Booking> = {}) => ({ ...base, salon: { ...base.salon, slug: SLUG }, bookings: [{ ...booking, ...over }] });
const scope = { tenantId: TENANT, bookingId: "b-1", ref: REF, customerId: booking.customerId, purpose: "manage" };
const goodToken = () => mintBookingToken(scope, bookingTokenExpiry(booking));
const committed = (over: Partial<Booking> = {}, replayed = false) => ({ ok: true, replayed, version: 2, effects: [], entry: {}, state: doc(over) });

let counter = 0;
function post(handler: typeof CANCEL, body: unknown, { id = REF, key = `key-${++counter}`, origin = "http://localhost" }: { id?: string; key?: string | null; origin?: string } = {}) {
  const ip = `10.3.${Math.floor(counter / 250)}.${counter++ % 250}`;
  return handler(new NextRequest(`http://localhost/api/public/salons/${SLUG}/bookings/${id}/x`, {
    method: "POST", body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json", host: "localhost", origin, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET),
      ...(key === null ? {} : { "idempotency-key": key }),
    },
  }), { params: Promise.resolve({ slug: SLUG, id }) });
}
const move = (over: Record<string, unknown> = {}) => ({ token: goodToken(), staffId: booking.staffId, date: "2026-11-25", start: 540, ...over });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  query.mockReset().mockImplementation(async () => [{ tenant_id: TENANT, doc: doc() }]);
  apply.mockReset().mockResolvedValue(committed({ status: "cancelled" }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("POST …/bookings/[id]/cancel", () => {
  it("cancels and answers with the updated public view, building the action itself", async () => {
    const response = await post(CANCEL, { token: goodToken() }, { key: "cancel-key-1" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { booking: view } = await response.json();
    expect(view).toMatchObject({ status: "cancelled", date: "2026-11-24" });
    expect(JSON.stringify(view)).not.toContain("Private note");
    expect(apply).toHaveBeenCalledWith(TENANT, { type: "online/cancel", id: "b-1", at: { date: "1970-01-01", time: 0 }, public: { slug: SLUG } },
      { actor: "customer", source: "customer-page" }, { idempotencyKey: "booking-cancel:cancel-key-1" });
  });

  it("says call_salon after the deadline, not_changeable for a finished visit and slot_unavailable never", async () => {
    apply.mockResolvedValue({ ok: false, reason: "rejected", version: 2 });
    query.mockImplementation(async () => [{ tenant_id: TENANT, doc: doc({ date: "2026-11-16", start: 960 }) }]);
    const late = await post(CANCEL, { token: mintBookingToken(scope, bookingTokenExpiry({ ...booking, date: "2026-12-01" })) });
    expect(late.status).toBe(409);
    expect(await late.json()).toEqual({ error: "call_salon" });
    query.mockImplementation(async () => [{ tenant_id: TENANT, doc: doc({ status: "cancelled" }) }]);
    const again = await post(CANCEL, { token: goodToken() });
    expect([again.status, await again.json()]).toEqual([409, { error: "not_changeable" }]);
  });

  it("maps a busy store to 503 with Retry-After, a reused key to 422 and a vanished salon to 404", async () => {
    apply.mockResolvedValue({ ok: false, reason: "conflict", version: 3 });
    const busy = await post(CANCEL, { token: goodToken() });
    expect([busy.status, busy.headers.get("retry-after")]).toEqual([503, "1"]);
    apply.mockResolvedValue({ ok: false, reason: "idempotency-mismatch", version: 3 });
    expect((await post(CANCEL, { token: goodToken() })).status).toBe(422);
    apply.mockResolvedValue({ ok: false, reason: "not-found" });
    expect((await post(CANCEL, { token: goodToken() })).status).toBe(404);
  });

  it("answers every bad token with the same 404 and never reaches the store", async () => {
    const good = goodToken();
    const [v, id, exp, mac] = good.split(".");
    const answers = await Promise.all([
      post(CANCEL, { token: [v, id, exp, `${mac.slice(0, -1)}${mac.endsWith("0") ? "1" : "0"}`].join(".") }),
      post(CANCEL, { token: mintBookingToken(scope, Math.floor(NOW.getTime() / 1000) - 10) }),
      post(CANCEL, { token: mintBookingToken({ ...scope, purpose: "view" }, bookingTokenExpiry(booking)) }),
      post(CANCEL, { token: mintBookingToken({ ...scope, tenantId: "tenant-annan" }, bookingTokenExpiry(booking)) }),
      post(CANCEL, { token: mintBookingToken({ ...scope, bookingId: "b-2", ref: "another-ref" }, bookingTokenExpiry(booking)) }),
      post(CANCEL, { token: good }, { id: "another-ref" }),
      post(CANCEL, { token: "" }),
      post(CANCEL, {}),
      post(CANCEL, "not json"),
    ]);
    for (const answer of answers) expect([answer.status, await answer.json()]).toEqual([404, { error: "not_found" }]);
    expect(apply).not.toHaveBeenCalled();
  });

  it("needs a key and a strict body, and refuses an oversized one", async () => {
    expect((await post(CANCEL, { token: goodToken() }, { key: null })).status).toBe(422);
    expect((await post(CANCEL, { token: goodToken(), extra: 1 })).status).toBe(422);
    expect((await post(CANCEL, { token: "x".repeat(3000) })).status).toBe(413);
  });

  it("is absent with the flag off, forbidden read-only and refused cross-origin", async () => {
    expect((await post(CANCEL, { token: goodToken() }, { origin: "https://evil.example" })).status).toBe(403);
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await post(CANCEL, { token: goodToken() })).status).toBe(403);
    vi.stubEnv("PUBLIC_READONLY", "");
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "");
    expect((await post(CANCEL, { token: goodToken() })).status).toBe(404);
    expect(apply).not.toHaveBeenCalled();
  });
});

describe("POST …/bookings/[id]/move", () => {
  it("moves and answers with the updated public view", async () => {
    apply.mockResolvedValue(committed({ date: "2026-11-25", start: 540 }));
    const response = await post(MOVE, move(), { key: "move-key-1" });
    expect(response.status).toBe(200);
    expect((await response.json()).booking).toMatchObject({ date: "2026-11-25", start: 540, status: "booked" });
    expect(apply).toHaveBeenCalledWith(TENANT, { type: "online/move", id: "b-1", at: { date: "1970-01-01", time: 0 }, public: { slug: SLUG }, staffId: booking.staffId, date: "2026-11-25", start: 540 },
      { actor: "customer", source: "customer-page" }, { idempotencyKey: "booking-move:move-key-1" });
  });

  it("says slot_unavailable for a time the reducer refused while the booking is still changeable", async () => {
    apply.mockResolvedValue({ ok: false, reason: "rejected", version: 2 });
    const response = await post(MOVE, move());
    expect([response.status, await response.json()]).toEqual([409, { error: "slot_unavailable" }]);
  });

  it("says call_salon after the deadline", async () => {
    apply.mockResolvedValue({ ok: false, reason: "rejected", version: 2 });
    query.mockImplementation(async () => [{ tenant_id: TENANT, doc: doc({ date: "2026-11-16", start: 960 }) }]);
    const response = await post(MOVE, move({ token: mintBookingToken(scope, bookingTokenExpiry({ ...booking, date: "2026-12-01" })) }));
    expect([response.status, await response.json()]).toEqual([409, { error: "call_salon" }]);
  });

  it("holds every field to its limit and a token for another booking to a 404", async () => {
    for (const bad of [{ start: 1440 }, { start: 600.5 }, { date: "2026-02-30" }, { staffId: "" }, { note: "free text" }]) expect((await post(MOVE, move(bad))).status).toBe(422);
    expect((await post(MOVE, move(), { id: "another-ref" })).status).toBe(404);
    expect(apply).not.toHaveBeenCalled();
  });
});
