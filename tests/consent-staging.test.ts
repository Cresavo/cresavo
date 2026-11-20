import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { NextRequest } from "next/server";
import { consentHostPathAllowed, stagingConsentPolicy, stagingConsentHost } from "../scripts/consent-channel-policy.mjs";
import { runtimePolicy } from "../scripts/client-address.mjs";
import { requireStagingConsent, STAGING_CHANNEL, STAGING_CUSTOMER, stagingApprovalLink, stagingConsentOrigin } from "../src/lib/agent-api/consent-staging";
import { assertCustomerChannelBinding, CHANNEL_CUSTOMER, CUSTOMER_CHANNEL, separateCustomerChannel } from "../src/lib/agent-api/customer-channel-lab";
import { browserHostKind, resolveHost } from "../src/concept/page/resolve";
import { consentOutcome, formatStagingTerms, stagingCopy } from "../src/app/consent/[id]/staging-copy";
import { POST } from "../src/app/consent/[id]/decision/route";
import { agentApiErrors } from "../src/lib/agent-api/errors";
import { proxy } from "../src/proxy";

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
    // Cookies are scoped by host name, not port: the owner's session would reach the gateway.
    ["the agent-facing host on another port", { BOOKING_CONSENT_ORIGIN: "https://gateway.cresavo.test:8443" }],
    ["the agent-facing host with the default port spelled out", { BOOKING_CONSENT_ORIGIN: "https://GATEWAY.cresavo.test:443" }],
    ["the agent-facing host on two other ports", { BOOKING_PUBLIC_ORIGIN: "https://salon-demo.cresavo.test:9443", BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test:8443" }],
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
  const proofed = (ip: string, id: string, body: string) => POST(new Request(`https://salon-demo.cresavo.test/consent/${id}/decision`, { method: "POST", body, headers: {
    origin: "https://salon-demo.cresavo.test", "content-type": "application/json", "x-booking-client-ip": ip,
    "x-booking-client-proof": createHmac("sha256", "synthetic-proof").update(ip).digest("hex") } }), { params: Promise.resolve({ id }) });
  it("reports a failure after the request was accepted as unconfirmed, not as a refusal", async () => {
    // The unit-test database is unreachable: the decision itself fails, which may follow a commit.
    const response = await proofed("203.0.113.20", randomUUID(), JSON.stringify({ token: "T".repeat(43), decision: "yes", proposalHash: "a".repeat(64) }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "consent_unavailable" });
    expect(consentOutcome("yes", { status: response.status })).toBe("unconfirmed");
  });
  it("limits decision requests per proposal and per client address", async () => {
    const id = randomUUID();
    for (let i = 0; i < 20; i++) expect((await proofed(`203.0.113.${30 + (i % 5)}`, id, "{}")).status).toBe(403);
    const limited = await proofed("203.0.113.40", id, "{}");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await limited.json()).toEqual({ error: "consent_rate_limited" });
    for (let i = 0; i < 60; i++) expect((await proofed("203.0.113.50", randomUUID(), "{}")).status).toBe(403);
    expect((await proofed("203.0.113.50", randomUUID(), "{}")).status).toBe(429);
    // Not a proposal ID: refused before it can create a bucket.
    expect((await proofed("203.0.113.51", "../admin", "{}")).status).toBe(403);
  });
  it("keeps the configured consent host classified as the salon in the browser", () => {
    vi.stubGlobal("window", {});
    try {
      // The browser cannot read the server-only consent setting by itself.
      expect(resolveHost("salon-demo.cresavo.test").kind).toBe("unknown");
      expect(browserHostKind("salon-demo.cresavo.test", true)).toBe("app");
      expect(browserHostKind("salon-demo.cresavo.test", false)).toBe("unknown");
      expect(browserHostKind("someone-else.example", false)).toBe("unknown");
    } finally { vi.unstubAllGlobals(); }
  });
  it("serves only the paths the consent host needs", async () => {
    const id = "0b7c3f6e-6a1d-4c11-9d0e-3f1f0c1d2e3f";
    for (const path of [`/consent/${id}`, `/consent/${id}/decision`, "/admin", "/admin/bookings/x", "/api/admin/login", "/api/v1/proposals",
      "/api/availability", "/api/locale", "/_next/static/chunks/a.js", "/favicon.ico", "/brand/icon-32.png"])
      expect(consentHostPathAllowed(path), path).toBe(true);
    for (const path of ["/", "/studio", "/boka/salong-eko", "/api/bookings", "/api/demo/session", "/oauth/authorize", "/administrator", "/consent", `/consent/${id}/x`, "/llms.txt"])
      expect(consentHostPathAllowed(path), path).toBe(false);
    const routed = (host: string, path: string) => proxy(new NextRequest(`https://${host}${path}`, { headers: { host } }));
    expect(routed("salon-demo.cresavo.test:8443", "/studio").status).toBe(404);
    expect(routed("salon-demo.cresavo.test", "/api/bookings").status).toBe(404);
    expect(routed("salon-demo.cresavo.test", `/consent/${id}`).status).not.toBe(404);
    expect(routed("localhost:3000", "/studio").status).not.toBe(404);
    vi.stubEnv("BOOKING_CONSENT_DELIVERY", undefined);
    expect(routed("salon-demo.cresavo.test", "/studio").status).not.toBe(404);
  });
});

