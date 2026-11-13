import { createHmac } from "node:crypto";
import { DomainError } from "./errors";

// The card's random key is an idempotency key, never authority to read its row.
// Check the ACTUAL returned row after the domain transaction, including races.
// Other key namespaces keep their existing replay contract.
export function assertCardReplayChannel(
  booking: { idempotencyKey: string | null; clientKey: string | null },
  clientAddress: string,
) {
  if (!booking.idempotencyKey?.startsWith("time-card_")) return;
  const secret = process.env.SESSION_SECRET;
  if (
    !secret ||
    secret.length < 32 ||
    booking.clientKey !==
      createHmac("sha256", secret).update(clientAddress).digest("hex")
  )
    throw new DomainError(
      "Bokningen kan inte visas med den här demoprofilen.",
      403,
    );
}
