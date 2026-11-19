import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/*.test.ts", "tests/store-contract/*.test.ts"],
    // Unit tests never connect; construction must not load an operator's .env.
    env: { DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/unit_test" },
  },
});
