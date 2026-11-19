import { defineConfig } from "@playwright/test";
import { assertTestDatabase } from "./scripts/test-db-guard.mjs";

assertTestDatabase();
export default defineConfig({
  testDir: "./tests/pairing", testMatch: "*.spec.ts", workers: 1, timeout: 120000,
  use: { baseURL: "http://127.0.0.1:3740", locale: "en-GB", timezoneId: "Europe/Stockholm",
    viewport: { width: 1280, height: 900 }, channel: process.env.CONCEPT_BROWSER_CHANNEL },
});
