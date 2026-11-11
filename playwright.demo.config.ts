import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  grep: /bokning, skyddad administration och MCP-utkast|lokal MCP-bokning/,
  outputDir: process.env.BOOKING_DEMO_OUTPUT,
  webServer: {
    ...base.webServer,
    command: "npm run start -- --hostname 127.0.0.1",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 120000,
    env: { TRUST_PROXY_IP: "0", NEXT_TELEMETRY_DISABLED: "1" },
  },
  use: { ...base.use, video: "on", trace: "off" },
});
