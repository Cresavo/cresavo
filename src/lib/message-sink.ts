import type { PrismaClient } from "@prisma/client";
import { confirmationEmail } from "../concept/booking/confirmation-email";
import { parseMessageReference } from "../concept/booking/messages";
import { createRegistry } from "../concept/connections/server/registry";
import { isEmail } from "../concept/connections/core";
import type { EmailPort } from "../concept/connections/ports/email";
import { productDomain } from "../concept/page/address";
import type { EffectSink } from "../concept/store/effect-outbox";
import { migrateSaved } from "../concept/store/studio-store";
import { bookingLink } from "./booking-link";

// Delivers a salon's `booking-message/send` effects (docs/integrations/README.md).
// E-mail goes through the registry, which simulates unless a provider is live;
// SMS and anything that is not a booking message is acknowledged without a send.
// The link's token is minted here, at delivery, so it is never stored or logged.

/** A display name safe for a From header. */
const displayName = (name: string) => name.replace(/["<>\r\n,;:@]/g, " ").replace(/\s+/g, " ").trim() || "Booking";

/** The sink for `sinks.message` of salon tenants. `registry` is the e-mail connection; tests pass their own. */
export function messageSink(prisma: PrismaClient, registry: { resolve: (port: "email", business: string) => Promise<{ adapter: EmailPort }> } = createRegistry()): EffectSink {
  return async ({ id, tenantId, effect }) => {
    const { reference, port } = effect.record;
    const message = port === "email" && reference ? parseMessageReference(reference) : undefined;
    if (!message) return;
    const [row] = await prisma.$queryRaw<Array<{ doc: unknown }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${tenantId}`;
    const state = row && migrateSaved(row.doc);
    const booking = state?.bookings.find((b) => b.id === message.bookingId);
    const customer = state?.customers.find((c) => c.id === booking?.customerId);
    const to = (booking?.contactEmail || customer?.email || "").trim();
    // Erased, cancelled or without a usable address: nothing to send, and nothing to retry.
    if (!state || !booking || booking.status !== "booked" || !customer || !isEmail(to)) return;

    const mail = confirmationEmail(state, booking, message.kind, bookingLink(tenantId, state, booking));
    const { adapter } = await registry.resolve("email", tenantId);
    const result = await adapter.send({
      to: [to], from: `"${displayName(state.salon.name)}" <bookings@${productDomain()}>`, ...(isEmail(state.salon.email) ? { replyTo: state.salon.email } : {}),
      ...mail, language: state.localization.language, idempotencyKey: id,
    });
    if (result.ok) return;
    // A retry cannot fix a bad address or an unverified domain; a timeout or a rate limit it can.
    if (!result.error.retryable) return "failed";
    throw new Error("EMAIL_RETRYABLE");
  };
}
