import { defineConfig } from "@playwright/test";
import { assertTestDatabase } from "./scripts/test-db-guard.mjs";
assertTestDatabase();
export default defineConfig({
  testDir: "./tests/time-card-ui",
  outputDir: "./demo-artifacts/agent-workday/test-results",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3197",
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://localhost:3197",
    reuseExistingServer: false,
    env: { PORT: "3197", TRUST_PROXY_IP: "0", NEXT_TELEMETRY_DISABLED: "1", LEGACY_HOME: "1" },
    timeout: 120000,
  },
});
