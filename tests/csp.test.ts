import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import { contentSecurityPolicy, createNonce, cspExempt } from "../src/lib/csp";
import { proxy } from "../src/proxy";

afterEach(() => vi.unstubAllEnvs());

const directive = (policy: string, name: string) => policy.split("; ").find((part) => part.startsWith(`${name} `));

it("allows scripts only by nonce and never inline or eval in production", () => {
  const policy = contentSecurityPolicy("abc", "/studio", true);
  expect(directive(policy, "script-src")).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
  expect(directive(policy, "object-src")).toBe("object-src 'none'");
  expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
  expect(policy).not.toMatch(/script-src[^;]*unsafe/);
  expect(directive(contentSecurityPolicy("abc", "/studio", false), "script-src")).toContain("'unsafe-eval'");
});

it("keeps framing closed except the booking page for its own editor and the public widget", () => {
  const frames = (path: string) => directive(contentSecurityPolicy("n", path, true), "frame-ancestors");
  expect(frames("/studio")).toBe("frame-ancestors 'none'");
  expect(frames("/admin")).toBe("frame-ancestors 'none'");
  expect(frames("/boka/salong-eko")).toBe("frame-ancestors 'self'");
  expect(frames("/boka/salong-eko/widget")).toBe("frame-ancestors *");
  expect(frames("/boka/salong-eko/manage")).toBe("frame-ancestors 'none'");
});

it("creates unpredictable base64 nonces", () => {
  const nonces = new Set(Array.from({ length: 50 }, createNonce));
  expect(nonces.size).toBe(50);
  for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
});

it("leaves the OAuth consent page to its own policy", () => {
  expect(cspExempt("/oauth/authorize")).toBe(true);
  expect(cspExempt("/oauth/authorize/")).toBe(true);
  expect(cspExempt("/oauth/token")).toBe(false);
});

it("sends a fresh nonce on the response and replaces client-supplied CSP request headers", () => {
  vi.stubEnv("PUBLIC_READONLY", undefined);
  const request = () => new NextRequest("http://localhost:3100/studio", {
    headers: { host: "localhost:3100", "x-nonce": "forged", "content-security-policy": "script-src *" },
  });
  const first = proxy(request());
  const second = proxy(request());
  const policy = first.headers.get("Content-Security-Policy")!;
  const nonce = /'nonce-([^']+)'/.exec(policy)![1];
  expect(nonce).not.toBe("forged");
  expect(second.headers.get("Content-Security-Policy")).not.toBe(policy);
  // NextResponse.next forwards overridden request headers as x-middleware-request-* headers.
  expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
  expect(first.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
  expect(proxy(new NextRequest("http://localhost:3100/oauth/authorize", { headers: { host: "localhost:3100" } })).headers.get("Content-Security-Policy")).toBeNull();
});
