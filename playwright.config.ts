import { defineConfig, devices } from "@playwright/test";
import { assertTestDatabase } from "./scripts/test-db-guard.mjs";
assertTestDatabase();
export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "sv-SE",
  },
  webServer: {
    command: process.env.E2E_PRODUCTION
      ? "npm run start -- --hostname 127.0.0.1"
      : "npm run dev -- --hostname 127.0.0.1",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: {
      PORT: "3000", // Fixed baseURL; an operator's .env may use another app port.
      TRUST_PROXY_IP: process.env.TRUST_PROXY_IP ?? "0",
      TRUSTED_PROXY_IPS: "127.0.0.10/32",
      NEXT_TELEMETRY_DISABLED: "1",
      LEGACY_HOME: "1", // These suites test the older lab home at "/"; without it "/" is the product site.
      // Canary: the obsolete shared-password variable must never authenticate.
      ADMIN_PASSWORD: "synthetic-legacy-password-not-used",
    },
    timeout: 120000,
  },
});
