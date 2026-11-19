import { stableHash } from "../connections/core";

/** Local demo actions have no server request ID. Use an opaque ID for the attempt. */
export function newActionRequestId(): string {
  const values = crypto.getRandomValues(new Uint32Array(2));
  return Array.from(values, value => value.toString(16).padStart(8, "0")).join("");
}

export function actionReference(requestId: string): string {
  return `CR-${stableHash(requestId).toUpperCase()}`;
}

export function isBookingOrPaymentAction(type: string) {
  return type.startsWith("booking/") || ["online/book", "online/waitlist", "inbox/reply", "giftcard/redeem", "giftcard/sell", "package/sell", "product/sell"].includes(type);
}
