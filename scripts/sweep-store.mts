import {
  sweepActivityPersonalData, sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes, sweepOutboxBodies, sweepRateLimits,
} from "../src/concept/store/store-sweepers";
import { createDatabaseClient } from "./database.mjs";

try {
  const prisma = createDatabaseClient(process.env.DATABASE_URL, 2);
  try {
    const sandbox = await sweepExpiredSandboxes({ prisma });
    const expiredIdempotencyKeys = await sweepExpiredIdempotency({ prisma });
    const demoActions = await sweepDemoActions({ prisma });
    // Retention of personal data (src/concept/privacy/retention.ts).
    const outboxBodies = await sweepOutboxBodies({ prisma });
    const rateLimitRows = await sweepRateLimits({ prisma });
    const activityRows = await sweepActivityPersonalData({ prisma });
    console.log(JSON.stringify({ expiredIdempotencyKeys, demoActions, sandbox, outboxBodies, rateLimitRows, activityRows }));
  } finally {
    await prisma.$disconnect();
  }
} catch {
  console.error("STORE_SWEEP_FAILED");
  process.exitCode = 1;
}
