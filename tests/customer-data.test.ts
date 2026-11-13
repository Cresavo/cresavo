import { expect, it } from "vitest";
import {
  customerDataSchema,
  customerExportSchema,
  customerContactRemovalSchema,
} from "../src/lib/customer-data";

it("bounds privacy inputs and rejects unknown fields and unconfirmed contact removal", () => {
  const source = { id: "synthetic-customer", expectedVersion: 1 };
  expect(
    customerDataSchema.safeParse({ ...source, businessId: "other" }).success,
  ).toBe(false);
  for (const limit of [0, 101, 1.5])
    expect(customerExportSchema.safeParse({ ...source, limit }).success).toBe(
      false,
    );
  expect(customerExportSchema.parse(source).limit).toBe(100);
  const action = { ...source, expectedToken: "a".repeat(64), confirmed: true };
  expect(customerContactRemovalSchema.safeParse(action).success).toBe(true);
  for (const input of [
    { ...action, confirmed: false },
    { ...action, expectedToken: "invalid" },
    { ...action, expectedVersion: 0 },
    { ...action, email: "unwanted@example.test" },
  ])
    expect(customerContactRemovalSchema.safeParse(input).success).toBe(false);
});
