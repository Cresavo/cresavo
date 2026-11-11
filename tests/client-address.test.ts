import { describe, expect, it, vi } from "vitest";
import {
  proxyPolicy,
  resolveClientAddress,
  addressProof,
  verifiedClientAddress,
} from "../scripts/client-address.mjs";
import {
  adminBookingFilter,
  campaignSchema,
  emailCapKey,
} from "../src/lib/domain";
import { safeFailure } from "../src/lib/errors";

describe("Socketbaserad klientidentitet", () => {
  it("använder socket i standardläge och accepterar forwarding endast från listad proxy/CIDR", () => {
    expect(
      resolveClientAddress("::ffff:127.0.0.2", "192.0.2.1", proxyPolicy("0")),
    ).toBe("127.0.0.2");
    const trusted = proxyPolicy("1", "127.0.0.10/32,2001:db8::/32");
    expect(resolveClientAddress("127.0.0.2", "192.0.2.1", trusted)).toBe(
      "127.0.0.2",
    );
    expect(resolveClientAddress("127.0.0.10", "192.0.2.1", trusted)).toBe(
      "192.0.2.1",
    );
    expect(resolveClientAddress("2001:db8::1", "192.0.2.1", trusted)).toBe(
      "192.0.2.1",
    );
    expect(resolveClientAddress("127.0.0.10", "invalid", trusted)).toBe(
      "127.0.0.10",
    );
    expect(() => proxyPolicy("1", "")).toThrow();
    expect(() => proxyPolicy("1", "127.0.0.1/banana")).toThrow();
  });
  it("verifierar intern adress och stänger utan serverns hemlighet", () => {
    const secret = "synthetic-proof",
      ip = "127.0.0.2";
    const headers = new Headers({
      "x-booking-client-ip": ip,
      "x-booking-client-proof": addressProof(ip, secret),
    });
    expect(verifiedClientAddress(headers, secret)).toBe(ip);
    expect(() => verifiedClientAddress(headers, undefined)).toThrow();
    headers.set("x-booking-client-ip", "127.0.0.3");
    expect(() => verifiedClientAddress(headers, secret)).toThrow();
  });
});
it("adminfilter faller tillbaka och kampanjfel har skilda statiska meddelanden", () => {
  const log = vi.spyOn(console, "error");
  for (const input of [
    { from: "garbage" },
    { from: "2026-11-12", to: "2027-02-01" },
    { from: "2026-11-15", to: "2026-11-12" },
  ])
    expect(adminBookingFilter(input).error).toContain("Ogiltigt datumfilter");
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
  const draft = {
    serviceId: "fotvard",
    title: "Syntetisk",
    discountPercent: 100,
    validFrom: "2026-01-01",
    validUntil: "2026-01-01",
  };
  expect(campaignSchema.safeParse(draft).success).toBe(true);
  for (const [validUntil, message] of [
    ["2025-12-31", "Slutdatum får inte vara före startdatum."],
    ["2026-04-01", "Kampanjen får gälla högst 90 kalenderdagar."],
  ]) {
    const result = campaignSchema.safeParse({ ...draft, validUntil });
    expect(result.success).toBe(false);
    expect(safeFailure(result.error).message).toBe(message);
  }
  expect(emailCapKey("X+1@example.test")).toBe("x@example.test");
});
