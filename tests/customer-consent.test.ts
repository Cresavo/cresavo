import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertMandatedBooking, bookingProposalHash, type MandatedBooking, type StoredMandate } from "../src/lib/agent-api/mandate-policy";
import { customerDecisionSchema, proposalSchema } from "../src/lib/agent-api/proposals";
import { requireConsentLab } from "../src/lib/agent-api/customer-identity";
import { placeForStaff } from "../src/lib/agent-api/place";
import { POST } from "../src/app/consent/[id]/decision/route";
const now = new Date("2026-11-16T08:00:00Z");
const booking: MandatedBooking = { businessId: "demo", clientId: "test-client", serviceId: "massage", staffId: "anna", ...placeForStaff("anna"), start: new Date("2026-11-16T14:00:00Z"), duration: 30, priceOre: 45000 };
const mandate: StoredMandate = { ...booking, validFrom: booking.start, validUntil: new Date("2026-11-16T15:00:00Z"), expiresAt: new Date("2026-11-16T13:00:00Z"), maxPriceOre: 45000, currency: "SEK", revokedAt: null, origin: "customer-consent", originReference: "proposal-1", proposalHash: bookingProposalHash(booking) };
beforeEach(() => { vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "http://127.0.0.1:3229"); vi.stubEnv("BOOKING_RUNTIME", "local"); });
afterEach(() => vi.unstubAllEnvs());
describe("exact customer mandate scope", () => {
  it("accepts the exact booking", () => expect(() => assertMandatedBooking(mandate, booking, now)).not.toThrow());
  it.each([{ start: new Date("2026-11-16T14:01:00Z") }, { duration: 29 }, { priceOre: 44999 }, { staffId: "erik" }, { serviceId: "fotvard" }, { clientId: "other" }, { locationId: "other" }, { scheduleId: "other" }])("rejects an altered booking %j", change => {
    expect(() => assertMandatedBooking(mandate, { ...booking, ...change }, now)).toThrow("authorised mandate");
  });
  it.each([{ proposalHash: null }, { proposalHash: "forged" }, { expiresAt: now }, { origin: "client-asserted" }])("rejects invalid customer authority %j", change => {
    expect(() => assertMandatedBooking({ ...mandate, ...change }, booking, now)).toThrow("authorised mandate");
  });
  it("canonicalises equivalent time offsets", () => expect(bookingProposalHash({ ...booking, start: new Date("2026-11-16T15:00:00+01:00") })).toBe(mandate.proposalHash));
});
const input = { business: "demo", serviceId: "massage", serviceVersion: 1, staffId: "anna", start: booking.start.toISOString() };
it.each(["confirmed", "origin", "mandateId", "clientId", "priceOre", "duration", "locationId", "paymentToken", "checkout"]) ("rejects client authority/payment field %s", key => {
  expect(proposalSchema.safeParse({ ...input, [key]: "forged" }).success).toBe(false);
});
it("takes only the e-mail code decisions: no bearer token, phone or client authority", () => {
  expect(customerDecisionSchema.safeParse({ decision: "send-code", email: "kund@example.test" }).success).toBe(true);
  expect(customerDecisionSchema.safeParse({ decision: "yes", proposalHash: "a".repeat(64), code: "123456" }).success).toBe(true);
  for (const forged of [{ token: "x".repeat(43) }, { decision: "resend" }, { customerPhone: "+46701740605" }, { mandateId: "m" }])
    expect(customerDecisionSchema.safeParse({ decision: "yes", ...forged }).success).toBe(false);
  expect(proposalSchema.safeParse({ ...input, customerPhone: "+46701740605" }).success).toBe(false);
});
it("runs consent only as a local lab, never with a cloud marker", () => {
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "http://127.0.0.1:3229"); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("DATABASE_URL", "postgresql://synthetic@127.0.0.1:1/consent_test");
  vi.stubEnv("BOOKING_CONSENT_LAB", "1");
  expect(requireConsentLab()).toBe("http://127.0.0.1:3229");
  for (const [name, value] of [["BOOKING_CONSENT_LAB", ""], ["VERCEL", "1"], ["VERCEL_URL", "x.vercel.app"], ["BOOKING_RUNTIME", "vercel"]]) {
    vi.stubEnv(name, value);
    expect(() => requireConsentLab()).toThrow();
    vi.stubEnv(name, name === "BOOKING_CONSENT_LAB" ? "1" : name === "BOOKING_RUNTIME" ? "local" : "");
  }
  vi.unstubAllEnvs();
});
it("rejects agent Bearer requests at the customer surface before database access", async () => {
  const response = await POST(new Request("http://127.0.0.1:3229/consent/test/decision", { method: "POST", headers: { origin: "http://127.0.0.1:3229", authorization: "Bearer synthetic-agent", "content-type": "application/json" }, body: JSON.stringify({ confirmed: true }) }), { params: Promise.resolve({ id: "test" }) });
  expect(response.status).toBe(403); expect(await response.text()).not.toContain("synthetic-agent");
});
