import { describe, expect, it } from "vitest";
import { formatLogLine, requestIdFor, withRequestLog, type RequestLogFields } from "@/concept/server/logger";

const fields: RequestLogFields = { requestId: "123e4567-e89b-42d3-a456-426614174000", route: "/api/concept/ai/[task]", method: "POST", status: 200, durationMs: 12.6, task: "answer-help" };

describe("request logger", () => {
  it("writes one JSON line with the fixed fields", () => {
    expect(JSON.parse(formatLogLine(fields))).toEqual({ level: "info", msg: "request", requestId: "123e4567-e89b-42d3-a456-426614174000", route: "/api/concept/ai/[task]", method: "POST", status: 200, durationMs: 13, task: "answer-help" });
  });

  it("sets the level from the status", () => {
    expect(JSON.parse(formatLogLine({ ...fields, status: 404 })).level).toBe("warn");
    expect(JSON.parse(formatLogLine({ ...fields, status: 500 })).level).toBe("error");
  });

  it("copies only known fields: input text, keys and personal data cannot get in", () => {
    const hostile = { ...fields, body: "Anna Andersson 070-123 45 67", apiKey: "sk-secret-123", query: "?phone=070", error: "Failed for anna@example.se", task: "answer-help; DROP TABLE" };
    const line = formatLogLine(hostile as RequestLogFields);
    for (const secret of ["Anna", "070", "sk-secret", "example.se", "DROP"]) expect(line).not.toContain(secret);
    expect(Object.keys(JSON.parse(line)).sort()).toEqual(["durationMs", "level", "method", "msg", "requestId", "route", "status"]);
  });

  it("keeps a plain error class name but not a message", () => {
    expect(JSON.parse(formatLogLine({ ...fields, error: "SyntaxError" })).error).toBe("SyntaxError");
  });

  it("propagates only UUID v4 request ids", () => {
    const withId = (id: string) => requestIdFor(new Request("http://x/", { headers: { "x-request-id": id } }));
    const valid = "123e4567-e89b-42d3-a456-426614174000";
    expect(withId(valid)).toBe(valid);
    expect(withId("client-req-0001")).not.toBe("client-req-0001");
    expect(requestIdFor(new Request("http://x/"))).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each(["0701234567", "person@example.test"])("does not log or echo a personal-data-shaped request id", async (given) => {
    const lines: string[] = [];
    const handler = withRequestLog("/api/concept/help", () => new Response(), (line) => lines.push(line));
    const response = await handler(new Request("http://x/", { headers: { "x-request-id": given } }), undefined);
    expect(response.headers.get("x-request-id")).not.toContain(given);
    expect(lines[0]).not.toContain(given);
    expect(JSON.parse(lines[0]).requestId).toBe(response.headers.get("x-request-id"));
    expect(JSON.parse(formatLogLine({ ...fields, requestId: given })).requestId).toBe("invalid");
  });

  it("propagates a valid UUID v4 to the response and log", async () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    const lines: string[] = [];
    const handler = withRequestLog("/api/concept/help", () => new Response(), (line) => lines.push(line));
    const response = await handler(new Request("http://x/", { headers: { "x-request-id": id } }), undefined);
    expect(response.headers.get("x-request-id")).toBe(id);
    expect(JSON.parse(lines[0]).requestId).toBe(id);
  });

  it("adds x-request-id to the response and logs route, status and task without the body", async () => {
    const lines: string[] = [];
    const handler = withRequestLog("/api/concept/ai/[task]", async (request: Request, _context: unknown, log) => {
      log.task = "answer-help";
      await request.json();
      return Response.json({ ok: true });
    }, (line) => lines.push(line));
    const response = await handler(new Request("http://x/api/concept/ai/answer-help?phone=070", { method: "POST", body: JSON.stringify({ question: "Anna Andersson has 070-123 45 67" }) }), undefined);
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ route: "/api/concept/ai/[task]", method: "POST", status: 200, task: "answer-help", requestId: response.headers.get("x-request-id") });
    // The random request id and the timing can contain any digits, so only the other fields are checked for "070".
    const fields = Object.entries(entry).filter(([key]) => key !== "requestId" && key !== "durationMs");
    expect(JSON.stringify(fields)).not.toMatch(/Anna|070|phone/);
    expect(lines[0]).not.toMatch(/Anna|phone/);
  });

  it("turns a thrown error into a 500 with only the error class in the log", async () => {
    const lines: string[] = [];
    const handler = withRequestLog("/api/concept/help", () => {
      throw new TypeError("secret detail anna@example.se");
    }, (line) => lines.push(line));
    const response = await handler(new Request("http://x/api/concept/help"), undefined);
    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(JSON.parse(lines[0])).toMatchObject({ level: "error", status: 500, error: "TypeError" });
    expect(lines[0]).not.toContain("secret");
  });
});
