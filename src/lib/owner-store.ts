import type { PrismaClient } from "@prisma/client";
import type { DemoAction } from "@/concept/actions";
import { SIMULATED_SINKS } from "@/concept/store/effect-outbox";
import { PostgresStudioStore } from "@/concept/store/postgres-studio-store";
import { db } from "./db";

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

/**
 * Changes an owner may send from the studio. Customer-page actions (online
 * booking, reviews) wait for the public booking API in stage 2, erasure runs
 * only through `eraseSubject`, and simulated domain setup stays in the demo.
 */
export const OWNER_ACTION_TYPES = [
  "accounting/connect", "accounting/disconnect", "booking/cancel", "booking/complete", "booking/create", "booking/fee",
  "booking/move", "campaign/ad", "campaign/launch", "card/dismiss", "category/add", "category/move", "category/remove",
  "category/rename", "category/reorder", "cost/add", "cost/remove", "customer/delete", "customer/note", "customers/import",
  "customers/message", "giftcard/redeem", "giftcard/sell", "inbox/add", "inbox/read", "inbox/read-all", "inbox/reply",
  "journal/add", "journal/edit", "log/undo", "memory/add", "memory/edit", "memory/forget", "module/preset", "module/toggle",
  "package/sell", "page/set", "product/sell", "reminder/settings", "resource/add", "resource/remove", "resource/rename",
  "review/approve", "review/reply", "routine/add", "routine/ran", "routine/toggle", "salon/close", "salon/details",
  "salon/hours", "salon/language", "salon/policy", "salon/reopen", "salon/slug", "service/add", "service/delete",
  "service/duplicate", "service/move", "service/price", "service/recall", "service/reorder", "service/resources",
  "service/update", "service/visibility", "staff/block", "staff/exception-remove", "staff/off", "staff/shift", "staff/week",
  "stock/adjust", "stock/order", "stock/receive", "stock/update", "support/grant", "support/revoke", "ticket/create",
  "trash/restore",
] as const satisfies readonly DemoAction["type"][];

const allowed = new Set<string>(OWNER_ACTION_TYPES);
export const MAX_ACTION_BYTES = 64 * 1024;

/** The action when it is a plain object of an allowed type within the size limit; otherwise null. */
export function ownerAction(value: unknown): DemoAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== "string" || !allowed.has(type)) return null;
  return Buffer.byteLength(JSON.stringify(value)) <= MAX_ACTION_BYTES ? value as DemoAction : null;
}
