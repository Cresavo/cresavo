import { describe, expect, it } from "vitest";
import { formatBookingTime, formatPrice, readableDay } from "../src/lib/format";
import { parseLocale, preferredLocale } from "../src/lib/locale";
import { presentationError } from "../src/lib/presentation-errors";

describe("presentation locales", () => {
  it("defaults to English for any browser language and honors an explicit preference", () => {
    expect(preferredLocale("en", "sv-SE,sv;q=0.9")).toBe("en");
    expect(preferredLocale("sv", "en-US")).toBe("sv");
    expect(preferredLocale(undefined, "sv-SE,sv;q=0.9")).toBe("en");
    expect(preferredLocale("invalid", "sv")).toBe("en");
    expect(preferredLocale(undefined, null)).toBe("en");
  });
  it("keeps known API errors actionable and never echoes unknown English errors", () => {
    expect(presentationError("Tiden är inte tillgänglig", "en")).toContain(
      "Choose another time",
    );
    const engineMessage = "That time is no longer available. Choose another time.";
    expect(presentationError(engineMessage, "en")).toBe(engineMessage);
    expect(presentationError(engineMessage, "sv")).toBe("Tiden är inte tillgänglig");
    expect(presentationError("private SQL detail", "en")).not.toContain("SQL");
    expect(typeof presentationError("__proto__", "en")).toBe("string");
    expect(presentationError("Tiden är inte tillgänglig", "sv")).toBe(
      "Tiden är inte tillgänglig",
    );
  });
  it("accepts only the two supported languages", () => {
    expect(parseLocale("en")).toBe("en");
    expect(parseLocale("sv")).toBe("sv");
    for (const invalid of [null, "EN", "en-US", "../../", ["sv"], {}])
      expect(parseLocale(invalid)).toBeNull();
  });
  it("keeps Stockholm time across winter and summer in both languages", () => {
    for (const locale of ["en", "sv"] as const) {
      expect(formatBookingTime("2026-01-15T08:30:00Z", locale)).toContain(
        "09:30",
      );
      expect(formatBookingTime("2026-07-15T08:30:00Z", locale)).toContain(
        "10:30",
      );
    }
  });
  it("defaults to English and keeps explicit Swedish formatting for SEK", () => {
    expect(readableDay("2026-11-16")).toBe("Monday 16 November 2026");
    expect(readableDay("2026-11-16", "sv")).toBe("måndag 16 november 2026");
    expect(formatPrice(45000)).toContain("SEK");
    expect(formatPrice(45000, "sv")).toContain("450,00");
    expect(readableDay("invalid", "en")).toBe("Choose a day");
  });
});
