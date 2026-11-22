import type { PrismaClient } from "@prisma/client";
import { storeFor, type MediaStore } from "../media-store";
import { PURGE_AFTER_DAYS } from "./limits";

// Purges pictures deleted more than PURGE_AFTER_DAYS ago: first the object in an object store, then the row
// (which holds the bytes of the Postgres store). An object that is already gone counts as removed, so a run
// that stopped half-way finishes on the next one. Runs with `npm run store:sweep` as the sweeper login, which
// reads only the columns named here and never a picture's bytes or description.

interface MediaSweepOptions {
  prisma: Pick<PrismaClient, "$queryRaw" | "$executeRaw">;
  now?: Date;
  batch?: number;
  /** Overrides the store a row names, for tests. */
  storeOf?: (storage: string) => MediaStore;
}

export async function sweepDeletedMedia({ prisma, now = new Date(), batch = 200, storeOf = storeFor }: MediaSweepOptions): Promise<number> {
  if (!Number.isSafeInteger(batch) || batch <= 0) throw new RangeError("Invalid sweep batch size");
  const cutoff = new Date(now.getTime() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  let total = 0;
  for (;;) {
    const rows = await prisma.$queryRaw<{ id: string; storage: string; storage_key: string }[]>`
      SELECT "id", "storage", "storage_key" FROM "media_asset"
      WHERE "deleted_at" IS NOT NULL AND "deleted_at" <= ${cutoff}
      ORDER BY "deleted_at", "id" LIMIT ${batch}`;
    if (!rows.length) return total;
    for (const row of rows) await storeOf(row.storage).delete(row.storage_key);
    // Repeated in the delete itself: a row restored since the selection is kept (restore is only allowed for a day).
    total += await prisma.$executeRaw`
      DELETE FROM "media_asset" WHERE "id" = ANY(${rows.map((row) => row.id)}) AND "deleted_at" IS NOT NULL AND "deleted_at" <= ${cutoff}`;
    if (rows.length < batch) return total;
  }
}
