import { afterEach, describe, expect, it, vi } from "vitest";

const originCheck = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/auth", () => ({ sameOrigin: originCheck }));
import { POST } from "../src/app/api/locale/route";

afterEach(() => vi.unstubAllEnvs());
function request(body: string) {
  return new Request("http://localhost/api/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
describe("locale preference boundary", () => {
  it("rejects another origin before reading or setting a preference", async () => {
    originCheck.mockResolvedValue(false);
    const response = await POST(request('{"locale":"en"}'));
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
  it("rejects malformed and unsupported preferences without a cookie", async () => {
    originCheck.mockResolvedValue(true);
    for (const body of [
      "{",
      "null",
      '"en"',
      '{"locale":"fr"}',
      '{"locale":["en"]}',
    ]) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });
  it("sets an HTTP-only secure production preference and prevents response caching", async () => {
    originCheck.mockResolvedValue(true);
    vi.stubEnv("NODE_ENV", "production");
    const response = await POST(request('{"locale":"en"}'));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.headers.get("set-cookie")!;
    for (const attribute of [
      "booking-locale=en",
      "HttpOnly",
      "Secure",
      "SameSite=lax",
      "Path=/",
    ])
      expect(cookie).toContain(attribute);
  });
});
