import { assertTestDatabase } from "../../scripts/test-db-guard.mjs";
import { createDatabaseClient } from "../../scripts/database.mjs";

export default async function teardown() {
  // These suites require their own isolated loopback *_test / *_demo database.
  // Limiters span HTTP processes, so process exit alone no longer cleans them.
  assertTestDatabase();
  const db = createDatabaseClient(undefined, 1);
  try {
    await db.rateLimitBucket.deleteMany();
  } finally {
    await db.$disconnect();
  }
}
