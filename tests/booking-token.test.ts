import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bookingTokenExpiry, mintBookingToken, verifyBookingToken } from "@/lib/booking-token";

// The link token of a confirmation e-mail. Fixed dates, synthetic secret.

const scope = { tenantId: "tenant-fiktiv", bookingId: "b-12", customerId: "k-7", purpose: "manage" };
const visit = { date: "2026-11-24", start: 600, duration: 60 };
const exp = bookingTokenExpiry(visit);
const NOW = new Date("2026-11-16T10:00:00+01:00").getTime();

beforeEach(() => vi.stubEnv("SESSION_SECRET", "synthetic-session-secret-of-32-chars!!"));
afterEach(() => vi.unstubAllEnvs());

describe("booking tokens", () => {
  it("expire a week after the visit ends, in the salon's time", () => {
    // 2026-11-24 11:00 Stockholm (UTC+1) plus 7 days.
    expect(exp).toBe(Date.parse("2026-12-01T11:00:00+01:00") / 1000);
  });

  it("have the form v1.<bookingId>.<exp>.<mac> and verify for their own scope", () => {
    const token = mintBookingToken(scope, exp);
    expect(token).toMatch(/^v1\.b-12\.\d+\.[a-f0-9]{64}$/);
    expect(verifyBookingToken(token, scope, NOW)).toBe(true);
  });

  it("are the same each time, so a replayed send is the same message", () => {
    expect(mintBookingToken(scope, exp)).toBe(mintBookingToken(scope, exp));
  });

  it("refuse a changed mac, expiry or booking", () => {
    const token = mintBookingToken(scope, exp);
    const [v, id, e, mac] = token.split(".");
    expect(verifyBookingToken([v, id, e, `${mac.slice(0, -1)}${mac.endsWith("0") ? "1" : "0"}`].join("."), scope, NOW)).toBe(false);
    expect(verifyBookingToken([v, id, String(Number(e) + 1), mac].join("."), scope, NOW)).toBe(false);
    expect(verifyBookingToken([v, "b-13", e, mac].join("."), { ...scope, bookingId: "b-13" }, NOW)).toBe(false);
    expect(verifyBookingToken(token, { ...scope, bookingId: "b-13" }, NOW)).toBe(false);
    expect(verifyBookingToken("v2.b-12.1.abc", scope, NOW)).toBe(false);
    expect(verifyBookingToken("", scope, NOW)).toBe(false);
  });

  it("stop working at the expiry", () => {
    const token = mintBookingToken(scope, exp);
    expect(verifyBookingToken(token, scope, exp * 1000 - 1)).toBe(true);
    expect(verifyBookingToken(token, scope, exp * 1000)).toBe(false);
  });

  it("belong to one purpose, one tenant and one customer", () => {
    const token = mintBookingToken(scope, exp);
    expect(verifyBookingToken(token, { ...scope, purpose: "cancel" }, NOW)).toBe(false);
    expect(verifyBookingToken(token, { ...scope, tenantId: "tenant-annan" }, NOW)).toBe(false);
    expect(verifyBookingToken(token, { ...scope, customerId: "k-8" }, NOW)).toBe(false);
  });

  it("depend on the server secret, which must be long enough", () => {
    const token = mintBookingToken(scope, exp);
    vi.stubEnv("SESSION_SECRET", "another-synthetic-session-secret-32!!");
    expect(verifyBookingToken(token, scope, NOW)).toBe(false);
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => mintBookingToken(scope, exp)).toThrow("SESSION_SECRET");
  });
});
