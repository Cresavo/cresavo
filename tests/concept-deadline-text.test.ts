import { afterEach, describe, expect, it, vi } from "vitest";
import { freeUntilText } from "../src/concept/booking/deadline-text";

describe("freeUntilText", () => {
  afterEach(() => vi.useRealTimers());

  it("names the free-cancellation deadline while it is still ahead", () => {
    vi.useFakeTimers({ now: new Date("2026-11-15T10:00:00+01:00") });
    expect(freeUntilText({ date: "2026-11-17", start: 15 * 60 }, 24)).toMatch(/until .*16.*15:00/);
  });

  it("does not promise a deadline that has already passed", () => {
    vi.useFakeTimers({ now: new Date("2026-11-17T10:00:00+01:00") });
    const text = freeUntilText({ date: "2026-11-17", start: 15 * 60 }, 24);
    expect(text).not.toMatch(/until/);
    expect(text).toMatch(/less than 24 hours/);
  });
});
