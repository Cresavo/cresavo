import { expect, it } from "vitest";
import { hashPassword, verifyPasswordHash } from "../src/lib/password";
import { PasswordCapacityError } from "../src/lib/errors";

it("använder saltad Argon2id och verifierar rätt/fel lösenord utan klartextlagring", async () => {
  const password = "Syntetiskt-lösenord-2026";
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  expect(one).not.toBe(two);
  expect(one).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  expect(one).not.toContain(password);
  expect(await verifyPasswordHash(one, password)).toBe(true);
  expect(await verifyPasswordHash(one, "wrong")).toBe(false);
  expect(await verifyPasswordHash(undefined, password)).toBe(false);
  expect(await verifyPasswordHash("invalid-hash", password)).toBe(false);
});

it.each(["short", "x".repeat(129)])(
  "nekar för korta/långa nya lösenord",
  async (value) => {
    await expect(hashPassword(value)).rejects.toThrow();
  },
);

it("bevarar betydelsefulla blanksteg och Unicode", async () => {
  const password = " syntetisk ÅÄÖ lösenfras ";
  const encoded = await hashPassword(password);
  expect(await verifyPasswordHash(encoded, password)).toBe(true);
  expect(await verifyPasswordHash(encoded, password.trim())).toBe(false);
});

it("begränsar dyra lösenordsoperationer utan obegränsad kö och släpper kapaciteten igen", async () => {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => verifyPasswordHash(undefined, "wrong")),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(4);
  for (const result of results.filter((r) => r.status === "rejected")) {
    if (result.status === "rejected") {
      expect(result.reason).toBeInstanceOf(PasswordCapacityError);
      expect(result.reason).toMatchObject({ status: 429, retryAfter: 1 });
    }
  }
  expect(await verifyPasswordHash(undefined, "wrong")).toBe(false);
});
