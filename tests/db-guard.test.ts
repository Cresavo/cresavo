import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

for (const [label, args] of [
  [
    "integration",
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "--config",
      "vitest.integration.config.ts",
    ],
  ],
  ["E2E", ["node_modules/@playwright/test/cli.js", "test", "--list"]],
] as const) {
  it(`${label} avslutas före testinsamling med en osäker databasadress`, () => {
    const result = spawnSync(process.execPath, [...args], {
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://synthetic@unreachable.invalid/production",
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("TEST_DATABASE_REFUSED");
    expect(result.stderr + result.stdout).not.toContain("Can't reach database");
  }, 25000);
}
