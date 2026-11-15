import { beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";

// Exercise a valid base64url secret containing "_" on every key creation.
// The old split("_").at(-1) assertion accidentally checked just the final "o".
vi.mock("node:crypto", async (importOriginal) => {
  const crypto = await importOriginal<typeof import("node:crypto")>();
  return {
    ...crypto,
    randomBytes: (size: number) => {
      if (size !== 32) return crypto.randomBytes(size);
      const bytes = Buffer.alloc(32, 1);
      bytes[30] = 3;
      bytes[31] = 250;
      return bytes;
    },
  };
});

type KeyRow = {
  id: string; businessId: string; agentName: string; ownerName: string;
  clientId: string; client: { id: string; businessId: string; active: boolean };
  ownerContact: string; keyPrefix: string; keyHash: string; scopes: string[];
  createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null;
};
const state = vi.hoisted(() => ({
  keys: [] as KeyRow[],
  bookings: [] as { staffId: string; startsAt: Date; endsAt: Date }[],
}));

// Synthetic engine data only: one demo salon, two services, two staff.
vi.mock("../src/lib/db", () => {
  const weekly = (start: string, end: string) =>
    [1, 2, 3, 4, 5].map((weekday) => ({ weekday, periods: [{ start, end }], breaks: [] }));
  const services = [
    { id: "fotvard", businessId: "demo", name: "Fotvård", duration: 60, priceOre: 65000, buffer: 0, active: true, version: 1 },
    { id: "massage", businessId: "demo", name: "Massage", duration: 30, priceOre: 45000, buffer: 0, active: true, version: 2 },
  ];
  const staff = [
    { id: "staff-demo", businessId: "demo", name: "Anna", active: true, serviceIds: ["fotvard", "massage"], weekly: weekly("09:00", "11:00"), exceptions: [] },
    { id: "staff-erik", businessId: "demo", name: "Erik", active: true, serviceIds: ["massage"], weekly: weekly("10:00", "11:00"), exceptions: [] },
  ];
  const match = (row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean =>
    Object.entries(where).every(([k, v]) =>
      k === "OR" ? (v as Record<string, unknown>[]).some((w) => match(row, w)) : row[k] === v);
  return {
    db: {
      agentApiKey: {
        create: async ({ data }: { data: Omit<KeyRow, "id" | "businessId" | "clientId" | "client" | "createdAt" | "lastUsedAt" | "revokedAt"> & { client: { create: { id: string; businessId: string } } } }) => {
          const identity = data.client.create;
          const row = { ...data, id: `key-${state.keys.length + 1}`, businessId: identity.businessId, clientId: identity.id, client: { ...identity, active: true }, createdAt: new Date(), lastUsedAt: null, revokedAt: null };
          state.keys.push(row);
          return row;
        },
        findUnique: async ({ where }: { where: { keyPrefix: string } }) =>
          state.keys.find((k) => k.keyPrefix === where.keyPrefix) ?? null,
        findMany: async ({ where }: { where: Record<string, unknown> }) => state.keys.filter((k) => match(k, where)),
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<KeyRow> }) => {
          const rows = state.keys.filter((k) => match(k, where));
          rows.forEach((r) => Object.assign(r, data));
          return { count: rows.length };
        },
      },
      service: {
        findMany: async ({ where }: { where: { businessId: string; active?: boolean } }) =>
          services.filter((s) => s.businessId === where.businessId && (where.active === undefined || s.active)),
        findFirst: async ({ where }: { where: { id: string; businessId: string } }) =>
          services.find((s) => s.id === where.id && s.businessId === where.businessId) ?? null,
      },
      staff: {
        findMany: async ({ where }: { where: { businessId: string } }) => staff.filter((s) => s.businessId === where.businessId),
        findFirst: async ({ where }: { where: { id: string; businessId: string } }) =>
          staff.find((s) => s.id === where.id && s.businessId === where.businessId) ?? null,
      },
      booking: {
        findMany: async ({ where }: { where: { staffId: string } }) => state.bookings.filter((b) => b.staffId === where.staffId),
      },
    },
  };
});

const { db } = await import("../src/lib/db");
const { createAgentApiKey, hashApiKey, revokeAgentApiKey, listAgentApiKeys } = await import("../src/lib/agent-api/keys");
const services = await import("../src/app/api/v1/services/route");
const availability = await import("../src/app/api/v1/availability/route");

// A future weekday inside the engine's 60-day window.
let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 3 });
while (day.weekday > 5) day = day.plus({ days: 1 });
const DAY = day.toISODate()!;

