// Resets the customer-agent demo (docs/demo-agentic-booking.md) on a local *_demo or *_test database.
// Removes only what the demo's own OAuth clients did: the scripted assistant's registrations (from the
// ledger) and any `--client <id>` given. With `--claude-code`, also Claude Code's grants made since the
// last reset (its published client id is shared, so never older ones). Hosted databases are refused.
import { spawnSync } from "node:child_process";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { createDatabaseClient } from "../database.mjs";
import { CLAUDE_CODE_CLIENT, readLedger, writeLedger } from "./ledger.mjs";
import { resetDemoClients } from "./reset-lib.mjs";

assertTestDatabase();
const extra = process.argv.flatMap((arg, i, all) => arg === "--client" && all[i + 1] ? [all[i + 1]] : []);
const db = createDatabaseClient();
try {
  const ledger = readLedger();
  const shared = process.argv.includes("--claude-code") ? { clientId: CLAUDE_CODE_CLIENT, since: new Date(ledger.since) } : null;
  const counts = await db.$transaction(tx => resetDemoClients(tx, [...ledger.clients, ...extra], shared));
  writeLedger({ clients: [], since: new Date().toISOString() });
  const seed = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { stdio: "inherit" });
  if (seed.status !== 0) throw new Error("Seed failed");
  console.log(`Agentic demo reset: ${counts.grants} assistant connection(s) and ${counts.bookings} booking(s) removed, seed applied.`);
} catch { console.error("Demo reset failed."); process.exitCode = 1; }
finally { await db.$disconnect(); }
