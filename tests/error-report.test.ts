import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEnvelope, buildEvent, parseDsn, reportError, sampleRate, stackFrames } from "@/lib/error-report";
import { pageDataFailure, safeFailure } from "@/lib/errors";
import { version } from "../package.json";

const DSN = "https://publickey@o1.ingest.de.sentry.io/4501";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function canaryError() {
  const error = Object.assign(new Error("finns inte CANARY@example.test 070-123 45 67 postgres://user:pw@host/db"), {
    cause: new Error("CANARY cause"),
    meta: { query: "CANARY" },
    headers: { cookie: "owner_session=CANARY" },
    ip: "203.0.113.9",
  });
  error.stack = [
    `Error: ${error.message}`,
    `    at handler (${process.cwd()}/src/lib/domain.ts:10:5)`,
    "    at async file:///srv/app/.next/server/chunk.js?token=CANARY&email=a@example.test:3:9",
  ].join("\n");
  return error;
}

describe("error report", () => {
  it("does nothing, and sends nothing, without ERROR_REPORT_DSN", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    reportError(canaryError(), { code: "BOOKING_INTERNAL_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a DSN that is malformed or not https", () => {
    expect(parseDsn("not a url")).toBeNull();
    expect(parseDsn("http://key@example.test/1")).toBeNull();
    expect(parseDsn("https://example.test/1")).toBeNull();
    expect(parseDsn("http://key@localhost:9000/1")).toEqual({ url: "http://localhost:9000/api/1/envelope/", key: "key" });
    expect(parseDsn("https://k@glitch.example.test/sub/7")).toEqual({ url: "https://glitch.example.test/sub/api/7/envelope/", key: "k" });
  });

  it("sends an envelope to the DSN's endpoint", () => {
    vi.stubEnv("ERROR_REPORT_DSN", DSN);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    reportError(canaryError(), { code: "BOOKING_INTERNAL_ERROR", route: "/api/owner/login" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://o1.ingest.de.sentry.io/api/4501/envelope/");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const [header, item, event] = (init.body as string).split("\n").map((line) => JSON.parse(line));
    expect(header.event_id).toBe(event.event_id);
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({ release: version, tags: { event_code: "BOOKING_INTERNAL_ERROR", route: "/api/owner/login" }, exception: { values: [{ type: "Error", value: "BOOKING_INTERNAL_ERROR" }] } });
  });

  it("scrubs: messages, causes, bodies, headers, cookies, query strings, e-mails and IPs never leave", () => {
    vi.stubEnv("ERROR_REPORT_DSN", DSN);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    // The event ID and the two times are the only random parts of a report. Pin
    // them, or a short canary such as "070" turns up in them by chance.
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-2222-4333-8444-555555555555");
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-01-02T03:04:05.678Z") });
    reportError(canaryError(), { code: "BOOKING_INTERNAL_ERROR", route: "/api/x?email=anna@example.test" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.body).toContain('"event_id":"11111111222243338444555555555555","sent_at":"2026-01-02T03:04:05.678Z"');
    expect(init.body).toContain('"timestamp":1767323045,');
    const sent = `${url}\n${JSON.stringify(init.headers)}\n${init.body}`;
    for (const secret of ["CANARY", "example.test", "070", "postgres", "owner_session", "203.0.113.9", "token=", "finns inte"]) {
      expect(sent, secret).not.toContain(secret);
    }
    const event = JSON.parse((init.body as string).split("\n")[2]);
    expect(Object.keys(event).sort()).toEqual(["environment", "event_id", "exception", "level", "platform", "release", "tags", "timestamp"]);
    expect(event.tags.route).toBeUndefined();
    expect(event.exception.values[0].stacktrace.frames).toEqual([
      { filename: "/srv/app/.next/server/chunk.js", lineno: 3, colno: 9 },
      { filename: "src/lib/domain.ts", lineno: 10, colno: 5, function: "handler" },
    ]);
  });

  it("reports one error once, however many layers see it", () => {
    vi.stubEnv("ERROR_REPORT_DSN", DSN);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");
    safeFailure(error);
    safeFailure(error);
    reportError(error, { code: "REQUEST_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    let thrown: unknown;
    try { pageDataFailure(new Error("again")); } catch (caught) { thrown = caught; }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    reportError(thrown, { code: "REQUEST_ERROR" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not report the failures it already answers to the caller (4xx)", () => {
    vi.stubEnv("ERROR_REPORT_DSN", DSN);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    safeFailure(new SyntaxError("bad json"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws or waits when the endpoint is down or fetch itself fails", () => {
    vi.stubEnv("ERROR_REPORT_DSN", DSN);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(() => reportError(new Error("x"), { code: "SOME_EVENT" })).not.toThrow();
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("sync failure"); }));
    expect(() => reportError(new Error("y"), { code: "SOME_EVENT" })).not.toThrow();
  });

  it("samples with ERROR_REPORT_SAMPLE_RATE, default 1", () => {
    vi.stubEnv("ERROR_REPORT_DSN", DSN);
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ERROR_REPORT_SAMPLE_RATE", "0.25");
    reportError(new Error("a"), { code: "SOME_EVENT" }, () => 0.5);
    expect(fetchMock).not.toHaveBeenCalled();
    reportError(new Error("b"), { code: "SOME_EVENT" }, () => 0.1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sampleRate(undefined)).toBe(1);
    expect(sampleRate("")).toBe(1);
    expect(sampleRate("nonsense")).toBe(1);
    expect(sampleRate("7")).toBe(1);
    expect(sampleRate("-1")).toBe(0);
    expect(sampleRate("0")).toBe(0);
  });

  it("builds an event from a bare value that is not an Error", () => {
    const event = buildEvent("a string with anna@example.test", { code: "not a code" });
    expect(JSON.stringify(event)).not.toContain("anna");
    expect(event.tags.event_code).toBe("UNKNOWN");
    expect(buildEnvelope(event).split("\n")).toHaveLength(3);
    expect(stackFrames(undefined)).toEqual([]);
  });
});
