import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SANDBOX_INCOMPATIBLE_FLAGS, SANDBOX_INCOMPATIBLE_SETTINGS, sandboxConfig } from "@/lib/agent-api/sandbox/config";
import { letAiBookGuide } from "@/app/let-ai-book/guide";
import { proxy } from "@/proxy";

const hosted = {
  NODE_ENV: "test",
  BOOKING_SANDBOX: "1",
  BOOKING_CONSENT_DELIVERY: "sandbox-demo-phone",
  BOOKING_SERVICE_ROLE: "salon",
  BOOKING_RUNTIME: "vercel",
  BOOKING_SANDBOX_PROJECT_ID: "prj_ExampleSandbox",
  VERCEL_PROJECT_ID: "prj_ExampleSandbox",
  BOOKING_SANDBOX_ORIGIN: "https://sandbox.example.test",
  BOOKING_PUBLIC_ORIGIN: "https://gateway.example.test",
  DATABASE_URL: "postgresql://provider@pg.example.test/sandbox?sslmode=verify-full",
  BOOKING_SANDBOX_DB_ID: "0196a07e-f751-48fa-8a1c-8e53e034a120",
  GATEWAY_SERVICE_TOKEN: "a".repeat(64),
  SESSION_SECRET: "b".repeat(64),
  VERCEL: "1",
  VERCEL_ENV: "production",
  RATE_LIMIT_STORE: "postgres",
} as const;

it("limits the sealed profile to its actual production project and caps hosted sessions", () => {
  expect(sandboxConfig(hosted).sessionLimit).toBe(8);
  expect(() => sandboxConfig({ ...hosted, VERCEL_PROJECT_ID: "prj_Other" })).toThrow();
  expect(() => sandboxConfig({ ...hosted, VERCEL_PROJECT_ID: undefined })).toThrow();
  expect(() => sandboxConfig({ ...hosted, VERCEL_ENV: "preview" })).toThrow();
  expect(() => sandboxConfig({ ...hosted, NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO: "1" })).toThrow();
  expect(() => sandboxConfig({ ...hosted, DATABASE_URL: hosted.DATABASE_URL.replace("verify-full", "require") })).toThrow();
  expect(() => sandboxConfig({ ...hosted, DATABASE_URL: hosted.DATABASE_URL + "&ssl=false" })).toThrow();
  // proxy() and sandboxConfig() read process.env. A developer machine may have
  // an AI key or other incompatible setting in the environment; the sealed
  // hosted profile must be tested without those leftovers, or the proxy returns 503.
  const applyHosted = () => {
    for (const key of [...SANDBOX_INCOMPATIBLE_FLAGS, ...SANDBOX_INCOMPATIBLE_SETTINGS]) vi.stubEnv(key, undefined);
    for (const [key, value] of Object.entries(hosted)) vi.stubEnv(key, value);
  };
  applyHosted();
  try {
    const origin = hosted.BOOKING_SANDBOX_ORIGIN;
    const req = (path: string) => new NextRequest(origin + path, { headers: { host: new URL(origin).host } });
    vi.stubEnv(SANDBOX_INCOMPATIBLE_SETTINGS[0], "synthetic-not-a-secret");
    expect(proxy(req("/")).status).toBe(503);
    applyHosted();
    expect(proxy(req("/")).headers.get("location")).toBe(origin + "/sandbox?lang=sv");
    expect(proxy(req("/admin")).status).toBe(404);
    expect(proxy(req("/api/pairing/sweep")).status).toBe(404);
    const page = proxy(req("/sandbox"));
    const policy = page.headers.get("Content-Security-Policy");
    expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(page.headers.get("x-middleware-request-content-security-policy")).toBe(policy);
    expect(proxy(req("/_next/static/chunks/app.js")).headers.get("Content-Security-Policy")).toBeNull();
  } finally { vi.unstubAllEnvs(); }
});

it("schedules the reset only in the sandbox config and renders the guide without API access", async () => {
  const local = (file: string) => JSON.parse(readFileSync(new URL("../" + file, import.meta.url), "utf8"));
  expect(local("vercel.sandbox.json").crons).toEqual([{ path: "/api/sandbox/reset", schedule: "15 3 * * *" }]);
  expect(local("vercel.json").crons).toEqual([{ path: "/api/pairing/sweep", schedule: "15 3 * * *" }]);
  const swedish = await letAiBookGuide("sv").text();
  const english = await letAiBookGuide("en").text();
  expect(swedish).toContain("Låt AI boka");
  expect(english).toContain("Let AI book");
  for (const html of [swedish, english]) {
    expect(html).toContain("https://sandbox.cresavo.com/");
    expect(html).toContain("https://gateway.cresavo.com/llms.txt");
    expect(html).not.toMatch(/<script|\bfetch\s*\(|\/api\//i);
  }
});
