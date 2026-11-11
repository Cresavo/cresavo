import { defineConfig } from "@playwright/test";
import { assertTestDatabase } from "./scripts/test-db-guard.mjs";
assertTestDatabase();
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "cleanup.probe.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/cleanup-probe",
});
