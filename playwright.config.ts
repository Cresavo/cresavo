import { defineConfig, devices } from "@playwright/test";
import { assertTestDatabase } from "./scripts/test-db-guard.mjs";
assertTestDatabase();
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        extraHTTPHeaders: { "x-real-ip": "192.0.2.1" },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        extraHTTPHeaders: { "x-real-ip": "192.0.2.2" },
      },
    },
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "sv-SE",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    env: { TRUST_PROXY_IP: "1", NEXT_TELEMETRY_DISABLED: "1" },
    timeout: 120000,
  },
});
