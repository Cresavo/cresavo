import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// The security headers of each route class, as a browser receives them: the static ones come from next.config.ts,
// the per-request ones (CSP with a nonce, framing) from the proxy.

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

type Rule = { source: string; headers: { key: string; value: string }[] };

/** A path segment pattern of next.config `headers()` as a regular expression, for the two shapes the config uses. */
function sourceMatches(source: string, path: string) {
  if (source === "/:path*") return true;
  if (source === "/admin/:path*") return path === "/admin" || path.startsWith("/admin/");
  throw new Error(`The test does not know the source ${source}`);
}

async function headersOf(path: string, production: boolean, host = "localhost:3100") {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", production ? "production" : "development");
  vi.stubEnv("PUBLIC_READONLY", undefined);
  const config = (await import("../next.config")).default;
  const rules = (await config.headers!()) as Rule[];
  const merged = new Map<string, string>();
  for (const rule of rules) {
    if (/^\/:path\(\(\?!/.test(rule.source)) continue; // the OAuth opener-policy rule
    if (sourceMatches(rule.source, path)) for (const { key, value } of rule.headers) merged.set(key.toLowerCase(), value);
  }
  const { proxy } = await import("../src/proxy");
  const response = proxy(new NextRequest(`http://${host}${path}`, { headers: { host } }));
  for (const name of ["content-security-policy", "x-frame-options"]) {
    const value = response.headers.get(name);
    if (value) merged.set(name, value);
  }
  return merged;
}

const directive = (policy: string, name: string) => policy.split("; ").find((part) => part.startsWith(`${name} `));

const ROUTE_CLASSES = [
  { name: "studio", path: "/studio", frame: "DENY", ancestors: "'none'" },
  { name: "owner page", path: "/account", frame: "DENY", ancestors: "'none'" },
  { name: "owner password reset page", path: "/account/reset", frame: "DENY", ancestors: "'none'" },
  { name: "owner API", path: "/api/owner/login", frame: "DENY", ancestors: "'none'" },
  { name: "owner session API", path: "/api/owner/me", frame: "DENY", ancestors: "'none'" },
  { name: "owner password reset API", path: "/api/owner/password/reset-request", frame: "DENY", ancestors: "'none'" },
  { name: "public API", path: "/api/public/salons/salong-eko", frame: "DENY", ancestors: "'none'" },
  { name: "concept API", path: "/api/concept/ai/reply-customer", frame: "DENY", ancestors: "'none'" },
  { name: "booking page", path: "/boka/salong-eko", frame: "SAMEORIGIN", ancestors: "'self'" },
  { name: "booking widget", path: "/boka/salong-eko/widget", frame: null, ancestors: "*" },
  { name: "booking management", path: "/boka/salong-eko/booking/abc", frame: "DENY", ancestors: "'none'" },
] as const;

describe.each([false, true])("security headers (production: %s)", (production) => {
  describe.each(ROUTE_CLASSES)("$name", ({ path, frame, ancestors }) => {
    it("sets the content type, referrer and permissions policies", async () => {
      const headers = await headersOf(path, production);
      expect(headers.get("x-content-type-options")).toBe("nosniff");
      expect(headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
      expect(headers.get("permissions-policy")).toMatch(/camera=\(\)/);
      expect(headers.get("permissions-policy")).toMatch(/microphone=\(\)/);
      expect(headers.get("permissions-policy")).toMatch(/geolocation=\(\)/);
    });

    it("sets a nonce-based CSP and the framing rule for this class", async () => {
      const headers = await headersOf(path, production);
      const policy = headers.get("content-security-policy")!;
      expect(directive(policy, "script-src")).toMatch(/^script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
      expect(directive(policy, "frame-ancestors")).toBe(`frame-ancestors ${ancestors}`);
      expect(directive(policy, "object-src")).toBe("object-src 'none'");
      expect(headers.get("x-frame-options") ?? null).toBe(frame);
    });

    it(production ? "sends HSTS" : "does not send HSTS over plain http", async () => {
      const headers = await headersOf(path, production);
      if (production) expect(headers.get("strict-transport-security")).toMatch(/^max-age=\d{8,}/);
      else expect(headers.has("strict-transport-security")).toBe(false);
    });
  });
});

describe("framing", () => {
  it("allows framing by other sites only for the widget", async () => {
    const framable = [];
    for (const { name, path } of ROUTE_CLASSES) {
      const policy = (await headersOf(path, true)).get("content-security-policy")!;
      if (directive(policy, "frame-ancestors") !== "frame-ancestors 'none'") framable.push(`${name}: ${directive(policy, "frame-ancestors")}`);
    }
    expect(framable).toEqual(["booking page: frame-ancestors 'self'", "booking widget: frame-ancestors *"]);
  });

  it("follows the page a business's own address rewrites to, so its widget can be embedded and its settings cannot", async () => {
    const own = "boka.salong-eko.example";
    const widget = await headersOf("/widget", true, own);
    expect(directive(widget.get("content-security-policy")!, "frame-ancestors")).toBe("frame-ancestors *");
    expect(widget.has("x-frame-options")).toBe(false);
    const manage = await headersOf("/me", true, own);
    expect(directive(manage.get("content-security-policy")!, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(manage.get("x-frame-options")).toBe("DENY");
  });

  it("keeps the admin workspace closed to framing and out of caches", async () => {
    const headers = await headersOf("/admin/bookings", true);
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("cache-control")).toBe("no-store");
  });
});

describe("script policy", () => {
  it("allows eval only outside production", async () => {
    expect((await headersOf("/studio", false)).get("content-security-policy")).toContain("'unsafe-eval'");
    expect((await headersOf("/studio", true)).get("content-security-policy")).not.toContain("'unsafe-eval'");
  });

  it("uses a different nonce for every request", async () => {
    const nonce = async () => /'nonce-([^']+)'/.exec((await headersOf("/studio", true)).get("content-security-policy")!)![1];
    expect(await nonce()).not.toBe(await nonce());
  });
});
