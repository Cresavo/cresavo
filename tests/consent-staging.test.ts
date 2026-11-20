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
import { consentOutcome, formatStagingTerms, parseStagingView, recheckable, retryAfterSeconds, stagingCopy } from "../src/app/consent/[id]/staging-copy";
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
    ["a trailing-dot host name", { BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test." }],
    ["a trailing-dot host name with a port", { BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test.:8443" }],
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
    const body = await response.json();
    expect(body).toEqual({ error: "consent_unavailable" });
    expect(consentOutcome("yes", { status: response.status, body })).toBe("unconfirmed");
  });
  it("limits decision requests per client address before anything else", async () => {
    // Per-proposal limits need the database and are covered by the integration tests.
    for (let i = 0; i < 60; i++) expect((await proofed("203.0.113.50", "../admin", "{}")).status).toBe(403);
    const limited = await proofed("203.0.113.50", randomUUID(), "{}");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await limited.json()).toEqual({ error: "consent_rate_limited" });
  });
  it("keeps the configured consent host classified as the salon in the browser", () => {
    vi.stubGlobal("window", {});
    try {
      // The browser cannot read the server-only consent setting by itself.
      expect(resolveHost("salon-demo.cresavo.test").kind).toBe("unknown");
      expect(browserHostKind("salon-demo.cresavo.test", true)).toBe("app");
      expect(browserHostKind("salon-demo.cresavo.test", false)).toBe("unknown");
      expect(browserHostKind("someone-else.example", false)).toBe("unknown");
      // Beneath the product domain the browser reads the consent host as a business subdomain.
      vi.stubEnv("NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN", "cresavo.com");
      expect(resolveHost("salon-demo.cresavo.com").kind).toBe("business");
      expect(browserHostKind("salon-demo.cresavo.com", true)).toBe("app");
      expect(browserHostKind("salon-demo.cresavo.com", false)).toBe("business");
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
  const denied = { error: "consent_denied" };
  const view = {
    proposal: { serviceName: "Fictional treatment", staff: { name: "Fictional Stylist" }, start: "2026-12-07T09:30:00.000Z", durationMinutes: 45,
      price: { amountMinor: 52000, currency: "SEK" }, expiresAt: "2026-12-01T08:00:00.000Z" },
    proposalHash: "a".repeat(64), customer: "Staging Demo Customer · staging-customer@example.test",
    terms: { salonName: "Salong Eko (synthetic demo)", locationId: "demo-location", locationName: "Fictional demo studio, Stockholm", timeZone: "Europe/Stockholm", currency: "SEK" },
  };
  it("reports a decision only from the salon's own JSON answer", () => {
    expect(consentOutcome("yes", { status: 200, body: { status: "approved" } })).toBe("approved");
    expect(consentOutcome("no", { status: 200, body: { status: "declined" } })).toBe("declined");
    expect(consentOutcome("yes", { status: 403, body: denied })).toBe("invalid");
    expect(consentOutcome("yes", { status: 409, body: { ...denied, state: "used" } })).toBe("used");
    // A spent link names the decision recorded with it, after a decision or on a later read.
    for (const phase of ["view", "yes", "no"] as const) {
      expect(consentOutcome(phase, { status: 409, body: { ...denied, state: "used", decision: "approved" } })).toBe("approvedEarlier");
      expect(consentOutcome(phase, { status: 409, body: { ...denied, state: "used", decision: "declined" } })).toBe("declinedEarlier");
      expect(consentOutcome(phase, { status: 409, body: { ...denied, state: "used", decision: "maybe" } })).toBe("used");
    }
    expect(stagingCopy.en.approvedEarlier).toMatch(/approved/);
    // A past approval is history: its mandate may since have expired or been used for the booking.
    for (const locale of ["en", "sv"] as const)
      expect(stagingCopy[locale].approvedEarlier).not.toMatch(/may complete|can complete|may now|kan slutföra|kan nu/);
    expect(stagingCopy.sv.approvedEarlier).toMatch(/godkände/);
    expect(stagingCopy.sv.declinedEarlier).toMatch(/avböjdes/);
    for (const locale of ["en", "sv"] as const) expect(stagingCopy[locale].unconfirmed).toContain(stagingCopy[locale].recheck.split(" ")[0]);
    expect(consentOutcome("yes", { status: 410, body: { ...denied, state: "expired" } })).toBe("expired");
    expect(consentOutcome("yes", { status: 429, body: { error: "consent_rate_limited" } })).toBe("limited");
    // A status without the salon's body (an intermediary's page) proves nothing, refusal or success.
    const unknown = ["network-error", { status: 200 }, { status: 200, body: { status: "declined" } }, { status: 204 }, { status: 201, body: { status: "approved" } },
      { status: 200, body: { status: "approved" }, redirected: true }, { status: 403 }, { status: 403, body: "<html>Forbidden</html>" },
      { status: 403, body: { error: "forbidden" } }, { status: 403, body: { ...denied, state: "used" } }, { status: 429 }, { status: 429, body: denied },
      { status: 409 }, { status: 409, body: { state: "used" } }, { status: 410, body: { ...denied, state: "used" } }, { status: 403, body: denied, redirected: true },
      { status: 500 }, { status: 500, body: { error: "consent_unavailable" } }, { status: 502 }, { status: 503 }, { status: 400 }] as const;
    for (const response of unknown) expect(consentOutcome("yes", response), JSON.stringify(response)).toBe("unconfirmed");
    expect(consentOutcome("no", { status: 200, body: { status: "approved" } })).toBe("unconfirmed");
  });
  it("never claims anything about approval when the status could not be checked", () => {
    expect(consentOutcome("view", { status: 200, body: view })).toBe("ready");
    expect(consentOutcome("view", { status: 409, body: { ...denied, state: "used" } })).toBe("used");
    expect(consentOutcome("view", { status: 410, body: { ...denied, state: "expired" } })).toBe("expired");
    // A refresh after a decision has no secret left: the salon answers 403. That is not "nothing was approved".
    for (const response of ["network-error", { status: 403, body: denied }, { status: 403 }, { status: 502 }, { status: 500, body: { error: "consent_unavailable" } }] as const)
      expect(consentOutcome("view", response)).toBe("unchecked");
    for (const locale of ["en", "sv"] as const) {
      // Neutral both ways: the request may never have reached the salon, or may have been saved.
      for (const key of ["unchecked", "unconfirmed"] as const)
        expect(stagingCopy[locale][key]).not.toMatch(/Nothing was approved|Inget godkändes|changed nothing|ändrade ingenting|answer was kept|has been saved|gäller ditt svar|har sparats/);
      expect(stagingCopy[locale].invalid).toMatch(/Nothing was approved|Inget godkändes/);
    }
    // Place descriptions are copy, translated per locale under the same location IDs.
    expect(Object.keys(stagingCopy.sv.locations)).toEqual(Object.keys(stagingCopy.en.locations));
    expect(stagingCopy.sv.locations["demo-location"]).toBe("Påhittad demostudio, Stockholm");
    expect(stagingCopy.en.locations["demo-location"]).toBe("Fictional demo studio, Stockholm");
  });
  it("renders terms only from a complete, valid view", () => {
    expect(parseStagingView(view)).toBe(view);
    const broken: unknown[] = [null, undefined, "text", [], { error: "consent_denied" }, { ...view, terms: undefined }, { ...view, proposalHash: "x" },
      { ...view, terms: { ...view.terms, timeZone: "Not/AZone" } }, { ...view, terms: { ...view.terms, currency: "sek" } },
      { ...view, proposal: { ...view.proposal, start: "tomorrow" } }, { ...view, proposal: { ...view.proposal, durationMinutes: 0 } },
      { ...view, proposal: { ...view.proposal, price: { amountMinor: 1.5, currency: "SEK" } } }, { ...view, proposal: { ...view.proposal, staff: {} } },
      { ...view, customer: "" },
      // The amount must be shown, labelled and approved in one currency.
      { ...view, terms: { ...view.terms, currency: "EUR" } }, { ...view, proposal: { ...view.proposal, price: { amountMinor: 52000, currency: "EUR" } } }];
    for (const body of broken) {
      expect(parseStagingView(body), JSON.stringify(body)).toBeNull();
      expect(consentOutcome("view", { status: 200, body })).toBe("unchecked");
    }
  });
});

describe("recovery after a refused or unknown read", () => {
  it("offers a status recheck after an unknown outcome or a rate limit, honouring Retry-After", () => {
    for (const outcome of ["unconfirmed", "unchecked", "limited"] as const) expect(recheckable(outcome), outcome).toBe(true);
    for (const outcome of ["ready", "approved", "declined", "approvedEarlier", "declinedEarlier", "used", "expired", "invalid", "loading"] as const)
      expect(recheckable(outcome), outcome).toBe(false);
    for (const locale of ["en", "sv"] as const)
      expect(stagingCopy[locale].limited).toMatch(locale === "en" ? /Check the status again/ : /Kontrollera statusen igen/);
    expect(retryAfterSeconds("42")).toBe(42);
    expect(retryAfterSeconds("1.2")).toBe(2);
    expect(retryAfterSeconds("100000")).toBe(900);
    for (const value of [null, undefined, "", "soon", "-5", "0"]) expect(retryAfterSeconds(value)).toBe(0);
  });
});

describe("consent page request order", () => {
  const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; };
  it("lets only the latest request change the page, and runs reads after a decision in flight", async () => {
    const { consentSequence } = await import("../src/app/consent/[id]/consent-sequence");
    const sequence = consentSequence(), log: string[] = [];
    // A slow read is overtaken by a decision: its result is stale.
    const slowRead = deferred();
    const read1 = sequence.read(async current => { await slowRead.promise; log.push(`read1 current=${current()}`); });
    await new Promise(r => setImmediate(r));
    const answer = deferred();
    const decision = sequence.decide(async current => { await answer.promise; log.push(`decision current=${current()}`); });
    // Reopening the link while the decision is in flight: the read waits for it.
    const read2 = sequence.read(async current => { log.push(`read2 started`); log.push(`read2 current=${current()}`); });
    slowRead.resolve(); await read1;
    await new Promise(r => setImmediate(r));
    expect(log).toEqual(["read1 current=false"]);
    answer.resolve(); await decision; await read2;
    expect(log).toEqual(["read1 current=false", "decision current=true", "read2 started", "read2 current=true"]);
  });
});

describe("consent page requests", () => {
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  it("treats a response that never finishes as unknown, within the deadline", async () => {
    const { consentRequest } = await import("../src/app/consent/[id]/consent-request");
    // Headers arrive, the body never completes (an intermediary holding the response open).
    const stalledBody: typeof fetch = async (_input, init) => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"status":"appr'));
      init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
    } }), { status: 200, headers: { "content-type": "application/json" } });
    // No response at all, and one that also ignores the abort signal.
    const stalledHeaders: typeof fetch = (_input, init) => new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    const deaf: typeof fetch = () => new Promise(() => {});
    for (const send of [stalledBody, stalledHeaders, deaf]) {
      const started = Date.now();
      const { response } = await consentRequest("/consent/x/decision", { decision: "yes" }, { fetch: send, timeoutMs: 50 });
      expect(Date.now() - started).toBeLessThan(1000);
      expect(consentOutcome("yes", response)).toBe("unconfirmed");
      expect(consentOutcome("view", response)).toBe("unchecked");
    }
  });
  it("sends the request the salon expects and keeps Retry-After with its own response", async () => {
    const { consentRequest } = await import("../src/app/consent/[id]/consent-request");
    let seen: RequestInit | undefined;
    const ok: typeof fetch = async (_input, init) => { seen = init; return json(200, { status: "approved" }); };
    await expect(consentRequest("/consent/x/decision", { decision: "yes" }, { fetch: ok })).resolves.toEqual({ response: { status: 200, redirected: false, body: { status: "approved" } }, retryAfter: 0 });
    expect(seen).toMatchObject({ method: "POST", redirect: "error", cache: "no-store", body: '{"decision":"yes"}' });
    const limited: typeof fetch = async () => json(429, { error: "consent_rate_limited" }, { "retry-after": "30" });
    // Interleaved: the older 200 finishing after the 429 cannot reset the 429's delay.
    const [a, b] = await Promise.all([consentRequest("/x", {}, { fetch: limited }), consentRequest("/x", {}, { fetch: ok })]);
    expect(a.retryAfter).toBe(30);
    expect(b.retryAfter).toBe(0);
    expect(consentOutcome("view", a.response)).toBe("limited");
  });
});

