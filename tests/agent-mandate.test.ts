import { describe, expect, it } from "vitest";
import { assertMandatedBooking, mandateSchema, type StoredMandate, type MandatedBooking } from "../src/lib/agent-api/mandate-policy";
import { placeForStaff } from "../src/lib/agent-api/place";

const now = new Date("2026-11-16T08:00:00Z");
const mandate: StoredMandate = {
  ...placeForStaff("anna"),
  businessId: "demo", clientId: "client-a", serviceId: "massage", staffId: "anna",
  validFrom: new Date("2026-11-16T14:00:00Z"), validUntil: new Date("2026-11-16T16:00:00Z"),
  expiresAt: new Date("2026-11-16T13:00:00Z"), revokedAt: null,
  maxPriceOre: 45000, currency: "SEK", origin: "synthetic-operator", originReference: "manual-test-01",
};
const booking: MandatedBooking = {
  ...placeForStaff("anna"),
  businessId: "demo", clientId: "client-a", serviceId: "massage", staffId: "anna",
  start: new Date("2026-11-16T14:00:00Z"), duration: 30, priceOre: 45000,
};
describe("server-owned synthetic mandate bounds", () => {
  it("allows exact time/price boundaries and the complete treatment within the range", () => {
    expect(() => assertMandatedBooking(mandate, booking, now)).not.toThrow();
    expect(() => assertMandatedBooking(mandate, { ...booking, start: new Date("2026-11-16T15:30:00Z") }, now)).not.toThrow();
  });
  it.each([
    { businessId: "other" }, { clientId: "client-b" }, { serviceId: "fotvard" },
    { staffId: "erik" }, { locationId: "another-location" }, { scheduleId: "another-schedule" },
    { priceOre: 45001 }, { priceOre: -1 },
    { start: new Date("2026-11-16T13:59:59Z") },
    { start: new Date("2026-11-16T15:30:01Z") },
  ])("denies a booking outside a grant: %j", change => {
    expect(() => assertMandatedBooking(mandate, { ...booking, ...change }, now)).toThrow("authorised mandate");
  });
  it.each([
    { revokedAt: now }, { expiresAt: now }, { origin: "client-asserted" },
    { originReference: "" }, { currency: "EUR" },
  ])("denies revoked, expired or invalid authority: %j", change => {
    expect(() => assertMandatedBooking({ ...mandate, ...change }, booking, now)).toThrow("authorised mandate");
  });
  it("does not accept confirmed or issuer data as new authority", () => {
    const data = { ...mandate, validFrom: mandate.validFrom.toISOString(), validUntil: mandate.validUntil.toISOString(), expiresAt: mandate.expiresAt.toISOString() };
    const { revokedAt: _ignored, ...input } = data;
    void _ignored;
    expect(mandateSchema.safeParse(input).success).toBe(true);
    expect(mandateSchema.safeParse({ ...input, confirmed: true }).success).toBe(false);
    expect(mandateSchema.safeParse({ ...input, origin: "client-asserted" }).success).toBe(false);
    expect(mandateSchema.safeParse({ ...input, locationId: "another-location" }).success).toBe(false);
    expect(mandateSchema.safeParse({ ...input, scheduleId: "another-schedule" }).success).toBe(false);
    expect(mandateSchema.safeParse({ ...input, validUntil: input.validFrom }).success).toBe(false);
    expect(() => assertMandatedBooking(null, booking, now)).toThrow("authorised mandate");
  });
});
