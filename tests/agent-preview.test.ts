import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

const valid = {
  NODE_ENV: "test", VERCEL: "1", VERCEL_ENV: "preview", BOOKING_RUNTIME: "vercel",
  RATE_LIMIT_STORE: "postgres", SESSION_SECRET: "synthetic-test-placeholder-32-characters",
  DATABASE_URL: "postgresql://synthetic@proof.neon.tech/agentprov_demo?sslmode=require",
} as const;
function check(overrides: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, ["scripts/preview-preflight.mjs"], {
    env: { ...valid, ...overrides }, encoding: "utf8",
  });
}
it("checks preview configuration shape without connecting or claiming protection", () => {
  const result = check();
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("PREVIEW_CONFIG_SHAPE_OK_PROTECTION_NOT_VERIFIED");
  expect(result.stdout + result.stderr).not.toContain(valid.DATABASE_URL);
  expect(result.stdout + result.stderr).not.toContain(valid.SESSION_SECRET);
});
it.each([
  { VERCEL_ENV: "production" }, { RATE_LIMIT_STORE: "memory" }, { SESSION_SECRET: "short" },
  { DATABASE_URL: "postgresql://synthetic@proof.neon.tech/customer_db?sslmode=require" },
  { DATABASE_URL: "postgresql://synthetic@proof.neon.tech/agentprov_demo" },
  { DATABASE_URL: `${valid.DATABASE_URL}&host=another.invalid` },
  { BOOKING_DEMO_ACCESS: "1" }, { BOOKING_A2A_DEMO: "1" },
])("refuses unsafe preview shape %#", (input) => {
  const result = check(input);
  expect(result.status).toBe(1);
  expect(result.stderr).toMatch(/PREVIEW_[A-Z_]+/);
  expect(result.stdout).toBe("");
});