describe("staging runner preflight", () => {
  it("refuses remote browser sessions that would carry approval links off this machine", async () => {
    const { refuseRemoteBrowsers } = await import("../scripts/staging-consent/preflight.mjs");
    expect(() => refuseRemoteBrowsers({ PATH: "/usr/bin", SELENIUM_REMOTE_URL: "" })).not.toThrow();
    for (const env of [{ SELENIUM_REMOTE_URL: "https://grid.example.test/wd/hub" }, { SELENIUM_REMOTE_CAPABILITIES: "{}" }, { SELENIUM_REMOTE_HEADERS: "{}" },
      { selenium_remote_url: "http://grid.example.test" }, { PW_TEST_CONNECT_WS_ENDPOINT: "ws://browsers.example.test" }, { PW_TEST_CONNECT_HEADERS: "{}" },
      { PW_CHROMIUM_ATTACH_TO_OTHER: "1" }, { PW_TEST_REUSE_CONTEXT: "1" }])
      expect(() => refuseRemoteBrowsers(env), JSON.stringify(env)).toThrow(/^STAGING_REMOTE_BROWSER_REFUSED$/);
  });
  it("cannot launch a browser while a remote grid is configured, whoever calls it", async () => {
    const { launchBrowser } = await import("../scripts/staging-consent/browsers.mjs");
    vi.stubEnv("SELENIUM_REMOTE_URL", "http://127.0.0.1:1/wd/hub");
    try { await expect(launchBrowser("salon-demo.cresavo.test", "x")).rejects.toThrow(/^STAGING_REMOTE_BROWSER_REFUSED$/); }
    finally { vi.unstubAllEnvs(); }
  });
  it("refuses diagnostics that would print approval links outside the sanitizer", async () => {
    const { refuseDiagnostics } = await import("../scripts/staging-consent/preflight.mjs");
    expect(() => refuseDiagnostics({})).not.toThrow();
    expect(() => refuseDiagnostics({ DEBUG: "" })).not.toThrow();
    for (const env of [{ DEBUG: "pw:api" }, { DEBUG: "*" }, { DEBUG_FILE: "/tmp/x" }, { PWDEBUG: "1" }, { NODE_DEBUG: "http,tls" }, { NODE_OPTIONS: "--inspect" }])
      expect(() => refuseDiagnostics(env), JSON.stringify(env)).toThrow(/^STAGING_DIAGNOSTICS_REFUSED$/);
  });
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
    // No structured content and a first text block that is not JSON: still no throw, still all of it.
    const plain = agentReply(2, { content: [{ type: "text", text: "Proposal created." }, { type: "text", text: link }] });
    expect(JSON.parse(plain).body).toBeUndefined();
    expect(JSON.parse(plain).text).toBe("Proposal created.");
    expect(plain).toContain("L".repeat(43));
    expect(() => agentReply(3, { content: "not a list" })).not.toThrow();
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
    // Unregistered, short credentials after the scheme, in plain and JSON headers.
    for (const header of ["Authorization: Bearer fict0ken", "authorization: Basic Zm9vOmJhcg==", '{"authorization":"Bearer fict0ken"}',
      "x-api-key: fict0ken", "Cookie: a=1; booking_admin=fict0ken", "x-booking-gateway-token=fict0ken"]) {
      const out = sanitize(`before ${header} after`);
      expect(out, header).not.toMatch(/fict0ken|Zm9vOmJhcg/);
      expect(out).toContain("before");
    }
  });
  it("fails pending agent requests on a malformed line instead of throwing out of the stream callback", async () => {
    const { agentChannel } = await import("../scripts/staging-consent/agent-reply.mjs");
    const sent: string[] = [], transcript: string[] = [];
    const channel = agentChannel(line => sent.push(line), transcript, 5_000);
    const first = channel.send({ list: true });
    expect(() => channel.receive("Warning: fictional diagnostic with fict0ken")).not.toThrow();
    await expect(first).rejects.toThrow(/^AGENT_PROTOCOL_INVALID$/);
    const second = channel.send({ list: true });
    channel.receive(JSON.stringify({ id: 2, tools: ["x"] }));
    await expect(second).resolves.toMatchObject({ tools: ["x"] });
    const third = channel.send({ list: true });
    channel.receive(JSON.stringify({ id: 3, failure: "MCP_TRANSPORT_FAILED" }));
    await expect(third).rejects.toThrow(/^AGENT_REQUEST_FAILED$/);
    // Kept in memory for the leak scan; never echoed in an error.
    expect(transcript[0]).toContain("fict0ken");
  });
  it("counts UTF-8 bytes against the output budget", async () => {
    const { PassThrough } = await import("node:stream");
    const { guardStream, outputBytes } = await import("../scripts/staging-consent/processes.mjs");
    expect(outputBytes("åäö")).toBe(6);
    expect(outputBytes("abc")).toBe(3);
    expect(outputBytes("🔑")).toBe(4);
    expect(outputBytes(Buffer.from("åäö"))).toBe(6);
    // 8 characters, 16 bytes: over a 12-byte budget although only 8 code units long.
    let left = 12, overflows = 0;
    const stream = new PassThrough({ encoding: "utf8" });
    guardStream(stream, () => overflows++, size => (left -= size) >= 0);
    stream.write("åäöåäöåä");
    await new Promise(resolve => setImmediate(resolve));
    expect(overflows).toBe(1);
  });
  it("charges agent stdout to the output budget before any line is buffered", async () => {
    const { PassThrough } = await import("node:stream");
    const { createInterface } = await import("node:readline");
    const { guardStream } = await import("../scripts/staging-consent/processes.mjs");
    let left = 16;
    const reserve = (size: number) => (left -= size) >= 0;
    const stream = new PassThrough({ encoding: "utf8" }), lines: string[] = [];
    let overflows = 0;
    guardStream(stream, () => overflows++, reserve);
    createInterface({ input: stream }).on("line", line => lines.push(line));
    stream.write("{\"id\":1}\n");
    await new Promise(resolve => setImmediate(resolve));
    // An unterminated line far beyond the budget: the stream is cut, nothing more accumulates.
    stream.write("x".repeat(4096));
    await new Promise(resolve => setImmediate(resolve));
    expect(overflows).toBe(1);
    expect(stream.destroyed).toBe(true);
    expect(lines).toEqual(['{"id":1}']);
  });
  it("waits for every child's streams to close before the final scan", async () => {
    const { spawn } = await import("node:child_process");
    const { captureStream, leakedStreams, stopAll, track } = await import("../scripts/staging-consent/processes.mjs");
    const { registerSecret } = await import("../scripts/staging-consent/sanitize.mjs");
    const secret = "fictional-shutdown-secret-" + "R".repeat(12);
    registerSecret(secret);
    // On SIGTERM it exits at once, leaving its stdout to a helper that writes after the exit:
    // only `close`, not `exit`, waits for that output.
    const helper = `setTimeout(() => process.stdout.write(${JSON.stringify(secret)}), 300)`;
    const script = `const { spawn } = require("node:child_process");
      process.on("SIGTERM", () => { spawn(process.execPath, ["-e", ${JSON.stringify(helper)}], { stdio: ["ignore", "inherit", "ignore"] }); process.exit(0); });
      console.log("ready"); setInterval(() => {}, 1000);`;
    const child = track(spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"] }));
    captureStream("shutdown:stdout", child.stdout);
    await new Promise(resolve => child.stdout!.once("data", resolve));
    expect(leakedStreams()).not.toContain("shutdown:stdout");
    await stopAll();
    expect(leakedStreams()).toContain("shutdown:stdout");
  }, 30_000);
});
