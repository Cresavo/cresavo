// Resets the customer-agent demo (docs/demo-agentic-booking.md) on a local *_demo or *_test database.
// Removes only what the demo's own OAuth clients did: the scripted assistant's registrations (from the
// ledger, written by `npm run demo:agentic:e2e`). There is no way to name another client. Published clients such as Claude Code are never
// touched (their id is shared by every user). Hosted databases are refused.
import { spawnSync } from "node:child_process";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { createDatabaseClient } from "../database.mjs";
import { readLedger, writeLedger } from "./ledger.mjs";
import { resetDemoClients } from "./reset-lib.mjs";

assertTestDatabase();
const db = createDatabaseClient();
try {
  const counts = await db.$transaction(tx => resetDemoClients(tx, readLedger()));
  writeLedger([]);
  const seed = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { stdio: "inherit" });
  if (seed.status !== 0) throw new Error("Seed failed");
  console.log(`Agentic demo reset: ${counts.grants} assistant connection(s) and ${counts.bookings} booking(s) removed, seed applied.`);
} catch { console.error("Demo reset failed."); process.exitCode = 1; }
finally { await db.$disconnect(); }