const get = (route: { GET: (r: Request) => Promise<Response> }, path: string, h: Record<string, string> = {}) =>
  route.GET(new Request(`http://localhost${path}`, { headers: h }));
const bearer = (key: string) => ({ authorization: `Bearer ${key}` });

async function newKey(over: Record<string, unknown> = {}) {
  return createAgentApiKey(
    { businessId: "demo", agentName: "Synthetic test agent", ownerName: "Test Owner", ownerContact: "owner@example.test", ...over },
    db,
  );
}

beforeEach(() => {
  state.keys.length = 0;
  state.bookings.length = 0;
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

describe("agent API keys", () => {
  it("stores only a hash and shows the plaintext key once", async () => {
    const { key, record } = await newKey();
    expect(key).toMatch(/^blk_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
    expect(key).toMatch(/_o$/);
    const stored = JSON.stringify(state.keys);
    expect(stored).not.toContain(key);
    expect(stored).not.toContain(key.slice("blk_000000000000_".length));
    expect(state.keys[0].keyHash).toBe(hashApiKey(key));
    expect(state.keys[0].keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(record)).not.toContain(key.slice("blk_000000000000_".length));
    expect(record).toMatchObject({ agentName: "Synthetic test agent", ownerName: "Test Owner", ownerContact: "owner@example.test", businessId: "demo" });
    const listed = JSON.stringify(await listAgentApiKeys(db));
    expect(listed).not.toContain("keyHash");
    expect(listed).not.toContain(key.slice("blk_000000000000_".length));
  });

  it("requires agent name, owner and contact", async () => {
    await expect(newKey({ ownerName: "" })).rejects.toThrow();
    await expect(newKey({ agentName: undefined })).rejects.toThrow();
    await expect(newKey({ ownerContact: undefined })).rejects.toThrow();
  });
});

describe("GET /api/v1 authentication", () => {
  it("rejects a missing key", async () => {
    const res = await get(services, "/api/v1/services?business=demo");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Bearer");
    expect(await res.json()).toEqual({ apiVersion: "v1", error: { code: "unauthorized", message: "A valid API key is required." } });
  });

  it("rejects malformed, unknown and tampered keys", async () => {
    const { key } = await newKey();
    for (const bad of ["nope", `${key}x`, key.slice(0, -1) + (key.endsWith("A") ? "B" : "A"), `blk_000000000000_${"a".repeat(43)}`])
      expect((await get(services, "/api/v1/services?business=demo", bearer(bad))).status).toBe(401);
  });

  it("rejects a revoked key", async () => {
    const { key, record } = await newKey();
    expect((await get(services, "/api/v1/services?business=demo", bearer(key))).status).toBe(200);
    expect(await revokeAgentApiKey(record.keyPrefix, db)).toBe(1);
    const res = await get(services, "/api/v1/services?business=demo", bearer(key));
    expect(res.status).toBe(401);
  });

  it("rejects an inactive stable client even when its key is valid", async () => {
    const { key } = await newKey();
    state.keys[0].client.active = false;
    expect((await get(services, "/api/v1/services?business=demo", bearer(key))).status).toBe(401);
  });

  it("accepts X-API-Key and refuses conflicting credentials", async () => {
    const { key } = await newKey();
    const other = (await newKey()).key;
    expect((await get(services, "/api/v1/services?business=demo", { "x-api-key": key })).status).toBe(200);
    expect((await get(services, "/api/v1/services?business=demo", { ...bearer(key), "x-api-key": other })).status).toBe(401);
  });

  it("denies cross-business access (object-level authorisation)", async () => {
    const { key } = await newKey({ businessId: "other-salon" });
    for (const route of [services, availability]) {
      const res = await get(route, `/api/v1/${route === services ? "services" : "availability"}?business=demo&service=fotvard&date=${DAY}`, bearer(key));
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("forbidden_business");
    }
    // Own but unknown business: no fallback to the demo data.
    const own = await get(services, "/api/v1/services?business=other-salon", bearer(key));
    expect(own.status).toBe(404);
  });

  it("enforces scopes", async () => {
    const { key } = await newKey({ scopes: ["services:read"] });
    const res = await get(availability, `/api/v1/availability?business=demo&service=fotvard&date=${DAY}`, bearer(key));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("forbidden_scope");
  });

  it("records last use and logs the agent name without key material", async () => {
    const { key } = await newKey();
    await get(services, "/api/v1/services?business=demo", bearer(key));
    expect(state.keys[0].lastUsedAt).toBeInstanceOf(Date);
    const lines = vi.mocked(console.info).mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes("Synthetic test agent"))).toBe(true);
    expect(lines.join("\n")).not.toContain(key.slice("blk_000000000000_".length));
  });
});

describe("GET /api/v1/services", () => {
  it("lists services in the standard format", async () => {
    const { key } = await newKey();
    const res = await get(services, "/api/v1/services?business=demo", bearer(key));
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.business).toEqual({ id: "demo", name: "Salong Eko (synthetic demo)", timeZone: "Europe/Stockholm", locationId: "demo-location" });
    expect(body.services[0]).toEqual({
      id: "fotvard", name: "Fotvård", durationMinutes: 60, bufferMinutes: 0,
      price: { amountMinor: 65000, currency: "SEK" }, version: 1,
      staff: [{ id: "staff-demo", name: "Anna" }],
    });
  });

  it("requires the business parameter", async () => {
    const { key } = await newKey();
    const res = await get(services, "/api/v1/services", bearer(key));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_request");
  });
});

