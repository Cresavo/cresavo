import type { PrismaClient } from "@prisma/client";
import { SIMULATED_SINKS } from "@/concept/store/effect-outbox";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import { db } from "./db";
import { messageSink } from "./message-sink";
import { erasureJournalVault, journalStoreOption } from "./owner-journals";
import { parseOwnerAction } from "./owner-actions/parse";

// The server store behind the owner studio. Booking e-mails go through the
// e-mail connection, which simulates until a provider is live; payments and
// SMS are acknowledged without sending anything, as in the demo.

const holder = globalThis as typeof globalThis & { cresavoOwnerStore?: PostgresStudioStore };

/**
 * The application role may not update `tenant_action`, so production erases through the SECURITY DEFINER
 * `erase_subject` function (prisma/grants/erase-subject.sql). Elsewhere the store runs the same statements itself.
 * `STUDIO_STORE_ERASURE=statements|function` overrides either.
 */
function erasureMode(): "statements" | "function" {
  const chosen = process.env.STUDIO_STORE_ERASURE;
  if (chosen === "statements" || chosen === "function") return chosen;
  return process.env.NODE_ENV === "production" ? "function" : "statements";
}

export function ownerStore(): PostgresStudioStore {
  const hmacSecret = process.env.STUDIO_STORE_HMAC_SECRET;
  if (!hmacSecret || hmacSecret.length < 32) throw new Error("STUDIO_STORE_HMAC_SECRET must be at least 32 characters");
  const prisma = db as unknown as PrismaClient;
  holder.cresavoOwnerStore ??= new PostgresStudioStore({
    prisma, hmacSecret, erasure: erasureMode(), sinks: { ...SIMULATED_SINKS, message: messageSink(prisma) }, journals: journalStoreOption(), erasureVault: erasureJournalVault(),
  });
  return holder.cresavoOwnerStore;
}

export { MAX_ACTION_BYTES, OWNER_ACTION_TYPES } from "./owner-actions/types";

/** The action when it is a plain object of an allowed type within the size limit and every field is valid; otherwise null. */
export const ownerAction = parseOwnerAction;
