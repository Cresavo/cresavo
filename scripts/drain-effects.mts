// One run of the studio store's effect outbox poller (docs/design/STUDIO_STORE.md,
// step 2, item 4), for a cron or a scheduled job:
//
//   npm run effects:drain -- [--limit 100] [--lease-ms 60000] [--max-attempts 10]
//
// Staging only: no live provider sinks are wired yet, so only demo and sandbox
// tenants' effects are delivered (to the simulated sinks, which send nothing).
// Salon effects are left pending, unclaimed, for the live sinks of a later step.
// Prints counts only: never payloads, which may hold personal data.
import { parseArgs } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { drainPendingEffects } from "../src/concept/store/effect-outbox";
import { createDatabaseClient } from "./database.mjs";

const { values } = parseArgs({
  options: {
    limit: { type: "string" },
    "lease-ms": { type: "string" },
    "max-attempts": { type: "string" },
  },
});
const number = (value: string | undefined) => (value === undefined ? undefined : Number(value));

const prisma = createDatabaseClient(process.env.DATABASE_URL, 2) as PrismaClient;
try {
  const report = await drainPendingEffects({
    prisma,
    limit: number(values.limit),
    leaseMs: number(values["lease-ms"]),
    maxAttempts: number(values["max-attempts"]),
  });
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "EFFECT_DRAIN_FAILED");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
