import { defineConfig } from "@playwright/test";

// The phone receptionist's browser test call, with the deployment switch on.
// The Realtime API is replaced by a scripted peer inside the page, so no key
// is needed and nothing leaves the machine; the microphone is Chromium's fake.
export default defineConfig({
  testDir: "./tests/receptionist-e2e",
  timeout: 90000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3018", browserName: "chromium", channel: process.env.CONCEPT_BROWSER_CHANNEL,
    locale: "en-GB", timezoneId: "Europe/Stockholm", trace: "retain-on-failure",
    permissions: ["microphone"],
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 900 } } },
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "node scripts/server.mjs --dev", url: "http://127.0.0.1:3018/studio", timeout: 180000,
    env: { PORT: "3018", DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/concept_demo", PHONE_RECEPTIONIST_ENABLED: "1", OPENAI_API_KEY: "", ANTHROPIC_API_KEY: "", OPENROUTER_API_KEY: "", PUBLIC_READONLY: "", NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN: "localhost", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
