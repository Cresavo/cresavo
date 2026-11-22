import type { PrismaClient } from "@prisma/client";
import { confirmationEmail } from "../concept/booking/confirmation-email";
import { parseMessageReference } from "../concept/booking/messages";
import { createRegistry, type ResolutionReason } from "../concept/connections/server/registry";
import { isEmail } from "../concept/connections/core";
import type { EmailPort } from "../concept/connections/ports/email";
import type { DeliveryState } from "../concept/connections/simulated/outbox";
import { productDomain } from "../concept/page/address";
import type { EffectSink } from "../concept/store/effect-outbox";
import { migrateSaved } from "../concept/store/studio-store";
import { bookingLink } from "./booking-link";

// Delivers a salon's `booking-message/send` effects (docs/integrations/README.md).
// E-mail goes through the registry, which simulates unless a provider is live;
// SMS and anything that is not a booking message is acknowledged without a send.
//
// What keeps a message from going out twice, to the wrong person, or not at all:
// - A public booking is e-mailed to the address typed on it and nowhere else.
//   Only a visit the owner made falls back to the customer's profile address.
// - The first attempt freezes the message and its time on the effect. Every
//   retry sends exactly that, under the same idempotency key.
// - A send that may have left (timeout, crash) is retried only where the
//   provider de-duplicates by key (Resend, for 23 hours of its 24); otherwise
//   the effect fails as `uncertain` for someone to reconcile.
// - Whether an effect was meant for a real send is fixed at its first attempt.
//   A worker without the credentials fails it for a retry, never "delivers" it
//   to the simulated adapter.
// - The link's token is minted only for a real send, at delivery, so it is
//   never stored or logged.

/** Resend keeps an idempotency key 24 hours; stop retrying a little before. */
const RESEND_KEY_WINDOW_MS = 23 * 3_600_000;
/** What a request that may have been carried out looks like. */
const UNCERTAIN = new Set(["timeout", "network", "provider_unavailable"]);
/** The resolutions that mean "simulate on purpose"; any other means a real send was intended. */
const SIMULATED_ON_PURPOSE = new Set<ResolutionReason>(["public-demo", "live-off", "not-selected"]);
/** Where the booking link goes in a stored message. */
const LINK_MARK = "__BOOKING_LINK__";

type Registry = { resolve: (port: "email", business: string) => Promise<{ adapter: EmailPort; live: boolean; reason: ResolutionReason }> };

/** A display name safe for a From header. */
const displayName = (name: string) => name.replace(/["<>\r\n,;:@]/g, " ").replace(/\s+/g, " ").trim() || "Booking";

const publicBookingOn = () => process.env.PUBLIC_BOOKING_LIVE === "1" && process.env.OWNER_ACCOUNTS_ENABLED === "1";

/** The sink for `sinks.message` of salon tenants. `registry` is the e-mail connection and `now` the clock; tests pass their own. */
export function messageSink(prisma: PrismaClient, registry: Registry = createRegistry(), now: () => number = Date.now): EffectSink {
  /** Merges into the effect's bookkeeping; a null removes a key. */
  const note = (id: string, patch: { [K in keyof DeliveryState]?: DeliveryState[K] | null }) => prisma.$executeRaw`
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', jsonb_strip_nulls(coalesce(payload->'delivery', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb))
    WHERE id = ${id}`;

  return async ({ id, tenantId, effect }, signal) => {
    const { reference, port, delivery: kept } = effect.record;
    const message = port === "email" && reference ? parseMessageReference(reference) : undefined;
    // An earlier attempt sent it and was only too slow to say so.
    if (!message || kept?.sent) return;
    const [row] = await prisma.$queryRaw<Array<{ doc: unknown }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${tenantId}`;
    const state = row && migrateSaved(row.doc);
    const booking = state?.bookings.find((b) => b.id === message.bookingId);
    const customer = state?.customers.find((c) => c.id === booking?.customerId);
    // A public booking goes to the address typed on it, never to a profile that happens to share its phone number.
    const to = (booking?.publicRef ? booking.contactEmail : booking?.contactEmail || customer?.email || "")?.trim() ?? "";
    // Erased, cancelled or without a usable address: nothing to send, and nothing to retry. Checked on every attempt.
    // A cancellation is the one message about a booking that is no longer booked, and has no use for a link to manage it.
    const cancelled = message.kind === "cancellation";
    if (!state || !booking || booking.status !== (cancelled ? "cancelled" : "booked") || !customer || !isEmail(to)) return;
    // Paused, not lost: the view of a public booking is off with these flags, so its link is held back too.
    if (booking.publicRef && !publicBookingOn()) return "deferred";

    const resolution = await registry.resolve("email", tenantId);
    const live = kept?.live ?? !SIMULATED_ON_PURPOSE.has(resolution.reason);
    const firstAttemptAt = kept?.firstAttemptAt ?? now();
    const first: DeliveryState = {
      live, firstAttemptAt, mail: kept?.mail ?? confirmationEmail(state, booking, message.kind, booking.publicRef && !cancelled ? LINK_MARK : undefined, firstAttemptAt),
    };
    if (!kept?.mail || kept.live === undefined) await note(id, first);
    if (live && !resolution.live) {
      // Names the reason only: never a value of the configuration.
      console.warn(`[message-sink] a booking e-mail waits: the e-mail connection resolved to "${resolution.reason}" but a real send was intended`);
      throw new Error("EMAIL_NOT_CONFIGURED");
    }
    // A send that may have left is repeated only where the provider will recognise the key.
    const keyed = !resolution.live || (resolution.adapter.info.provider === "resend" && now() - firstAttemptAt < RESEND_KEY_WINDOW_MS);
    if (kept?.dispatched && !keyed) {
      await note(id, { reason: "uncertain", dispatched: null, mail: null });
      return "failed";
    }

    const link = cancelled ? undefined : bookingLink(tenantId, state, booking, resolution.live);
    const fill = (text: string) => text.split(LINK_MARK).join(link ?? "");
    const { subject, text, html } = first.mail!;
    // Past the deadline the request must not start: the outbox is already retrying it.
    if (signal.aborted) throw new Error("EMAIL_TIMEOUT");
    await note(id, { dispatched: true });
    const result = await resolution.adapter.send({
      // A simulated send keeps no address, only a reference to the customer.
      to: [resolution.live ? to : `customer:${customer.id}`], from: `"${displayName(state.salon.name)}" <bookings@${productDomain()}>`,
      ...(isEmail(state.salon.email) ? { replyTo: state.salon.email } : {}),
      subject, text: fill(text), html: fill(html), language: state.localization.language, idempotencyKey: id, tracking: false,
    });
    if (result.ok) {
      await note(id, { sent: true, dispatched: null, mail: null });
      return;
    }
    const { code, providerCode } = result.error;
    if (UNCERTAIN.has(code)) {
      // The request may have been carried out. Stay "dispatched": the next attempt decides by provider and age.
      if (keyed) throw new Error("EMAIL_UNCERTAIN");
      await note(id, { reason: "uncertain", dispatched: null, mail: null });
      return "failed";
    }
    await note(id, { dispatched: null });
    // Nothing was sent. A rate limit, a bad or missing API key and a same-key request still in progress will pass.
    if (result.error.retryable || code === "unauthorized" || (code === "conflict" && providerCode === "concurrent_idempotent_requests")) throw new Error("EMAIL_RETRYABLE");
    // A bad address, an unverified domain, other 4xx; and a same key with a changed body, which only a person can settle.
    await note(id, { reason: code === "conflict" ? "reconcile" : code, mail: null });
    return "failed";
  };
}
