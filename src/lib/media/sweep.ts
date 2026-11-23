import type { PrismaClient } from "@prisma/client";
import { checkedKey, storeFor, type MediaStore } from "../media-store";
import { PURGE_AFTER_DAYS } from "./limits";

// Purges pictures for good: deleted ones after PURGE_AFTER_DAYS, a logo that was replaced before any page
// used it after an hour, and an upload left pending (its bytes never confirmed) after an hour. Each picture
// is purged on its own, object first and then the row, so one object the store cannot delete is retried on
// the next run without holding up the others. An object that is already gone counts as removed. Runs with
// `npm run store:sweep` as the sweeper login, which never reads a picture's bytes or description.

const HOUR_MS = 60 * 60 * 1000;

interface MediaSweepOptions {
  prisma: Pick<PrismaClient, "$queryRaw" | "$executeRaw">;
  now?: Date;
  batch?: number;
  /** Overrides the store a row names, for tests. */
  storeOf?: (storage: string) => MediaStore;
}

export interface MediaSweepResult {
  purged: number;
  /** Pictures whose object could not be removed this time; they are tried again on the next run. */
  failed: number;
}

export async function sweepDeletedMedia({ prisma, now = new Date(), batch = 200, storeOf = storeFor }: MediaSweepOptions): Promise<MediaSweepResult> {
  if (!Number.isSafeInteger(batch) || batch <= 0) throw new RangeError("Invalid sweep batch size");
  const retired = new Date(now.getTime() - PURGE_AFTER_DAYS * 24 * HOUR_MS);
  const recent = new Date(now.getTime() - HOUR_MS);
  const result: MediaSweepResult = { purged: 0, failed: 0 };
  let after = "";
  for (;;) {
    const rows = await prisma.$queryRaw<{ id: string; tenant_id: string; storage: string; storage_key: string }[]>`
      SELECT "id", "tenant_id", "storage", "storage_key" FROM "media_asset"
      WHERE "id" > ${after} AND (
        ("deleted_at" IS NOT NULL AND "deleted_at" <= ${retired})
        OR ("status" = 'pending' AND "created_at" <= ${recent})
        OR ("kind" = 'logo' AND "published_at" IS NULL AND "deleted_at" IS NOT NULL AND "deleted_at" <= ${recent}))
      ORDER BY "id" LIMIT ${batch}`;
    for (const row of rows) {
      try {
        await storeOf(row.storage).delete(checkedKey({ tenantId: row.tenant_id, id: row.id, storageKey: row.storage_key }));
        // The same conditions again: a photo restored since the selection is kept (restore is only allowed for a day).
        result.purged += await prisma.$executeRaw`
          DELETE FROM "media_asset" WHERE "id" = ${row.id} AND (
            ("deleted_at" IS NOT NULL AND "deleted_at" <= ${retired})
            OR ("status" = 'pending' AND "created_at" <= ${recent})
            OR ("kind" = 'logo' AND "published_at" IS NULL AND "deleted_at" IS NOT NULL AND "deleted_at" <= ${recent}))`;
      } catch {
        result.failed++;
      }
    }
    if (rows.length < batch) return result;
    after = rows[rows.length - 1].id;
  }
}
