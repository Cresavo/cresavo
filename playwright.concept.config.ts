import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/concept-e2e",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3017", browserName: "chromium", channel: process.env.CONCEPT_BROWSER_CHANNEL,
    locale: "en-GB", timezoneId: "Europe/Stockholm", trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 900 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "node scripts/server.mjs --dev", url: "http://127.0.0.1:3017/studio", timeout: 180000,
    env: { PORT: "3017", DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/concept_demo", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "", PUBLIC_READONLY: "", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
