import { describe, expect, it, vi } from "vitest";
import {
  proxyPolicy,
  resolveClientAddress,
  addressProof,
  verifiedClientAddress,
  proxyWarning,
  clientLimitKey,
} from "../scripts/client-address.mjs";
import {
  adminBookingFilter,
  campaignSchema,
  emailCapKey,
} from "../src/lib/domain";
import { safeFailure } from "../src/lib/errors";

describe("Socketbaserad klientidentitet", () => {
  it("avvisar för breda och ogiltiga proxy-prefix", () => {
    for (const cidr of [
      "0.0.0.0/0",
      "::/0",
      "10.0.0.0/7",
      "2001:db8::/31",
      "127.0.0.1/33",
      "::1/129",
      "::/32",
      "::/64",
      "::/80",
    ])
      expect(() => proxyPolicy("1", cidr)).toThrow("PROXY_CONFIG_INVALID");
    const trusted = proxyPolicy("1", "127.0.0.10,2001:db8::/32,::1");
    expect(trusted("127.0.0.10")).toBe(true);
    expect(trusted("2001:db8::5")).toBe(true);
    expect(trusted("::1")).toBe(true);
    expect(trusted("192.0.2.5")).toBe(false);
  });
  it("varnar en gång utan adresser vid sammanfallen proxyidentitet", () => {
    for (const mode of ["0", "1"]) {
      const log = vi.fn();
      const warn = proxyWarning(mode, proxyPolicy(mode, "127.0.0.10/32"), log);
      if (mode === "0") warn("127.0.0.10", {});
      else warn("127.0.0.10", { "x-real-ip": "192.0.2.1" });
      expect(log).not.toHaveBeenCalled();
      for (let i = 0; i < 3; i++)
        warn("127.0.0.10", { "x-forwarded-for": "192.0.2.99" });
      expect(log.mock.calls).toEqual([["PROXY_CLIENT_IDENTITY_COLLAPSED"]]);
    }
  });
  it("grupperar IPv6 per /64 men behåller separata nät och IPv4", () => {
    expect(clientLimitKey("2001:db8:1:2::1")).toBe("2001:db8:1:2::/64");
    expect(clientLimitKey("2001:0db8:0001:0002:ffff:abcd:1234:ffff")).toBe(
      clientLimitKey("2001:db8:1:2::1"),
    );
    expect(clientLimitKey("2001:db8:1:3::1")).not.toBe(
      clientLimitKey("2001:db8:1:2::1"),
    );
    expect(clientLimitKey("::1")).toBe("0:0:0:0::/64");
    expect(clientLimitKey("::ffff:192.0.2.1")).toBe("192.0.2.1");
    expect(clientLimitKey("::ffff:c000:201")).toBe("192.0.2.1");
    const ip = "2001:db8:1:2::5",
      secret = "synthetic";
    expect(
      verifiedClientAddress(
        new Headers({
          "x-booking-client-ip": ip,
          "x-booking-client-proof": addressProof(ip, secret),
        }),
        secret,
      ),
    ).toBe("2001:db8:1:2::/64");
  });
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
    expect(adminBookingFilter(input).error).toContain("Showing the default range");
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
    ["2025-12-31", "The end date cannot be before the start date."],
    ["2026-04-01", "A campaign can last up to 90 calendar days."],
  ]) {
    const result = campaignSchema.safeParse({ ...draft, validUntil });
    expect(result.success).toBe(false);
    expect(safeFailure(result.error).message).toBe(message);
  }
  expect(emailCapKey("X+1@example.test")).toBe("x@example.test");
});
