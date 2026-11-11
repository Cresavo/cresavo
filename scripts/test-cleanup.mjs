import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { assertTestDatabase } from "./test-db-guard.mjs";
assertTestDatabase();
const marker = `e2e-cleanup-${randomUUID()}`;
const run = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.cleanup.config.ts",
  ],
  {
    encoding: "utf8",
    timeout: 60000,
    env: { ...process.env, CLEANUP_PROBE_MARKER: marker },
  },
);
const db = new PrismaClient();
try {
  const rows =
    (await db.booking.count({
      where: { customerEmail: { startsWith: marker } },
    })) + (await db.campaign.count({ where: { title: marker } }));
  const passed =
    run.status === 1 &&
    /Test timeout of 1000ms exceeded/.test(run.stdout) &&
    rows === 0;
  console.log(
    `CLEANUP_TIMEOUT_EXPECTED_EXIT=${run.status}; REMAINING_SYNTHETIC_ROWS=${rows}; ${passed ? "PASS" : "FAIL"}`,
  );
  if (!passed) {
    console.log(run.stdout);
    console.log(run.stderr);
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
