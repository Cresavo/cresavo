import { afterEach, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ host: "" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: request.host }),
  cookies: async () => ({ get: () => undefined }),
}));

const staging = {
  BOOKING_SERVICE_ROLE: "salon", GATEWAY_SERVICE_TOKEN: "a".repeat(64),
  BOOKING_PUBLIC_ORIGIN: "https://gateway.cresavo.test", BOOKING_CONSENT_DELIVERY: "staging-inbox", SESSION_SECRET: "fictional-session-secret-".padEnd(64, "x"),
  BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test",
};

afterEach(() => vi.unstubAllEnvs());

describe("install metadata on the consent-only host", () => {
  it("links no studio manifest from the owner and consent pages there, and keeps it everywhere else", async () => {
    for (const [name, value] of Object.entries(staging)) vi.stubEnv(name, value);
    const { generateMetadata: adminMetadata } = await import("../src/app/admin/layout");
    const { generateMetadata: consentMetadata } = await import("../src/app/consent/[id]/page");
    // The consent host does not serve /manifest.webmanifest (the allowlist is unchanged), so
    // linking it would advertise a 404 and the studio's install identity on the customer's page.
    for (const host of ["salon-demo.cresavo.test", "salon-demo.cresavo.test:8443", "SALON-DEMO.cresavo.test."]) {
      request.host = host;
      expect(await adminMetadata(), host).toEqual({ manifest: null });
      expect((await consentMetadata()).manifest, host).toBeNull();
    }
    // Any other host keeps the root's file manifest: the segments set nothing.
    request.host = "localhost:3000";
    expect(await adminMetadata()).toEqual({});
    expect("manifest" in await consentMetadata()).toBe(false);
    vi.unstubAllEnvs();
    request.host = "salon-demo.cresavo.test";
    expect(await adminMetadata(), "without the staging channel").toEqual({});
  });
});
