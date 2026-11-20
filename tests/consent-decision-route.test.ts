// The customer decision endpoint with its database dependencies injected: no connection is made.
import { createHmac, randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentApiError } from "../src/lib/agent-api/errors";

const findFirst = vi.fn(), customerDecision = vi.fn();
vi.mock("../src/lib/db", () => ({ db: { agentProposal: { findFirst: (...args: unknown[]) => findFirst(...args) } } }));
vi.mock("../src/lib/agent-api/proposals", () => ({ customerDecision: (...args: unknown[]) => customerDecision(...args) }));
const { POST } = await import("../src/app/consent/[id]/decision/route");
const { consentOutcome } = await import("../src/app/consent/[id]/staging-copy");

// Fictional configuration only.
const staging = { BOOKING_SERVICE_ROLE: "salon", GATEWAY_SERVICE_TOKEN: "a".repeat(64), BOOKING_PUBLIC_ORIGIN: "https://gateway.cresavo.test",
  BOOKING_CONSENT_DELIVERY: "staging-inbox", BOOKING_CONSENT_ORIGIN: "https://salon-demo.cresavo.test", BOOKING_ADDRESS_SECRET: "synthetic-proof",
  SESSION_SECRET: "fictional-session-secret-".padEnd(64, "x") };
beforeEach(() => {
  for (const [k, v] of Object.entries(staging)) vi.stubEnv(k, v);
  for (const k of ["BOOKING_CONSENT_LAB", "BOOKING_SMS_OTP_LAB", "BOOKING_CONSENT_INBOX_DIR", "PUBLIC_READONLY", "DEBUG", "RATE_LIMIT_STORE"]) vi.stubEnv(k, undefined);
  findFirst.mockReset(); customerDecision.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
let address = 10;
const decide = (id: string, body: object) => {
  const ip = `203.0.113.${address++}`;
  return POST(new Request(`https://salon-demo.cresavo.test/consent/${id}/decision`, { method: "POST", body: JSON.stringify(body), headers: {
    origin: "https://salon-demo.cresavo.test", "content-type": "application/json", "x-booking-client-ip": ip,
    "x-booking-client-proof": createHmac("sha256", "synthetic-proof").update(ip).digest("hex") } }), { params: Promise.resolve({ id }) });
};
const body = { token: "T".repeat(43), decision: "yes", proposalHash: "a".repeat(64) };

it("reports a failure after the decision was accepted as unconfirmed, never as a refusal", async () => {
  const id = randomUUID();
  findFirst.mockResolvedValue({ id });
  // The decision ran and may have committed; then the connection is lost.
  customerDecision.mockRejectedValue(Object.assign(new Error(`connection reset after commit for ${body.token}`), { code: "ECONNRESET" }));
  const response = await decide(id, body);
  expect(customerDecision).toHaveBeenCalledWith(id, body);
  expect(response.status).toBe(500);
  const raw = await response.text();
  expect(String(raw).includes(body.token), "a secret appears in the checked text").toBe(false);
  expect(JSON.parse(raw)).toEqual({ error: "consent_unavailable" });
  expect(consentOutcome("yes", { status: response.status, body: JSON.parse(raw) })).toBe("unconfirmed");
});

it("reports the salon's own refusal as a refusal", async () => {
  const id = randomUUID();
  findFirst.mockResolvedValue({ id });
  customerDecision.mockRejectedValue(new AgentApiError("mandate_denied"));
  const response = await decide(id, body);
  expect(response.status).toBe(403);
  expect(consentOutcome("yes", { status: 403, body: await response.json() })).toBe("invalid");
});

it("never reaches the decision for a proposal that does not exist", async () => {
  findFirst.mockResolvedValue(null);
  const response = await decide(randomUUID(), body);
  expect(response.status).toBe(403);
  expect(customerDecision).not.toHaveBeenCalled();
});
