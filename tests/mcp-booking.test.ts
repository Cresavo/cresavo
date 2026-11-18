import { describe, expect, it } from "vitest";
import { bookingSchema, idempotencyKeySchema } from "../src/lib/domain";
import {
  bookingModeAllowed,
  mcpBookingSchema,
  mcpWorkspaceBookingSchema,
} from "../src/mcp/booking";

const valid = {
  serviceId: "fotvard",
  start: "2026-11-16T09:00:00+01:00",
  customerName: "Syntetisk testkund",
  customerEmail: "syntetisk@example.test",
  clientRequestId: "synthetic-request-1",
  confirmed: true,
};

describe("Lokalt MCP-bokningskontrakt", () => {
  it("customer IDs require the workspace schema and still undergo strict validation", () => {
    const { customerName: _name, customerEmail: _email, ...rest } = valid;
    void _name;
    void _email;
    const linked = { ...rest, customerId: "known-synthetic-customer" };
    expect(mcpBookingSchema.safeParse(linked).success).toBe(false);
    expect(mcpWorkspaceBookingSchema.safeParse(linked).success).toBe(true);
    expect(mcpWorkspaceBookingSchema.safeParse(rest).success).toBe(false);
    expect(
      mcpWorkspaceBookingSchema.safeParse({ ...linked, businessId: "other" })
        .success,
    ).toBe(false);
    expect(
      mcpWorkspaceBookingSchema.safeParse({
        ...valid,
        customerEmail: "someone@example.com",
      }).success,
    ).toBe(false);
  });
  it("reuses domain fields without restricting existing HTTP email input", () => {
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
  ])("rejects invalid MCP input %#", (input) => {
    expect(mcpBookingSchema.safeParse(input).success).toBe(false);
  });
  it("requires two explicit flags and the quota secret before enabling writes", () => {
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
