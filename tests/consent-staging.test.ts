import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { stagingConsentPolicy, stagingConsentHost } from "../scripts/consent-channel-policy.mjs";
import { runtimePolicy } from "../scripts/client-address.mjs";
import { requireStagingConsent, STAGING_CHANNEL, STAGING_CUSTOMER, stagingApprovalLink, stagingConsentOrigin } from "../src/lib/agent-api/consent-staging";
import { assertCustomerChannelBinding, CHANNEL_CUSTOMER, CUSTOMER_CHANNEL, separateCustomerChannel } from "../src/lib/agent-api/customer-channel-lab";
import { resolveHost } from "../src/concept/page/resolve";
import { formatStagingTerms } from "../src/app/consent/[id]/staging-copy";
import { POST } from "../src/app/consent/[id]/decision/route";

// Fictional configuration only.
const staging = {
  BOOKING_SERVICE_ROLE: "salon", GATEWAY_SERVICE_TOKEN: "a".repeat(64),
  BOOKING_PUBLIC_ORIGIN: "https://gateway.cresavo.test", BOOKING_CONSENT_DELIVERY: "staging-inbox",
  BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test",
};

describe("staging channel configuration", () => {
  it("is off unless explicitly requested", () => {
    expect(stagingConsentPolicy({})).toBeNull();
    expect(stagingConsentPolicy({ ...staging, BOOKING_CONSENT_DELIVERY: "separate-lab" })).toBeNull();
    expect(stagingConsentPolicy({ ...staging, BOOKING_CONSENT_DELIVERY: undefined })).toBeNull();
  });
  it("returns the configured HTTPS origin, not a request header", () => {
    expect(stagingConsentPolicy(staging)).toBe("https://salon-demo.cresavo.test");
    expect(stagingConsentPolicy({ ...staging, BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test:8443" })).toBe("https://salon-demo.cresavo.test:8443");
  });
  it.each([
    ["the standalone role", { BOOKING_SERVICE_ROLE: undefined }],
    ["a misspelled role", { BOOKING_SERVICE_ROLE: "salong" }],
    ["a missing service token", { GATEWAY_SERVICE_TOKEN: undefined }],
    ["the public read-only fixture mode", { PUBLIC_READONLY: "1" }],
    ["the SMS lab", { BOOKING_SMS_OTP_LAB: "1" }],
    ["the local consent lab", { BOOKING_CONSENT_LAB: "1" }],
    ["a lab inbox directory", { BOOKING_CONSENT_INBOX_DIR: "/tmp/booking-consent-inbox-x" }],
    ["a missing consent origin", { BOOKING_CONSENT_ORIGIN: undefined }],
    ["plain HTTP", { BOOKING_CONSENT_ORIGIN: "http://salon-demo.cresavo.test" }],
    ["plain HTTP on loopback", { BOOKING_CONSENT_ORIGIN: "http://127.0.0.1:3217" }],
    ["a path", { BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test/consent" }],
    ["a query", { BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test/?x=1" }],
    ["a fragment", { BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test/#" }],
    ["credentials", { BOOKING_CONSENT_ORIGIN: "https://user:pass@salon-demo.cresavo.test" }],
    ["the agent-facing origin", { BOOKING_CONSENT_ORIGIN: "https://gateway.cresavo.test" }],
    ["a missing public origin", { BOOKING_PUBLIC_ORIGIN: undefined }],
  ])("refuses %s", (_name, patch) => {
    const env = { ...staging, ...patch };
    expect(() => stagingConsentPolicy(env)).toThrow();
    expect(stagingConsentHost(env)).toBeNull();
    expect(() => stagingConsentOrigin(env)).toThrow("authorised mandate");
  });
  it("stops the server at start when half-configured, and starts when complete", () => {
    expect(runtimePolicy({ ...staging })).toBe("local");
    expect(() => runtimePolicy({ ...staging, BOOKING_CONSENT_ORIGIN: "http://salon-demo.cresavo.test" })).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
    expect(() => runtimePolicy({ ...staging, PUBLIC_READONLY: "1" })).toThrow("BOOKING_RUNTIME_CONFIG_INVALID");
    // An unrelated or lab mode keeps its existing request-time behaviour.
    expect(runtimePolicy({ BOOKING_CONSENT_DELIVERY: "separate-lab" })).toBe("local");
  });
  it("keeps the local lab channel separate", () => {
    vi.stubEnv("BOOKING_CONSENT_DELIVERY", "staging-inbox");
    try { expect(separateCustomerChannel()).toBe(false); } finally { vi.unstubAllEnvs(); }
  });
});

describe("staging link and recipient", () => {
  const id = "0b7c3f6e-6a1d-4c11-9d0e-3f1f0c1d2e3f", token = "T".repeat(43);
  it("builds the link from the configured origin with the secret in the fragment", () => {
    const url = new URL(stagingApprovalLink("https://salon-demo.cresavo.test", id, token));
    expect(url.origin).toBe("https://salon-demo.cresavo.test");
    expect(url.pathname).toBe(`/consent/${id}`);
    expect(url.search).toBe("");
    expect(url.hash).toBe(`#${token}`);
    expect(() => stagingApprovalLink("https://salon-demo.cresavo.test", "../x", token)).toThrow();
    expect(() => stagingApprovalLink("https://salon-demo.cresavo.test", id, "short")).toThrow();
  });
  it("binds the booking contact to the fixed fictional recipient of each channel", () => {
    const proposal = { consentDelivery: STAGING_CHANNEL }, mandate = { verifiedVia: STAGING_CHANNEL };
    expect(STAGING_CUSTOMER.email.endsWith("@example.test")).toBe(true);
    expect(() => assertCustomerChannelBinding(proposal, mandate, STAGING_CUSTOMER)).not.toThrow();
    expect(() => assertCustomerChannelBinding(proposal, mandate, CHANNEL_CUSTOMER)).toThrow();
    expect(() => assertCustomerChannelBinding(proposal, mandate, { ...STAGING_CUSTOMER, email: "other@example.test" })).toThrow();
    expect(() => assertCustomerChannelBinding(proposal, { verifiedVia: CUSTOMER_CHANNEL }, STAGING_CUSTOMER)).toThrow();
    expect(() => assertCustomerChannelBinding({ consentDelivery: null }, mandate, STAGING_CUSTOMER)).toThrow();
    expect(() => assertCustomerChannelBinding({ consentDelivery: CUSTOMER_CHANNEL }, { verifiedVia: CUSTOMER_CHANNEL }, CHANNEL_CUSTOMER)).not.toThrow();
  });
  it("formats terms in the salon's time zone", () => {
    const shown = formatStagingTerms("en", "Europe/Stockholm", { start: "2026-12-07T09:30:00Z", expiresAt: "2026-12-01T08:00:00Z", amountMinor: 52000, currency: "SEK" });
    expect(shown.time).toBe("10:30");
    expect(shown.date).toMatch(/^Monday,? 7 December 2026$/);
    expect(shown.price).toContain("520.00");
  });
});

describe("staging host and customer endpoint", () => {
  beforeEach(() => { for (const [k, v] of Object.entries(staging)) vi.stubEnv(k, v); vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-proof"); });
  afterEach(() => vi.unstubAllEnvs());
  it("serves the salon app only on the configured consent host", () => {
    expect(resolveHost("salon-demo.cresavo.test:8443")).toEqual({ kind: "app" });
    expect(resolveHost("gateway.cresavo.test")).not.toEqual({ kind: "app" });
    vi.stubEnv("BOOKING_CONSENT_DELIVERY", undefined);
    expect(resolveHost("salon-demo.cresavo.test")).not.toEqual({ kind: "app" });
  });
  it("requires the consent origin and no agent credentials, but not loopback", async () => {
    const request = (headers: Record<string, string | undefined>) => {
      const ip = "203.0.113.9";
      return POST(new Request("https://salon-demo.cresavo.test/consent/x/decision", { method: "POST", body: "{}", headers: {
        "content-type": "application/json", "x-booking-client-ip": ip,
        "x-booking-client-proof": createHmac("sha256", "synthetic-proof").update(ip).digest("hex"), ...headers } }), { params: Promise.resolve({ id: "x" }) });
    };
    for (const headers of [{ origin: "https://gateway.cresavo.test" }, { origin: "http://127.0.0.1:3217" }, {},
      { origin: "https://salon-demo.cresavo.test", authorization: "Bearer synthetic-agent" },
      { origin: "https://salon-demo.cresavo.test", "x-api-key": "synthetic-agent" }]) {
      const response = await request(headers);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("synthetic-agent");
    }
    expect(requireStagingConsent()).toBe("https://salon-demo.cresavo.test");
  });
});

describe("staging runner output", () => {
  it("redacts links, keys, tokens, cookies and database URLs but keeps check codes", async () => {
    const { registerSecret, sanitize } = await import("../scripts/staging-consent/sanitize.mjs");
    registerSecret("fictional-registered-value");
    const line = sanitize([
      "PASS CUSTOMER_PAGE_SHOWS_EXACT_TERMS_AND_OPENING_APPROVES_NOTHING",
      "https://salon-demo.cresavo.test/consent/0b7c3f6e-6a1d-4c11-9d0e-3f1f0c1d2e3f#" + "S".repeat(43),
      "blk_abc_def", "booking_admin=abc", "postgresql://booking:booking@127.0.0.1/x_test",
      "a".repeat(64), "fictional-registered-value", "authorization: Bearer x",
    ].join(" "));
    expect(line).toContain("CUSTOMER_PAGE_SHOWS_EXACT_TERMS_AND_OPENING_APPROVES_NOTHING");
    for (const leaked of ["S".repeat(43), "blk_", "booking_admin=abc", "postgresql://", "a".repeat(64), "fictional-registered-value", "Bearer"])
      expect(line).not.toContain(leaked);
  });
});
