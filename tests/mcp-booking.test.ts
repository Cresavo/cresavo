import { describe, expect, it } from "vitest";
import { bookingSchema, idempotencyKeySchema } from "../src/lib/domain";
import { bookingModeAllowed, mcpBookingSchema } from "../src/mcp/booking";

const valid = {
  serviceId: "fotvard",
  start: "2026-11-16T09:00:00+01:00",
  customerName: "Syntetisk testkund",
  customerEmail: "syntetisk@example.test",
  clientRequestId: "synthetic-request-1",
  confirmed: true,
};

describe("Lokalt MCP-bokningskontrakt", () => {
  it("återanvänder domänfält utan att begränsa befintlig HTTP-e-post", () => {
    expect(mcpBookingSchema.parse(valid)).toEqual(valid);
    expect(
      bookingSchema.safeParse({
        ...valid,
        customerEmail: "syntetisk@example.com",
      }).success,
    ).toBe(true);
    expect(idempotencyKeySchema.safeParse("a".repeat(64)).success).toBe(true);
  });
  it.each([
    { ...valid, confirmed: false },
    { ...valid, confirmed: undefined },
    { ...valid, clientRequestId: undefined },
    { ...valid, clientRequestId: "a".repeat(65) },
    { ...valid, clientRequestId: "invalid key" },
    { ...valid, start: "2026-02-30T09:00:00+01:00" },
    { ...valid, start: "2026-11-16T09:00:00" },
    { ...valid, customerEmail: "syntetisk@example.com" },
    { ...valid, customerEmail: "syntetisk@sub.example.test" },
    { ...valid, clientAddress: "spoofed" },
  ])("avvisar otillåten MCP-indata %#", (input) => {
    expect(mcpBookingSchema.safeParse(input).success).toBe(false);
  });
  it("kräver två uttryckliga flaggor och kvothemlighet före aktivering", () => {
    const secret = "synthetic-test-secret-at-least-32-chars";
    expect(bookingModeAllowed([], undefined)).toBe(false);
    expect(bookingModeAllowed(["--admin"], undefined)).toBe(false);
    expect(() => bookingModeAllowed(["--allow-bookings"], secret)).toThrow(
      "MCP_BOOKING_CONFIG_INVALID",
    );
    expect(() =>
      bookingModeAllowed(["--admin", "--allow-bookings"], undefined),
    ).toThrow("MCP_BOOKING_CONFIG_INVALID");
    expect(() =>
      bookingModeAllowed(["--admin", "--allow-bookings"], "short"),
    ).toThrow("MCP_BOOKING_CONFIG_INVALID");
    expect(bookingModeAllowed(["--admin", "--allow-bookings"], secret)).toBe(
      true,
    );
  });
});
