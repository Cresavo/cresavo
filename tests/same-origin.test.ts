import { afterEach, describe, expect, it, vi } from "vitest";
import { isSameOriginWrite, originMatchesSite } from "../src/lib/same-origin";
import { fromSameOrigin } from "../src/concept/server/same-origin";
import nextConfig from "../next.config";

const reader = (values: Record<string, string>) => (name: string) => values[name] ?? null;

afterEach(() => vi.unstubAllEnvs());

describe("originMatchesSite", () => {
  it("rejects missing, opaque, invalid and foreign origins", () => {
    const read = reader({ host: "demo.test" });
    for (const origin of [null, undefined, "", "null", "invalid", "https://other.test", "https://demo.test.evil.test", "ftp://demo.test"])
      expect(originMatchesSite(origin, read)).toBe(false);
    expect(originMatchesSite("https://demo.test", read)).toBe(true);
    expect(originMatchesSite("https://DEMO.test", reader({ host: "Demo.Test" }))).toBe(true);
  });

  it("uses the trusted forwarded host on Vercel and ignores it elsewhere", () => {
    const read = reader({ host: "internal.vercel.app", "x-forwarded-host": "demo.test" });
    expect(originMatchesSite("https://demo.test", read)).toBe(false);
    vi.stubEnv("BOOKING_RUNTIME", "vercel");
    vi.stubEnv("VERCEL", "1");
    expect(originMatchesSite("https://demo.test", read)).toBe(true);
    expect(originMatchesSite("https://internal.vercel.app", read)).toBe(false);
  });

  it("falls back to the request URL host when no Host header is present", () => {
    expect(originMatchesSite("http://localhost", reader({}), "localhost")).toBe(true);
    expect(originMatchesSite("http://localhost", reader({}))).toBe(false);
  });

  it("requires https in production except on loopback", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(originMatchesSite("http://demo.test", reader({ host: "demo.test" }))).toBe(false);
    expect(originMatchesSite("https://demo.test", reader({ host: "demo.test" }))).toBe(true);
    expect(originMatchesSite("http://127.0.0.1:3000", reader({ host: "127.0.0.1:3000" }))).toBe(true);
    expect(originMatchesSite("http://localhost:3000", reader({ host: "localhost:3000" }))).toBe(true);
  });
});

describe("isSameOriginWrite", () => {
  it("needs a matching Origin and no cross-site fetch metadata", () => {
    expect(isSameOriginWrite(reader({ host: "demo.test", origin: "https://demo.test" }))).toBe(true);
    expect(isSameOriginWrite(reader({ host: "demo.test", origin: "https://demo.test", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginWrite(reader({ host: "demo.test", "sec-fetch-site": "same-origin" }))).toBe(false);
    for (const site of ["cross-site", "same-site", "none"])
      expect(isSameOriginWrite(reader({ host: "demo.test", origin: "https://demo.test", "sec-fetch-site": site }))).toBe(false);
  });
});

describe("fromSameOrigin", () => {
  const request = (headers: Record<string, string>) => new Request("http://localhost/api/concept/ai/demo", { method: "POST", headers });

  it("lets fetch metadata decide, so same-origin GETs without Origin pass", () => {
    expect(fromSameOrigin(request({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(fromSameOrigin(request({ "sec-fetch-site": "cross-site", origin: "http://localhost" }))).toBe(false);
    expect(fromSameOrigin(request({ origin: "http://localhost" }))).toBe(true);
    expect(fromSameOrigin(request({ origin: "http://other.test" }))).toBe(false);
    expect(fromSameOrigin(request({}))).toBe(false);
  });
});

describe("security headers", () => {
  it("sends Permissions-Policy everywhere and COOP outside the OAuth and consent flow", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((rule) => rule.source === "/:path*")!;
    expect(all.headers).toContainEqual({ key: "Permissions-Policy", value: expect.stringContaining("camera=()") });
    expect(JSON.stringify(all.headers)).not.toContain("clipboard");
    const coop = rules.find((rule) => rule.headers.some((h) => h.key === "Cross-Origin-Opener-Policy"))!;
    const pattern = new RegExp(`^/${coop.source.slice("/:path(".length, -1)}$`);
    for (const path of ["studio", "boka/salong-eko", "admin/bookings", ""]) expect(pattern.test(`/${path}`)).toBe(true);
    for (const path of ["oauth/authorize", "authorize", "consent/abc"]) expect(pattern.test(`/${path}`)).toBe(false);
  });
});
