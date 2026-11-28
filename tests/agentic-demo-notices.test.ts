import { afterEach, describe, expect, it, vi } from "vitest";
import { simulatedNotices, withLabNotices } from "../src/lib/agent-api/notices";

afterEach(() => { vi.unstubAllEnvs(); });

describe("simulated booking notices", () => {
  it("masks the destination and schedules a day before a distant booking", () => {
    expect(simulatedNotices("2026-12-04T12:00:00Z", "2026-12-01T12:00:00Z", "d***@example.test")).toEqual({
      confirmation: { channel: "email", status: "simulated", to: "d***@example.test" },
      reminder: { channel: "email", status: "scheduled-simulated", at: "2026-12-03T12:00:00.000Z" },
    });
  });
  it("uses two hours for a nearer booking", () => {
    expect(simulatedNotices("2026-12-01T16:00:00Z", "2026-12-01T12:00:00Z", "d***@example.test").reminder.at).toBe("2026-12-01T14:00:00.000Z");
  });
  it("leaves other tools' results untouched", async () => {
    const body = { services: [] };
    expect(await withLabNotices("list_services", body)).toBe(body);
  });
  it("adds nothing outside the consent lab", async () => {
    vi.stubEnv("BOOKING_CONSENT_LAB", "0");
    const body = { booking: { id: "b1", status: "confirmed", start: "2026-12-04T12:00:00Z", createdAt: "2026-12-01T12:00:00Z" } };
    expect(await withLabNotices("create_booking", body)).toBe(body);
  });
});