describe("GET /api/v1/availability", () => {
  it("returns ISO 8601 slots with Stockholm offset, duration, service and staff", async () => {
    const { key } = await newKey();
    const res = await get(availability, `/api/v1/availability?business=demo&service=massage&date=${DAY}`, bearer(key));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.range).toEqual({ from: DAY, to: DAY, timeZone: "Europe/Stockholm" });
    const offset = DateTime.fromISO(`${DAY}T09:00`, { zone: "Europe/Stockholm" }).toFormat("ZZ");
    expect(body.slots[0]).toEqual({
      start: `${DAY}T09:00:00${offset}`, end: `${DAY}T09:30:00${offset}`,
      durationMinutes: 30, serviceId: "massage", serviceVersion: 2,
      locationId: "demo-location", scheduleId: "staff-schedule:staff-demo",
      staff: { id: "staff-demo", name: "Anna" },
    });
    // Anna 09–11 (4 slots) + Erik 10–11 (2 slots), sorted by start then staff.
    expect(body.slots.map((s: { start: string; staff: { id: string } }) => `${s.start.slice(11, 16)} ${s.staff.id}`)).toEqual([
      "09:00 staff-demo", "09:30 staff-demo", "10:00 staff-demo", "10:00 staff-erik", "10:30 staff-demo", "10:30 staff-erik",
    ]);
  });

  it("excludes booked times using the engine's own availability", async () => {
    const { key } = await newKey();
    const start = DateTime.fromISO(`${DAY}T09:00`, { zone: "Europe/Stockholm" });
    state.bookings.push({ staffId: "staff-demo", startsAt: start.toJSDate(), endsAt: start.plus({ minutes: 60 }).toJSDate() });
    const res = await get(availability, `/api/v1/availability?business=demo&service=fotvard&date=${DAY}`, bearer(key));
    const body = await res.json();
    expect(body.slots.map((s: { start: string }) => s.start.slice(11, 16))).toEqual(["10:00"]);
  });

  it("filters by staff and supports from/to ranges", async () => {
    const { key } = await newKey();
    const to = day.plus({ days: 1 }).toISODate();
    const res = await get(availability, `/api/v1/availability?business=demo&service=massage&from=${DAY}&to=${to}&staff=staff-erik`, bearer(key));
    const body = await res.json();
    expect(body.range).toMatchObject({ from: DAY, to });
    expect(body.slots.every((s: { staff: { id: string } }) => s.staff.id === "staff-erik")).toBe(true);
  });

  it("returns stable error codes for bad input", async () => {
    const { key } = await newKey();
    const cases: [string, number, string][] = [
      [`service=nope&date=${DAY}`, 404, "service_not_found"],
      [`service=fotvard&date=${DAY}&staff=staff-erik`, 404, "staff_not_found"],
      [`service=fotvard&date=2026-02-30`, 400, "invalid_request"],
      [`service=fotvard`, 400, "invalid_request"],
      [`service=fotvard&date=${DAY}&from=${DAY}`, 400, "invalid_request"],
      [`service=fotvard&from=${DAY}&to=${day.plus({ days: 14 }).toISODate()}`, 400, "range_too_large"],
    ];
    for (const [q, status, code] of cases) {
      const res = await get(availability, `/api/v1/availability?business=demo&${q}`, bearer(key));
      expect([q, res.status]).toEqual([q, status]);
      expect((await res.json()).error.code).toBe(code);
    }
  });
});
