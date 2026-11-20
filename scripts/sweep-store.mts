import { sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes } from "../src/concept/store/store-sweepers";
import { createDatabaseClient } from "./database.mjs";

try {
  const prisma = createDatabaseClient(process.env.DATABASE_URL, 2);
  try {
    const sandbox = await sweepExpiredSandboxes({ prisma });
    const expiredIdempotencyKeys = await sweepExpiredIdempotency({ prisma });
    const demoActions = await sweepDemoActions({ prisma });
    console.log(JSON.stringify({ expiredIdempotencyKeys, demoActions, sandbox }));
  } finally {
    await prisma.$disconnect();
  }
} catch {
  console.error("STORE_SWEEP_FAILED");
  process.exitCode = 1;
}
