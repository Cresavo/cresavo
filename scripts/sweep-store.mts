import {
  sweepActivityPersonalData, sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes, sweepJournalAccessRows, sweepOutboxBodies,
  sweepOwnerGuardBuckets, sweepRateLimits,
} from "../src/concept/store/store-sweepers";
import { sweepDeletedMedia } from "../src/lib/media/sweep";
import { createDatabaseClient } from "./database.mjs";

try {
  const prisma = createDatabaseClient(process.env.DATABASE_URL, 2);
  try {
    const sandbox = await sweepExpiredSandboxes({ prisma });
    const expiredIdempotencyKeys = await sweepExpiredIdempotency({ prisma });
    const demoActions = await sweepDemoActions({ prisma });
    const ownerGuardBuckets = await sweepOwnerGuardBuckets({ prisma });
    // Retention of personal data (src/concept/privacy/retention.ts).
    const outboxBodies = await sweepOutboxBodies({ prisma });
    const rateLimitRows = await sweepRateLimits({ prisma });
    const activityRows = await sweepActivityPersonalData({ prisma });
    const journalAccessRows = await sweepJournalAccessRows({ prisma });
    // Deleted photos and logos (src/lib/media/sweep.ts); with MEDIA_STORE=s3 the job needs the MEDIA_S3_* settings too.
    const media = await sweepDeletedMedia({ prisma });
    console.log(JSON.stringify({ expiredIdempotencyKeys, demoActions, ownerGuardBuckets, sandbox, outboxBodies, rateLimitRows, activityRows, journalAccessRows, mediaPurged: media.purged, mediaFailed: media.failed }));
  } finally {
    await prisma.$disconnect();
  }
} catch {
  console.error("STORE_SWEEP_FAILED");
  process.exitCode = 1;
}
