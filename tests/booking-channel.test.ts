import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCardReplayChannel } from "../src/lib/booking-channel";

afterEach(() => vi.unstubAllEnvs());
describe("Kortets replaygräns vid vanliga bokningsingångar", () => {
  it("kontrollerar faktisk kanal efter domänens replay, även vid känd UUID", () => {
    const secret = "synthetic-replay-secret".repeat(3),
      address = "local-card";
    vi.stubEnv("SESSION_SECRET", secret);
    const booking = {
      idempotencyKey: "time-card_00000000-0000-4000-8000-000000000001",
      clientKey: createHmac("sha256", secret).update(address).digest("hex"),
    };
    expect(() => assertCardReplayChannel(booking, address)).not.toThrow();
    expect(() => assertCardReplayChannel(booking, "foreign-client")).toThrow(
      "Bokningen kan inte visas med den här demoprofilen.",
    );
    vi.stubEnv("SESSION_SECRET", "different-synthetic-secret".repeat(3));
    expect(() => assertCardReplayChannel(booking, address)).toThrow();
    vi.stubEnv("SESSION_SECRET", "");
    expect(() => assertCardReplayChannel(booking, address)).toThrow();
  });
  it("behåller äldre kontrakt för andra nycklar och saknad nyckel", () => {
    for (const idempotencyKey of [null, "ordinary-key", "admin-hashed-key"])
      expect(() =>
        assertCardReplayChannel({ idempotencyKey, clientKey: null }, "other"),
      ).not.toThrow();
  });
});
