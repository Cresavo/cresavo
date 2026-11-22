import type { DemoAction } from "@/concept/actions";

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

/** The most an action may weigh once serialised. */
export const MAX_ACTION_BYTES = 64 * 1024;

export type OwnerActionType = (typeof OWNER_ACTION_TYPES)[number];
