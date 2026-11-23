import { afterEach, describe, expect, it, vi } from "vitest";
import { formatLog, log } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

const hostile = {
  requestId: "anna@example.test",
  route: "/api/owner/login?email=anna@example.test",
  method: "POST anna",
  provider: "Anna Andersson",
  reason: "anna@example.test",
  code: "+46 70 123 45 67",
  task: "token=sk-secret-123456",
  tool: "cookie: session=abc",
  errorName: "Failed for anna@example.test",
  status: "500 body",
  durationMs: Number.NaN,
  body: "Anna Andersson 070-123 45 67",
  email: "anna@example.test",
  phone: "0701234567",
  cookie: "owner_session=secret",
  headers: { authorization: "Bearer secret" },
  query: "?token=secret",
};

describe("structured log", () => {
  it("writes one JSON line with level, event, time and allowed fields", () => {
    const now = new Date("2026-11-22T10:00:00.000Z");
    const line = formatLog("error", "BOOKING_INTERNAL_ERROR", { requestId: "req-abcdef12", route: "/api/public/salons/[slug]", status: 500, errorName: "TypeError" }, now);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({ level: "error", event: "BOOKING_INTERNAL_ERROR", time: "2026-11-22T10:00:00.000Z", requestId: "req-abcdef12", route: "/api/public/salons/[slug]", status: 500, errorName: "TypeError" });
  });

  it("drops every value that is not of its field's strict shape, and every field outside the allowlist", () => {
    const line = formatLog("warn", "SOME_EVENT", hostile as never);
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(["event", "level", "time"]);
    for (const secret of ["anna", "Anna", "example.test", "070", "sk-secret", "cookie", "Bearer", "token", "secret", "body"]) expect(line).not.toContain(secret);
  });

  it("refuses an event that is not a fixed code, so a sentence cannot be logged", () => {
    expect(JSON.parse(formatLog("info", "Booking for anna@example.test failed")).event).toBe("INVALID_EVENT");
  });

  it("drops long digit runs such as phone numbers and ids", () => {
    expect(JSON.parse(formatLog("info", "SOME_EVENT", { reason: "id-0701234567" })).reason).toBeUndefined();
    expect(JSON.parse(formatLog("info", "SOME_EVENT", { reason: "live-off" })).reason).toBe("live-off");
  });

  it("writes warnings and errors to stderr, never stdout", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const out = vi.spyOn(console, "log").mockImplementation(() => undefined);
    log.warn("A_WARNING");
    log.error("AN_ERROR", { errorName: "Error" });
    expect(JSON.parse(warn.mock.calls[0][0]).event).toBe("A_WARNING");
    expect(JSON.parse(error.mock.calls[0][0]).event).toBe("AN_ERROR");
    expect(out).not.toHaveBeenCalled();
  });
});
