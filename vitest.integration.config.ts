import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { assertNoQueryLogging, assertTestDatabase } from "./scripts/test-db-guard.mjs";
assertTestDatabase();
assertNoQueryLogging();
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["tests/integration/*.test.ts"], fileParallelism: false },
});
