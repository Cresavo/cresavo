import { defineConfig } from "vitest/config";
import { assertTestDatabase } from "./scripts/test-db-guard.mjs";
assertTestDatabase();
export default defineConfig({
  test: { include: ["tests/integration/*.test.ts"], fileParallelism: false },
});
