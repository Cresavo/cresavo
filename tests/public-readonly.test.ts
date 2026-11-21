import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DateTime } from "luxon";
import { runtimePolicy } from "../scripts/client-address.mjs";
import { isPublicReadonly, publicReadonlyResponse } from "../src/lib/public-readonly";

// Fail immediately if any route import or operation tries to construct Prisma/pg.
const { construct } = vi.hoisted(() => ({ construct: vi.fn(() => { throw new Error("UNEXPECTED_DATABASE_CONSTRUCTION"); }) }));
vi.mock("../src/lib/locale-server", () => ({ getLocale: async () => "sv" }));
vi.mock("../scripts/database.mjs", () => ({ createDatabaseClient: construct }));

beforeEach(() => {
  vi.stubEnv("PUBLIC_READONLY", "1");
  vi.stubEnv("DATABASE_URL", undefined);
  vi.stubEnv("SESSION_SECRET", undefined);
  construct.mockClear();
});
afterEach(() => {
  expect(construct).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("requires the exact flag value", () => {
  for (const value of [undefined, "", "0", "true", "01"])
    expect(isPublicReadonly({ PUBLIC_READONLY: value })).toBe(false);
  expect(isPublicReadonly({ PUBLIC_READONLY: "1" })).toBe(true);
});

// Every exported mutation, plus all admin reads, must refuse BEFORE auth/body parsing.
const routes = import.meta.glob<Record<string, unknown>>("../src/app/api/**/route.ts");
for (const [file, load] of Object.entries(routes)) {
  // The language switch and the launch waiting list stay open on the read-only demo (the list has its own validation and rate limit: tests/site-waitlist.test.ts).
  // The poster renderer stores nothing (tests/concept-poster-route.test.ts covers its origin, size and input checks).
  if (file.endsWith("/locale/route.ts") || file.endsWith("/waitlist/route.ts") || file.endsWith("/concept/poster/route.ts")) continue;
  it(`locks direct handlers: ${file.replace("../src/app", "")}`, async () => {
    const routeModule = await load();
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      if (!(method in routeModule)) continue;
      const blockedRead = file.includes("/admin/") || file.includes("/mcp/");
      if (method === "GET" && !blockedRead) continue;
      const handler = routeModule[method] as (r: NextRequest, ctx: { params: Promise<{ id: string }> }) => Response | Promise<Response>;
      const response = await handler(new NextRequest("http://localhost/api/test", { method }), {
        params: Promise.resolve({ id: "fictional" }),
      });
      expect(response.status).toBe(403);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });
}

it.each(["/admin", "/admin/customers/fictional", "/admin/bookings/new", "/api/admin/bookings"])(
  "blocks pages/APIs before rendering: %s", async (path) => {
    const { proxy } = await import("../src/proxy");
    expect(proxy(new NextRequest(`http://localhost${path}`)).status).toBe(403);
  },
);

it("blocks future mutations and permits locale/read requests only", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"])
    expect(publicReadonlyResponse(new Request("http://localhost/api/future", { method }))?.status).toBe(403);
  expect(publicReadonlyResponse(new Request("http://localhost/api/locale", { method: "POST" }))).toBeUndefined();
  expect(publicReadonlyResponse(new Request("http://localhost/"))).toBeUndefined();
  expect(publicReadonlyResponse(new Request("http://localhost/api/concept/poster", { method: "POST" }))).toBeUndefined();
  for (const method of ["PUT", "DELETE"])
    expect(publicReadonlyResponse(new Request("http://localhost/api/concept/poster", { method }))?.status).toBe(403);
  vi.stubEnv("PUBLIC_READONLY", "0");
  expect(publicReadonlyResponse(new Request("http://localhost/admin"))).toBeUndefined();
  expect(publicReadonlyResponse(new Request("http://localhost/api/bookings", { method: "POST" }))).toBeUndefined();
});

it("also prevents rendering admin components directly", async () => {
  const { default: admin } = await import("../src/app/admin/layout");
  expect(() => admin({ children: null })).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
});

it("refuses domain, key, mandate and MCP card writes before validating input", async () => {
  const { createBooking } = await import("../src/lib/domain");
  const { cancelBooking, moveBooking } = await import("../src/lib/booking-mutations");
  const { createAgentApiKey, rotateAgentApiKey, revokeAgentApiKey } = await import("../src/lib/agent-api/keys");
  const { issueSyntheticMandate } = await import("../src/lib/agent-api/mandates");
  const { createAgentBooking, cancelBookingV1 } = await import("../src/lib/agent-api/bookings");
  const { db } = await import("../src/lib/db");
  const { bookDemoTime } = await import("../src/mcp/time-card/booking");
  const { login } = await import("../src/lib/auth");
  const { verifyAdminCredentials } = await import("../src/lib/admin-accounts");
  const { LOCAL_WORKSPACE_ACTOR: actor } = await import("../src/lib/workspace-write");
  const principal = { keyId: "fixture", clientId: "fixture", keyPrefix: "fixture", businessId: "demo", agentName: "Fiction", ownerName: "Fiction", kind: "demo-script", scopes: ["bookings:write"] };
  for (const operation of [
    () => createBooking({}), () => cancelBooking({}, "request", actor), () => moveBooking({}, "request", actor),
    () => createAgentApiKey({}, db), () => rotateAgentApiKey("fixture", db), () => revokeAgentApiKey("fixture", db),
    () => issueSyntheticMandate({}, db), () => createAgentBooking(principal, "request", {}), () => cancelBookingV1(principal, "fixture"),
    () => bookDemoTime({}), () => login({ id: "fiction", credentialVersion: 1 }), () => verifyAdminCredentials({}),
  ]) await expect(operation()).rejects.toMatchObject({ status: 403 });
  const { reply } = await import("../src/mcp/reply");
  expect(await reply(() => createBooking({}))).toMatchObject({ isError: true, content: [{ text: "Access denied." }] });
});

it.each([undefined, "postgresql://synthetic@127.0.0.1:1/unused_test"])(
  "serves fixture reads without using an absent or present DB URL", async (url) => {
    vi.stubEnv("DATABASE_URL", url);
    vi.stubEnv("RATE_LIMIT_STORE", "postgres");
    const { GET: services } = await import("../src/app/api/services/route");
    const { GET: staff } = await import("../src/app/api/staff/route");
    const { GET: availability } = await import("../src/app/api/availability/route");
    const rows = await (await services()).json();
    expect(rows.map((s: { name: string }) => s.name)).toEqual(["Fotvård", "Massage"]);
    expect(rows.map((s: { priceOre: number }) => s.priceOre)).toEqual([65000, 45000]);
    expect((await (await staff(new NextRequest("http://localhost/api/staff"))).json()).map((s: { name: string }) => s.name)).toEqual(["Anna", "Erik"]);
    let next = DateTime.now().setZone("Europe/Stockholm").plus({ days: 1 }).startOf("day");
    while (next.weekday > 5) next = next.plus({ days: 1 });
    const day = next.toISODate()!;
    const slots = await (await availability(new NextRequest(`http://localhost/api/availability?serviceId=fotvard&date=${day}`))).json();
    expect(slots.length).toBe(15);
    expect(DateTime.fromISO(slots[0]).setZone("Europe/Stockholm").toFormat("HH:mm")).toBe("09:00");
    const { GET: v1services } = await import("../src/app/api/v1/services/route");
    const { GET: v1availability } = await import("../src/app/api/v1/availability/route");
    const { GET: booking } = await import("../src/app/api/v1/bookings/[id]/route");
    expect((await (await v1services(new Request("http://localhost/api/v1/services"))).json()).services).toHaveLength(2);
    const available = await v1availability(new Request(`http://localhost/api/v1/availability?business=demo&service=massage&date=${day}`));
    expect(available.status).toBe(200);
    expect((await available.json()).slots.length).toBeGreaterThan(0);
    expect((await booking(new Request("http://localhost/api/v1/bookings/fixture"), { params: Promise.resolve({ id: "fixture" }) })).status).toBe(404);
    const { publicCampaigns } = await import("../src/lib/domain");
    expect(await publicCampaigns(day)).toEqual([]);
    const { checkRateLimit } = await import("../src/lib/rate-limit");
    expect(await checkRateLimit("agent-api", "fixture")).toBeGreaterThan(0);
    const { db } = await import("../src/lib/db");
    expect(() => db.service).toThrow("Access denied.");
  },
);

it("factory refuses explicit URLs, not only the shared DB singleton", async () => {
  const { createDatabaseClient } = await vi.importActual<typeof import("../scripts/database.mjs")>("../scripts/database.mjs");
  expect(() => createDatabaseClient("postgresql://synthetic@127.0.0.1:1/unused_test")).toThrow("PUBLIC_READONLY_DATABASE_DISABLED");
});

it("accepts database-free Vercel only with exact opt-in; retains unsafe-shape rejection", () => {
  const env: Record<string, string | undefined> = { BOOKING_RUNTIME: "vercel", VERCEL: "1", PUBLIC_READONLY: "1" };
  expect(runtimePolicy(env)).toBe("vercel");
  expect(env.SESSION_SECRET?.length).toBeGreaterThanOrEqual(32);
  const original = env.SESSION_SECRET;
  runtimePolicy(env);
  expect(env.SESSION_SECRET === original).toBe(true);
  for (const flag of [undefined, "0", "true"])
    expect(() => runtimePolicy({ ...env, PUBLIC_READONLY: flag })).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
  expect(() => runtimePolicy({ ...env, TRUST_PROXY_IP: "1" })).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
  expect(() => runtimePolicy({ ...env, RATE_LIMIT_STORE: "invalid" })).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
  const normal = { ...env, PUBLIC_READONLY: "0", RATE_LIMIT_STORE: "postgres", DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/unused_test" };
  expect(runtimePolicy(normal)).toBe("vercel");
  expect(() => runtimePolicy({ ...normal, DATABASE_URL: undefined })).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
  expect(() => runtimePolicy({ ...normal, RATE_LIMIT_STORE: "memory" })).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
});


it("renders the home fixture data without a DB", async () => {
  const { default: home } = await import("../src/app/page");
  expect(await home({ searchParams: Promise.resolve({}) })).toBeTruthy();
});

it("the registered agent MCP write callbacks refuse create and cancel", async () => {
  const { McpServer } = await import("@modelcontextprotocol/server");
  const registration = vi.spyOn(McpServer.prototype, "registerTool");
  const { agentMcpServer } = await import("../src/lib/agent-api/mcp");
  const server = agentMcpServer({ keyId: "fixture", clientId: "fixture", keyPrefix: "fixture", businessId: "demo", agentName: "Fiction", ownerName: "Fiction", kind: "demo-script", scopes: ["bookings:write"] });
  try {
    for (const name of ["create_booking", "cancel_booking"]) {
      const registered = registration.mock.calls.find((call) => call[0] === name)!;
      const callback = registered[2] as unknown as (args: Record<string, string>) => Promise<{ isError?: boolean; content: { text: string }[] }>;
      const response = await callback({ idempotencyKey: "fixture", bookingId: "fixture" });
      expect(response.isError).toBe(true);
      expect(JSON.parse(response.content[0].text).error.code).toBe("forbidden_scope");
    }
  } finally { await server.close(); }
});

it("requires the gateway credential before serving any split-provider fixture", async () => {
  vi.stubEnv("BOOKING_SERVICE_ROLE", "salon");
  const { GET } = await import("../src/app/api/v1/services/route");
  const token = "ab".repeat(32);
  for (const [configured, supplied, status] of [
    [undefined, undefined, 401],
    ["bad", "bad", 401],
    [token, undefined, 401],
    [token, "cd".repeat(32), 401],
    [token, token, 403], // Split + public read-only must never skip agent authentication.
  ] as const) {
    vi.stubEnv("GATEWAY_SERVICE_TOKEN", configured);
    const headers = new Headers();
    if (supplied) headers.set("x-booking-gateway-token", supplied);
    const reply = await GET(new Request("http://localhost/api/v1/services", { headers }));
    expect(reply.status).toBe(status);
    expect(reply.headers.get("cache-control")).toBe("no-store");
  }
});
