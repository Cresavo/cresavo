import { defineConfig } from "@playwright/test";
import { base, serverEnvironment } from "./tests/pairing/server";

const env = serverEnvironment();
export default defineConfig({
  testDir: "./tests/pairing", testMatch: "*.spec.ts", workers: 1, timeout: 120000,
  webServer: { command: "node tests/pairing/serve.mjs --dev --hostname 127.0.0.1", env,
    wait: { stdout: /^BOOKING_SERVER_READY$/m }, reuseExistingServer: false, timeout: 120000 },
  use: { baseURL: base, locale: "en-GB", timezoneId: "Europe/Stockholm",
    viewport: { width: 1280, height: 900 }, channel: process.env.CONCEPT_BROWSER_CHANNEL },
});
