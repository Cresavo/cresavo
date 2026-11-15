import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as profile } from "../src/app/.well-known/usp/route";
import { GET as llms } from "../src/app/llms.txt/route";
import { GET as schema } from "../src/app/api/v1/mcp/schema/route";
import { GET as openapi } from "../src/app/api/v1/openapi/route";
import { discoveryOrigin } from "../src/lib/agent-api/discovery";
import { mcpInputs, uspAliases } from "../src/lib/agent-api/mcp-inputs";

beforeEach(() => {
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "https://booking.example.test");
  vi.stubEnv("BOOKING_RUNTIME", "local");
});
afterEach(() => vi.unstubAllEnvs());

describe("bounded USP discovery", () => {
  it("serves versioned REST/MCP bindings, actual capabilities, no holds or checkout", async () => {
    const response = profile(), body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=60");
    expect(body.usp.version).toBe("2026-08-20");
    expect(body.usp.business).toEqual({ name: "Salong Eko (synthetic demo)", timezone: "Europe/Stockholm", currency: "SEK" });
    expect(body.usp.services["dev.usp-protocol.services"].map((s: { endpoint: string; transport: string }) => [s.transport, s.endpoint])).toEqual([
      ["rest", "https://booking.example.test/api/v1"], ["mcp", "https://booking.example.test/api/v1/mcp"],
    ]);
    expect(Object.keys(body.usp.capabilities)).toEqual([
      "dev.usp-protocol.services.catalog", "dev.usp-protocol.services.availability", "dev.usp-protocol.services.bookings",
    ]);
    expect(body.usp.capabilities["dev.usp-protocol.services.availability"][0].holds).toBe(false);
    expect(JSON.stringify(body)).not.toContain("checkout_systems");
    expect(body.authorization).toEqual({ privileged_operations_require_authentication: true, accepted_mechanisms: ["api_key"] });
    expect(body["x-booking-lab"].wire_contract).toBe("native-v1");
    expect(body["x-booking-lab"].compatibility).toContain("not implemented");
  });
  it("llms links to the real profile, REST contract and protected MCP without credentials", async () => {
    const response = llms(), text = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    for (const path of ["/.well-known/usp", "/api/v1/openapi", "/api/v1/mcp", "/api/v1/mcp/schema"])
      expect(text).toContain(`https://booking.example.test${path}`);
    expect(text).toContain("buyer.consent cannot");
    expect(text).not.toContain("blk_");
  });
  it("publishes actual native schemas instead of pointing to incompatible canonical inputs", async () => {
    const response = schema(), contract = await response.json();
    const names = contract.methods.map((m: { name: string }) => m.name);
    expect(names).toEqual(expect.arrayContaining([...Object.keys(uspAliases), "list_services", "get_availability", "create_booking", "get_booking", "cancel_booking"]));
    expect(contract["x-booking-lab-compatibility"]).toContain("not the canonical USP");
    const rest = await openapi();
    expect(rest.status).toBe(200);
    expect(rest.headers.get("content-type")).toContain("application/yaml");
    const yaml = await rest.text();
    expect(yaml).toContain("openapi: 3.1.0");
    expect(yaml).toContain("mandateId");
  });
  it.each(["http://remote.example.test", "https://user:pass@booking.example.test", "https://booking.example.test/elsewhere", "https://booking.example.test/?target=other", "not-a-url"])("fails closed on unsafe configured origin %#", value => {
    vi.stubEnv("BOOKING_PUBLIC_ORIGIN", value);
    expect(profile().status).toBe(503);
    expect(llms().status).toBe(503);
  });
  it("requires an explicit origin in Vercel and permits loopback HTTP only locally", () => {
    expect(() => discoveryOrigin({ NODE_ENV: "test", BOOKING_RUNTIME: "vercel" })).toThrow();
    expect(() => discoveryOrigin({ NODE_ENV: "production" })).toThrow();
    expect(discoveryOrigin({ NODE_ENV: "test", PORT: "3218" })).toBe("http://127.0.0.1:3218");
    expect(discoveryOrigin({ NODE_ENV: "production", BOOKING_RUNTIME: "vercel", BOOKING_PUBLIC_ORIGIN: "https://booking.example.test" })).toBe("https://booking.example.test");
  });
  it.each(["http://localhost:3218", "http://127.0.0.1:3218", "http://[::1]:3218"])("rejects Vercel loopback HTTP origin %s", value => {
    vi.stubEnv("BOOKING_RUNTIME", "vercel");
    vi.stubEnv("BOOKING_PUBLIC_ORIGIN", value);
    expect(profile().status).toBe(503);
    expect(llms().status).toBe(503);
  });
  it("native booking schema never accepts a caller-authored mandate or buyer.consent", () => {
    const input = { idempotencyKey: "proof", business: "demo", serviceId: "massage", serviceVersion: 1,
      staffId: "staff-demo", start: "2026-11-20T09:00:00+01:00", confirmed: true,
      customer: { name: "Synthetic", email: "synthetic@example.test" }, mandateId: "stored-grant" };
    expect(mcpInputs.create_booking.safeParse(input).success).toBe(true);
    for (const extra of [{ mandate: { max_price: { amount_minor: 999999, currency: "SEK" } } },
      { buyer: { consent: true } }, { locationId: "another-location" }, { scheduleId: "another-schedule" }])
      expect(mcpInputs.create_booking.safeParse({ ...input, ...extra }).success).toBe(false);
  });
});
