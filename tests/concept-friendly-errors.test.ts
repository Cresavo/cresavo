import { describe, expect, it } from "vitest";
import { en } from "@/concept/i18n/en";
import { sv } from "@/concept/i18n/sv";

// Error and failure messages are written for a beginner: what happened, why, what to do next. No exclamation
// marks and no error codes (docs/design/FRIENDLY_ERRORS.md).

const ERROR_KEY = /(error|fail|invalid|unavailable|notFound|cannot|problem|refused|denied|tooMany|wrong|missing\.|moduleOff|staffOnly|setupGaps|friendly)/i;
/** Text for an outside assistant's tools and the developer pages, where technical names are the point. */
const TECHNICAL = ["pair.", "ai.", "data.setup.", "gallery.", "reference."];
const CODE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b(?:HTTP|status|code)\s*\d{3}\b|\b(?:Error|Exception)\s*:|\bE\d{3,}\b/;

const errorKeys = Object.keys(en.messages).filter((key) => ERROR_KEY.test(key) && !TECHNICAL.some((prefix) => key.startsWith(prefix)));

describe("friendly error messages", () => {
  it("covers the error messages of the studio and the booking pages", () => {
    expect(errorKeys.length).toBeGreaterThan(100);
  });

  it("recognises a code", () => {
    for (const sample of ["Failed: BOOKING_INTERNAL_ERROR", "HTTP 500", "Error: timeout", "E1042"]) expect(CODE.test(sample), sample).toBe(true);
    expect(CODE.test("Try again in 5 minutes.")).toBe(false);
  });

  it.each([["en", en.messages], ["sv", sv.messages]] as const)("never exclaim or show a code in %s", (_language, messages) => {
    const text: Record<string, string> = messages;
    const loud = errorKeys.filter((key) => text[key].includes("!"));
    const coded = errorKeys.filter((key) => CODE.test(text[key]));
    expect(loud).toEqual([]);
    expect(coded).toEqual([]);
  });
});
