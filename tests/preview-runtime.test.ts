import { describe, expect, it } from "vitest";
import { runtimePolicy, vercelClientAddress } from "../scripts/client-address.mjs";

describe("explicit preview ingress", () => {
  it("keeps local mode and requires the shared store on Vercel", () => {
    const valid = {
      VERCEL: "1", BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "postgres",
      SESSION_SECRET: "synthetic-preview-secret-32-characters",
      DATABASE_URL: "postgresql://synthetic@127.0.0.1/preview_test",
    };
    expect(runtimePolicy({})).toBe("local");
    expect(runtimePolicy(valid)).toBe("vercel");
    for (const env of [
      { VERCEL: "1" },
      { BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "postgres" },
      { VERCEL: "1", BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "memory" },
      { VERCEL: "1", BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "postgres", TRUST_PROXY_IP: "1" },
      { BOOKING_RUNTIME: "typo" },
      { RATE_LIMIT_STORE: "typo" },
      { ...valid, SESSION_SECRET: "short" },
      { ...valid, DATABASE_URL: undefined },
      { ...valid, DATABASE_URL: "https://example.test" },
      { ...valid, DATABASE_URL: "postgresql://" },
    ]) expect(() => runtimePolicy(env)).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
  });
  it("rejects incomplete split configuration before the listener opens", () => {
    const split = { BOOKING_SERVICE_ROLE: "salon", GATEWAY_SERVICE_TOKEN: "ab".repeat(32) };
    expect(runtimePolicy(split)).toBe("local");
    for (const env of [
      { ...split, BOOKING_SERVICE_ROLE: "saloon" }, { ...split, BOOKING_SERVICE_ROLE: undefined },
      { BOOKING_SERVICE_ROLE: "salon" }, { ...split, GATEWAY_SERVICE_TOKEN: "short" },
      { ...split, PUBLIC_READONLY: "1" },
    ]) expect(() => runtimePolicy(env)).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
  });
  it("accepts only one valid platform client header without forwarding fallbacks", () => {
    expect(vercelClientAddress({ "x-real-ip": "::ffff:192.0.2.10", "x-booking-client-ip": "198.51.100.2" })).toBe("192.0.2.10");
    for (const value of [undefined, "", "192.0.2.1, 198.51.100.1", ["192.0.2.1"], "garbage"])
      expect(() => vercelClientAddress({ "x-real-ip": value, "x-forwarded-for": "192.0.2.1" })).toThrow();
  });
});
