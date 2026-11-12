import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/*.test.ts"],
    // Unit tests never connect; construction must not load an operator's .env.
    env: { DATABASE_URL: "postgresql://synthetic@127.0.0.1:1/unit_test" },
  },
});
