import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig(base, {
  grep: /bokning, skyddad administration och MCP-utkast/,
  outputDir: process.env.BOOKING_DEMO_OUTPUT,
  use: { ...base.use, video: "on", trace: "off" }
});
