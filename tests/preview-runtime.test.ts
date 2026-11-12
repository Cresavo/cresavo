import { describe, expect, it } from "vitest";
import { runtimePolicy, vercelClientAddress } from "../scripts/client-address.mjs";

describe("explicit preview ingress", () => {
  it("keeps local mode and requires the shared store on Vercel", () => {
    expect(runtimePolicy({})).toBe("local");
    expect(runtimePolicy({ VERCEL: "1", BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "postgres" })).toBe("vercel");
    for (const env of [
      { VERCEL: "1" },
      { BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "postgres" },
      { VERCEL: "1", BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "memory" },
      { VERCEL: "1", BOOKING_RUNTIME: "vercel", RATE_LIMIT_STORE: "postgres", TRUST_PROXY_IP: "1" },
      { BOOKING_RUNTIME: "typo" },
    ]) expect(() => runtimePolicy(env)).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
  });
  it("accepts only one valid platform client header without forwarding fallbacks", () => {
    expect(vercelClientAddress({ "x-real-ip": "::ffff:192.0.2.10", "x-booking-client-ip": "198.51.100.2" })).toBe("192.0.2.10");
    for (const value of [undefined, "", "192.0.2.1, 198.51.100.1", ["192.0.2.1"], "garbage"])
      expect(() => vercelClientAddress({ "x-real-ip": value, "x-forwarded-for": "192.0.2.1" })).toThrow();
  });
});
