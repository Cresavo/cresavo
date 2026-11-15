import { defineConfig } from "@playwright/test";
import { assertTestDatabase } from "./scripts/test-db-guard.mjs";
assertTestDatabase();
export default defineConfig({
  testDir: "./tests/time-card-ui",
  testMatch: "card.spec.ts",
  outputDir: "./demo-artifacts/time-card/test-results",
  workers: 1,
  timeout: 45000,
  reporter: "list",
  use: {
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    trace: "retain-on-failure",
  },
});
