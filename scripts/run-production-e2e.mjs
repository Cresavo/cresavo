import { spawnSync } from "node:child_process";
import { assertTestDatabase } from "./test-db-guard.mjs";
assertTestDatabase();
for (const args of [
  ["node_modules/next/dist/bin/next", "build"],
  ["node_modules/@playwright/test/cli.js", "test"],
]) {
  const run = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      E2E_PRODUCTION: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      CHECKPOINT_DISABLE: "1",
    },
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
