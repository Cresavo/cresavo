import { expect, it } from "vitest";
import { availableSlug, randomSlug } from "@/lib/owner-accounts";
import { checkSlug, SLUG_MAX } from "@/concept/page/slug";

// Choosing a salon's address at sign-up. No database: "taken" is a list.

const takenIn = (used: string[]) => async (candidate: string) => used.includes(candidate);

it("keeps a free address as it is", async () => {
  expect(await availableSlug("salong-fiktiv", takenIn([]))).toBe("salong-fiktiv");
});

it("takes the next free variant", async () => {
  expect(await availableSlug("salong-fiktiv", takenIn(["salong-fiktiv", "salong-fiktiv-2"]))).toBe("salong-fiktiv-3");
});

it("never makes a double hyphen or an over-long address when it shortens one", async () => {
  for (const slug of [`${"a".repeat(27)}-bc`, `${"a".repeat(26)}-bcd`, `${"a".repeat(29)}b`]) {
    expect(slug).toHaveLength(SLUG_MAX);
    const next = (await availableSlug(slug, takenIn([slug])))!;
    expect(next).not.toContain("--");
    expect(checkSlug(next).ok).toBe(true);
    expect(next.length).toBeLessThanOrEqual(SLUG_MAX);
  }
});

it("trims a trailing hyphen before the suffix", async () => {
  const slug = `${"a".repeat(27)}-bc`; // 30 characters; cutting for "-2" leaves a hyphen at the end
  expect(slug).toHaveLength(SLUG_MAX);
  expect(await availableSlug(slug, takenIn([slug]))).toBe(`${"a".repeat(27)}-2`);
});

it("gives up on the numbered variants after a hundred", async () => {
  expect(await availableSlug("salong-fiktiv", async () => true)).toBeNull();
});

it("falls back to a valid address with a random ending", () => {
  for (const slug of ["salong-fiktiv", `${"a".repeat(27)}-bc`, `${"a".repeat(30)}`]) {
    const next = randomSlug(slug);
    expect(checkSlug(next).ok).toBe(true);
    expect(next).toMatch(/-[0-9a-f]{4}$/);
    expect(next).not.toBe(randomSlug(slug));
  }
});