describe("customer outcome after a decision request", () => {
  it("says nothing was approved only after a definite refusal", () => {
    expect(consentOutcome("yes", { status: 200 })).toBe("approved");
    expect(consentOutcome("no", { status: 200 })).toBe("declined");
    expect(consentOutcome("yes", { status: 403 })).toBe("invalid");
    expect(consentOutcome("yes", { status: 409, state: "used" })).toBe("used");
    expect(consentOutcome("yes", { status: 410, state: "expired" })).toBe("expired");
    expect(consentOutcome("yes", { status: 429 })).toBe("limited");
    // A lost response or any server or intermediary error after approve or decline is unknown.
    for (const response of ["network-error", { status: 500 }, { status: 502 }, { status: 503 }, { status: 504 }, { status: 409 }, { status: 400 }] as const)
      for (const phase of ["yes", "no"] as const) expect(consentOutcome(phase, response)).toBe("unconfirmed");
    // Viewing never approves anything.
    expect(consentOutcome("view", "network-error")).toBe("unavailable");
    expect(consentOutcome("view", { status: 502 })).toBe("unavailable");
    for (const locale of ["en", "sv"] as const) {
      expect(stagingCopy[locale].unconfirmed).not.toMatch(/Nothing was approved|Inget godkändes/);
      expect(stagingCopy[locale].invalid).toMatch(/Nothing was approved|Inget godkändes/);
    }
  });
});

describe("staging runner preflight", () => {
  it("never puts a malformed database URL, or its password, into the error", async () => {
    const { loopbackAdminUrl } = await import("../scripts/staging-consent/preflight.mjs");
    const password = "fictional-pass-9f3k";
    for (const value of [`postgresql://booking:${password}@[127.0.0.1:5432/postgres`, `postgresql://booking:${password}@127.0.0.1:99999/x`, `booking:${password}@127.0.0.1`]) {
      let thrown: unknown;
      try { loopbackAdminUrl(value); } catch (error) { thrown = error; }
      expect(thrown, value).toBeInstanceOf(Error);
      expect(inspect(thrown, { depth: 5 }) + String((thrown as Error).stack)).not.toContain(password);
      expect((thrown as Error).message).toMatch(/^STAGING_[A-Z_]+$/);
    }
    expect(() => loopbackAdminUrl(`postgresql://booking:${password}@db.example.test/postgres`)).toThrow(/^STAGING_DATABASE_MUST_BE_LOOPBACK$/);
    expect(loopbackAdminUrl(undefined).hostname).toBe("127.0.0.1");
  });
});

describe("published contract", () => {
  const yaml = readFileSync(new URL("../docs/agent-api-v1.openapi.yaml", import.meta.url), "utf8");
  it("declares every error code the API returns", () => {
    const listed = yaml.match(/^ {14}enum: \[(.+)\]$/m)![1].split(", ");
    expect([...listed].sort()).toEqual(Object.keys(agentApiErrors).sort());
  });
  it("declares the consent delivery failure on proposal creation", () => {
    const post = yaml.slice(yaml.indexOf("  /api/v1/proposals:"), yaml.indexOf("  /api/v1/proposals/{id}:"));
    expect(post).toContain("consent_delivery_unavailable");
    expect(post).toMatch(/^ {8}"503": \{ \$ref: "#\/components\/responses\/Error" \}$/m);
  });
});

describe("staging runner output", () => {
  it("scans the complete MCP result, not only the parsed projection", async () => {
    const { agentReply } = await import("../scripts/staging-consent/agent-reply.mjs");
    const link = "https://salon-demo.cresavo.test/consent/0b7c3f6e-6a1d-4c11-9d0e-3f1f0c1d2e3f#" + "L".repeat(43);
    const line = agentReply(1, { structuredContent: { proposal: { status: "pending" } },
      content: [{ type: "text", text: "{}" }, { type: "text", text: link }, { type: "resource", resource: { uri: link } }] });
    expect(JSON.parse(line).body).toEqual({ proposal: { status: "pending" } });
    expect(line).toContain("L".repeat(43));
  });
  it("keeps the complete process output until shutdown, also secrets registered after they were printed", async () => {
    const { capture, leakedStreams } = await import("../scripts/staging-consent/processes.mjs");
    const { registerSecret } = await import("../scripts/staging-consent/sanitize.mjs");
    const secret = "fictional-late-secret-" + "Q".repeat(20);
    capture("unit:stdout", `early line ${secret.slice(0, 10)}`);
    capture("unit:stdout", `${secret.slice(10)} split across chunks\n`);
    capture("unit:stdout", "x".repeat(300_000));
    expect(leakedStreams()).not.toContain("unit:stdout");
    registerSecret(secret);
    expect(leakedStreams()).toContain("unit:stdout");
  });
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
