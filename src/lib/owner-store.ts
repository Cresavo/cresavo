import type { PrismaClient } from "@prisma/client";
import { SIMULATED_SINKS } from "@/concept/store/effect-outbox";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import { db } from "./db";
import { parseOwnerAction } from "./owner-actions/parse";

// The server store behind the owner studio. Until real message and payment
// providers are connected, salon effects are acknowledged without sending
// anything, as in the demo.

const holder = globalThis as typeof globalThis & { cresavoOwnerStore?: PostgresStudioStore };

export function ownerStore(): PostgresStudioStore {
  const hmacSecret = process.env.STUDIO_STORE_HMAC_SECRET;
  if (!hmacSecret || hmacSecret.length < 32) throw new Error("STUDIO_STORE_HMAC_SECRET must be at least 32 characters");
  holder.cresavoOwnerStore ??= new PostgresStudioStore({ prisma: db as unknown as PrismaClient, hmacSecret, sinks: SIMULATED_SINKS });
  return holder.cresavoOwnerStore;
}

export { MAX_ACTION_BYTES, OWNER_ACTION_TYPES } from "./owner-actions/types";

/** The action when it is a plain object of an allowed type within the size limit and every field is valid; otherwise null. */
export const ownerAction = parseOwnerAction;
