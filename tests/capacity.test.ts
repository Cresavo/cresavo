import { expect, it } from "vitest";
import {
  capacityListSchema,
  capacitySourceSchema,
  capacityDraftSchema,
} from "../src/lib/capacity";
it("rejects oversized queries and forged source/version fields", () => {
  for (const v of [
    { days: 0 },
    { days: 8 },
    { limit: 21 },
    { from: "2026-02-30" },
    { actor: "admin" },
  ])
    expect(capacityListSchema.safeParse(v).success).toBe(false);
  for (const v of [
    { bookingId: "x", sourceVersion: 0, expectedToken: "a".repeat(64) },
    { bookingId: "x", sourceVersion: 2, expectedToken: "forged" },
  ])
    expect(capacitySourceSchema.safeParse(v).success).toBe(false);
});
it("requires explicit valid campaign conditions and rejects hidden scope fields", () => {
  const source = {
    bookingId: "x",
    sourceVersion: 2,
    expectedToken: "a".repeat(64),
  };
  const campaign = {
    serviceId: "massage",
    title: "Erbjudande",
    discountPercent: 20,
    validFrom: "2026-11-16",
    validUntil: "2026-11-17",
  };
  for (const extra of [
    { discountPercent: 0 },
    { discountPercent: 101 },
    { slotExclusive: true },
    { validUntil: "2027-04-01" },
    { validUntil: "2026-11-15" },
  ])
    expect(
      capacityDraftSchema.safeParse({
        ...source,
        campaign: { ...campaign, ...extra },
      }).success,
    ).toBe(false);
  expect(capacityDraftSchema.safeParse({ ...source, campaign }).success).toBe(
    true,
  );
});
