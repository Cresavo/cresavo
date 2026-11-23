// One run of the studio store's effect outbox poller (docs/design/STUDIO_STORE.md,
// step 2, item 4), for a cron or a scheduled job:
//
//   npm run effects:drain -- [--limit 100] [--lease-ms 60000] [--max-attempts 10]
//
// Salon booking e-mails go through the e-mail connection (simulated unless a
// provider is live); payments and SMS are acknowledged without sending. Demo and
// sandbox tenants only ever reach the simulated sinks. Run it every minute as
// the backstop for effects an apply could not deliver (docs/integrations/README.md).
// Prints counts only: never payloads, which may hold personal data.
import { parseArgs } from "node:util";
import type { PrismaClient } from "@prisma/client";
import { drainPendingEffects, SIMULATED_SINKS } from "../src/concept/store/effect-outbox";
import { messageSink } from "../src/lib/message-sink";
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
    sinks: { ...SIMULATED_SINKS, message: messageSink(prisma) },
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
