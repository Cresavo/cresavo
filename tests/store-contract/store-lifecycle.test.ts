import { describe, expect, it } from "vitest";
import { scopedIdempotencyKey } from "@/concept/store/idempotency";
import { StoreMetrics } from "@/concept/store/store-metrics";

describe("scopedIdempotencyKey", () => {
  it("namespaces an opaque key under the authenticated caller", () => {
    expect(scopedIdempotencyKey("client_1", "same:request")).toBe("client_1:same:request");
    expect(scopedIdempotencyKey("site-key", "same:request")).toBe("site-key:same:request");
    expect(scopedIdempotencyKey("studio", "same:request")).toBe("studio:same:request");
  });

  it("validates the caller, key and combined length", () => {
    expect(scopedIdempotencyKey("studio", "x".repeat(193))).toHaveLength(200);
    for (const [caller, key] of [
      ["studio", "x".repeat(194)], ["client:1", "key"], ["", "key"], ["studio", ""],
      ["studio", " bad"], ["studio", "key\n"], ["studio", "\0"],
    ]) {
      expect(() => scopedIdempotencyKey(caller, key)).toThrow(RangeError);
    }
  });
});

describe("StoreMetrics", () => {
  it("counts warnings and escalates on size, booking count or recent apply p95", () => {
    const metrics = new StoreMetrics();
    metrics.record({ documentBytes: 999_999, bookings: 4_999, applyDurationMs: 50 });
    expect(metrics.snapshot()).toMatchObject({ commits: 1, warnings: 0, actionsNeeded: 0, warn: false, act: false });
    metrics.record({ documentBytes: 1_000_000, bookings: 4_999, applyDurationMs: 50 });
    expect(metrics.snapshot()).toMatchObject({ warn: true, act: false });
    metrics.record({ documentBytes: 999_999, bookings: 5_000, applyDurationMs: 50 });
    expect(metrics.snapshot()).toMatchObject({ warn: true, act: false });
    metrics.record({ documentBytes: 2_000_000, bookings: 4_999, applyDurationMs: 50 });
    expect(metrics.snapshot()).toMatchObject({ warn: true, act: true });
    metrics.record({ documentBytes: 999_999, bookings: 4_999, applyDurationMs: 51 });
    expect(metrics.snapshot()).toMatchObject({ warnings: 3, actionsNeeded: 2, warn: false, act: true, applyP95Ms: 51 });
    for (let i = 0; i < 100; i++) metrics.record({ documentBytes: 1, bookings: 1, applyDurationMs: 1 });
    expect(metrics.snapshot()).toMatchObject({ commits: 105, applyP95Ms: 1, act: false });
  });
});
