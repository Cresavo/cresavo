import { describe, expect, it } from "vitest";
import { messageKindFor } from "@/concept/studio/web-call/booking-result";
import { callClock, rmsLevel, smoothLevel } from "@/concept/studio/web-call/call-levels";

describe("callClock", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(callClock(0)).toBe("0:00");
    expect(callClock(42)).toBe("0:42");
    expect(callClock(84)).toBe("1:24");
  });
});

describe("audio levels", () => {
  it("treats a centred time-domain buffer as silence", () => {
    expect(rmsLevel(new Uint8Array(32).fill(128))).toBe(0);
  });

  it("rises faster than it falls", () => {
    const up = smoothLevel(0, 1);
    const down = smoothLevel(1, 0);
    expect(up).toBeGreaterThan(0.4);
    expect(down).toBeGreaterThan(0.7);
  });
});

describe("messageKindFor", () => {
  it("picks the confirmation the customer would get", () => {
    expect(messageKindFor("booked")).toBe("confirmation");
    expect(messageKindFor("moved")).toBe("moved");
    expect(messageKindFor("cancelled")).toBe("cancellation");
    expect(messageKindFor("handover")).toBeNull();
    expect(messageKindFor("none")).toBeNull();
  });
});
