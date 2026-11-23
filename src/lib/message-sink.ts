import type { PrismaClient } from "@prisma/client";
import { confirmationEmail } from "../concept/booking/confirmation-email";
import { parseMessageReference } from "../concept/booking/messages";
import type { Booking, Customer, DemoState, StaffId } from "../concept/data/types";
import { createRegistry, type ResolutionReason } from "../concept/connections/server/registry";
import { isEmail } from "../concept/connections/core";
import type { EmailPort } from "../concept/connections/ports/email";
import { simulatedEmail } from "../concept/connections/simulated/adapters";
import { createOutbox, type DeliveryState } from "../concept/connections/simulated/outbox";
import { productDomain } from "../concept/page/address";
import { emailDeliveryPaused, type EffectDelivery, type EffectSink } from "../concept/store/effect-outbox";
import { migrateSaved } from "../concept/store/studio-store";
import { bookingLink, bookingLinkBase } from "./booking-link";
import { log } from "./log";

// Delivers a salon's `booking-message/send` effects (docs/integrations/README.md).
// E-mail goes through the registry, which simulates unless a provider is live;
// SMS and anything that is not a booking message is acknowledged without a send.
//
// What keeps a message from going out twice, to the wrong person, or not at all:
// - A public booking is e-mailed to the address typed on it and nowhere else.
//   Only a visit the owner made falls back to the customer's profile address.
// - Whether a row is for a real send is fixed when the store stages it
//   (`record.live`). A worker that resolves to the simulator for a live row
//   leaves it pending as a configuration error; a row that is not live is only
//   ever simulated, whatever this worker could do.
// - The first attempt freezes the message, its link (address and token expiry),
//   the sender and the reply-to on the effect. Every retry sends exactly that,
//   under the same idempotency key.
// - Right before a real send, in one transaction under the tenant's lock (the
//   one an erasure takes) the sink rechecks the booking and its address and
//   commits `dispatched` on the effect row, but only while the effect is still
//   pending, not erased and this claim is the latest. An erasure either wins
//   (nothing is sent) or waits until the marker is committed. The provider is
//   called only after that commit.
// - `dispatched` is cleared only when nothing was sent. A later claim that finds
//   it set without `sent` repeats the request only where the provider
//   recognises the key (Resend, for 23 of its 24 hours); otherwise the effect
//   fails as `uncertain` for someone to reconcile.
// - The link's token is minted only for a real send, at delivery, so it is
//   never stored or logged.

/** Resend keeps an idempotency key 24 hours; stop retrying a little before. */
const RESEND_KEY_WINDOW_MS = 23 * 3_600_000;
/** What a request that may have been carried out looks like. */
const UNCERTAIN = new Set(["timeout", "network", "provider_unavailable"]);
/** The resolutions that mean "simulate on purpose"; any other means a real send was intended (for a row staged before `live` existed). */
const SIMULATED_ON_PURPOSE = new Set<ResolutionReason>(["public-demo", "live-off", "not-selected"]);
/** Where the booking link goes in a stored message. */
const LINK_MARK = "__BOOKING_LINK__";
/** Longest the dispatch transaction waits for the tenant's lock: an apply holds it for milliseconds. */
const DISPATCH_LOCK_TIMEOUT = "3000ms";
/** The frozen message and what it was made with, and the last attempt's error code, dropped once the effect is settled. */
const SETTLED = { mail: null, link: null, from: null, replyTo: null, lastError: null } as const;
/**
 * Left for a person (`uncertain`, `reconcile`): the frozen message stays, so a send they confirm did not go out can be
 * resent exactly as it was. It goes once delivery is confirmed, or with the message body when retention expires.
 */
const FOR_A_PERSON = { lastError: null } as const;

type BookingMessage = NonNullable<ReturnType<typeof parseMessageReference>>;
type Registry = { resolve: (port: "email", business: string) => Promise<{ adapter: EmailPort; live: boolean; reason: ResolutionReason; account?: string }> };

type Patch = { [K in keyof DeliveryState]?: DeliveryState[K] | null };
type Frozen = DeliveryState & Required<Pick<DeliveryState, "firstAttemptAt" | "mail" | "from">>;
/** Where an effect stands for a deliverer whose write found nothing to change: stopped for good, or claimed by someone else since. */
type Standing = "gone" | "lost";

/** A display name safe for a From header. */
const displayName = (name: string) => name.replace(/["<>\r\n,;:@]/g, " ").replace(/\s+/g, " ").trim() || "Booking";

const publicBookingOn = () => process.env.PUBLIC_BOOKING_LIVE === "1" && process.env.OWNER_ACCOUNTS_ENABLED === "1";

interface Recipient {
  state: DemoState;
  booking: Booking;
  customer: Customer;
  to: string;
  /** What the message is about: the slot the change agreed to, not the booking as it stands. */
  visit: Booking;
}

/** The address a booking's e-mail goes to: the one typed on a public booking; a visit the owner made falls back to the profile. */
const addressOf = (booking: Booking | undefined, customer: Customer | undefined) =>
  (booking?.publicRef ? booking.contactEmail : booking?.contactEmail || customer?.email || "")?.trim() ?? "";

/**
 * The address a stored booking e-mail is for, whatever became of the booking since, or undefined when the document
 * no longer names one (an erased customer). For an operator's masked view only: never print it.
 */
export function messageAddress(doc: unknown, reference: string | undefined): string | undefined {
  const message = reference ? parseMessageReference(reference) : undefined;
  const state = message && migrateSaved(doc);
  const booking = state?.bookings.find((b) => b.id === message!.bookingId);
  const to = addressOf(booking, state?.customers.find((c) => c.id === booking?.customerId));
  return isEmail(to) ? to : undefined;
}

/**
 * Whether an operator may reopen a stored booking e-mail: the booking exists, its customer is not erased and has an
 * address, and it is booked, or cancelled for a cancellation notice. Stricter than the sink for a move: a move
 * notice queued before a cancellation still goes out on its own, but is not reopened by hand once the booking is cancelled.
 */
export function messageDeliverable(doc: unknown, reference: string | undefined): boolean {
  const message = reference ? parseMessageReference(reference) : undefined;
  const found = message && recipientOf(doc, message);
  return !!found && !(message.kind === "moved" && found.booking.status === "cancelled");
}

/**
 * Who the message goes to, or undefined when there is nothing to send and nothing to retry: erased, cancelled
 * or without a usable address. A public booking goes to the address typed on it, never to a profile that
 * happens to share its phone number. Checked on every attempt, and again under the lock before a real send.
 */
function recipientOf(doc: unknown, message: BookingMessage): Recipient | undefined {
  const state = migrateSaved(doc);
  const booking = state?.bookings.find((b) => b.id === message.bookingId);
  const customer = state?.customers.find((c) => c.id === booking?.customerId);
  const to = addressOf(booking, customer);
  // A cancellation is about a booking that is no longer booked and has no use for a link to manage it; a move
  // describes the move it was made for, so it still goes out when a later cancellation came first.
  const cancelled = message.kind === "cancellation";
  const status = cancelled ? ["cancelled"] : message.kind === "moved" ? ["booked", "cancelled"] : ["booked"];
  if (!state || !booking || !status.includes(booking.status) || !customer || !isEmail(to)) return undefined;
  const visit = cancelled || message.kind === "moved"
    ? { ...booking, ...message.slot, staffId: message.slot.staffId as StaffId, status: cancelled ? booking.status : "booked" as const }
    : booking;
  return { state, booking, customer, to, visit };
}

/** The sink for `sinks.message` of salon tenants. `registry` is the e-mail connection and `now` the clock; tests pass their own. */
export function messageSink(prisma: PrismaClient, registry: Registry = createRegistry(), now: () => number = Date.now): EffectSink {
  /** Merges into the effect's bookkeeping, a null removing a key, but only for the latest claim of a still pending effect: a stale deliverer changes nothing. */
  const noteClaim = ({ id, attempt }: EffectDelivery, patch: Patch) => prisma.$executeRaw`
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', jsonb_strip_nulls(coalesce(payload->'delivery', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb))
    WHERE id = ${id} AND status = 'pending' AND attempts = ${attempt}`;

  /**
   * The provider accepted the message: recorded with the effect's status in one statement, whatever became of the
   * claim or the row since (a timeout, an erasure that cancelled it). Nothing personal is written back.
   */
  const confirm = (id: string, patch: Patch) => prisma.$executeRaw`
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', jsonb_strip_nulls(coalesce(payload->'delivery', '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb)),
      status = 'delivered', leased_until = NULL, delivered_at = clock_timestamp()
    WHERE id = ${id} AND status <> 'delivered'`;

  /**
   * Drops this claim's `dispatched` marker (and the first-submission time it set) when no request left after all.
   * Guarded by the claim, but not by the status: the outbox may already have made the row `failed` for this claim's
   * timeout, and a marker left there would turn a message that was never requested into an uncertain one.
   */
  const releaseUnsent = ({ id, attempt }: EffectDelivery, ownSubmission: boolean) => prisma.$executeRaw`
    UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', coalesce(payload->'delivery', '{}'::jsonb)
      - ${["dispatched", "provider", "account", ...(ownSubmission ? ["submittedAt"] : [])]}::text[])
    WHERE id = ${id} AND status IN ('pending', 'failed') AND attempts = ${attempt} AND NOT coalesce((payload #>> '{delivery,sent}')::boolean, false)`;

  /** Why a guarded write changed nothing. */
  const standing = async (db: Pick<PrismaClient, "$queryRaw">, id: string): Promise<Standing> => {
    const [row] = await db.$queryRaw<Array<{ open: boolean }>>`
      SELECT (status = 'pending' AND erased_at IS NULL) AS open FROM tenant_effect WHERE id = ${id}`;
    return row?.open ? "lost" : "gone";
  };

  /**
   * Freezes the first rendering on the effect, unless an earlier attempt did, and returns what is stored. Only
   * while the effect is pending, not erased and this claim is the latest: erased content is never written back.
   */
  const freeze = async ({ id, attempt }: EffectDelivery, first: Frozen): Promise<Frozen | Standing> => {
    const [row] = await prisma.$queryRaw<Array<{ delivery: Frozen }>>`
      UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}',
        CASE WHEN payload->'delivery' ? 'from' THEN payload->'delivery' ELSE coalesce(payload->'delivery', '{}'::jsonb) || ${JSON.stringify(first)}::jsonb END)
      WHERE id = ${id} AND status = 'pending' AND erased_at IS NULL AND attempts = ${attempt}
      RETURNING payload->'delivery' AS delivery`;
    return row ? row.delivery : standing(prisma, id);
  };

  /**
   * The last check before a real send, and the commit of `dispatched`, in one transaction. The tenant's row is
   * locked shared, the lock an erasure takes exclusively, so the booking and its address are read after any erasure
   * that finished and before any that has not. The marker is set only while the effect is pending, not erased and
   * this claim is the latest: a stalled deliverer whose lease ran out finds its claim gone.
   */
  const dispatch = ({ id, tenantId, attempt }: EffectDelivery, message: BookingMessage, provider: string, account: string | undefined, submittedAt: number) => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('lock_timeout', ${DISPATCH_LOCK_TIMEOUT}, true)`;
    const [row] = await tx.$queryRaw<Array<{ doc: unknown }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${tenantId} FOR SHARE`;
    const current = row && recipientOf(row.doc, message);
    if (!current) return "skip" as const;
    const marked = await tx.$executeRaw`
      UPDATE tenant_effect SET payload = jsonb_set(payload, '{delivery}', coalesce(payload->'delivery', '{}'::jsonb)
        || jsonb_build_object('dispatched', true, 'provider', coalesce(payload->'delivery'->>'provider', ${provider}::text))
        || CASE WHEN payload->'delivery' ? 'provider' OR ${account}::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('account', ${account}::text) END
        || CASE WHEN payload->'delivery' ? 'submittedAt' THEN '{}'::jsonb ELSE jsonb_build_object('submittedAt', ${submittedAt}::float8) END)
      WHERE id = ${id} AND status = 'pending' AND erased_at IS NULL AND attempts = ${attempt}`;
    return marked ? { to: current.to } : standing(tx, id);
  });

  return async (delivery, signal) => {
    const { id, tenantId, effect } = delivery;
    const { reference, port, delivery: kept } = effect.record;
    const message = port === "email" && reference ? parseMessageReference(reference) : undefined;
    // An earlier attempt sent it and was only too slow to say so; or one already decided it fails and crashed before saying so.
    if (!message || kept?.sent) return;
    // Paused by the operator (CONCEPT_EMAIL_PAUSED=1): a row claimed just before the switch waits, keeping its attempt.
    if (emailDeliveryPaused()) return "deferred";
    if (kept?.reason) return "failed";
    const [row] = await prisma.$queryRaw<Array<{ doc: unknown }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${tenantId}`;
    const found = row && recipientOf(row.doc, message);
    if (!found) return "skipped";
    const { state, booking, customer, visit } = found;
    const cancelled = message.kind === "cancellation";
    // Paused, not lost: the view of a public booking is off with these flags, so its link is held back too.
    if (booking.publicRef && !publicBookingOn()) return "deferred";

    const resolution = await registry.resolve("email", tenantId);
    // Fixed when the store staged the effect. A row from before that was recorded is judged by this worker's configuration.
    const live = effect.record.live ?? kept?.live ?? !SIMULATED_ON_PURPOSE.has(resolution.reason);
    if (live && !resolution.live) {
      // Names the reason only: never a value of the configuration.
      log.warn("BOOKING_EMAIL_WAITING", { reason: resolution.reason });
      throw new Error("EMAIL_NOT_CONFIGURED");
    }
    // Past the deadline the request must not start: the outbox is already retrying it.
    if (signal.aborted) throw new Error("EMAIL_TIMEOUT");

    let frozen: Frozen;
    if (kept?.mail && kept.from) frozen = kept as Frozen;
    else if (kept?.dispatched && live) {
      // Written before the sender and link were frozen, and a request may already have left: it cannot be rebuilt
      // as it was, so it is not sent again.
      await noteClaim(delivery, { reason: "uncertain", ...SETTLED });
      return "failed";
    } else {
      // A row written before the sender and link were frozen keeps its first time and its message.
      const firstAttemptAt = kept?.firstAttemptAt ?? now();
      const link = (kept?.mail ? kept.mail.text.includes(LINK_MARK) : !cancelled) ? bookingLinkBase(state, visit) : undefined;
      const first: Frozen = {
        firstAttemptAt, mail: kept?.mail ?? confirmationEmail(state, visit, message.kind, link && LINK_MARK, firstAttemptAt),
        ...(link ? { link } : {}),
        from: `"${displayName(state.salon.name)}" <bookings@${productDomain()}>`,
        ...(isEmail(state.salon.email) ? { replyTo: state.salon.email } : {}),
      };
      const stored = await freeze(delivery, first);
      if (stored === "gone") return "failed";
      if (stored === "lost") throw new Error("EMAIL_CLAIM_LOST");
      frozen = stored;
    }
    // A snapshot whose message retention has purged cannot be resent as it was: it fails for a person, before anything is marked.
    if (!frozen.mail?.subject || typeof frozen.mail.text !== "string" || typeof frozen.mail.html !== "string" || !frozen.from) {
      await noteClaim(delivery, { reason: "snapshot_purged", ...SETTLED });
      return "failed";
    }
    const { firstAttemptAt, mail, from, replyTo } = frozen;
    // A send that may have left is repeated only where the provider will recognise the key.
    // The key only helps at the provider the first request went to: a row dispatched elsewhere, or before that was recorded, is not repeated.
    const provider = resolution.adapter.info.provider;
    const origin = kept?.dispatched ? kept.provider : provider;
    const sameAccount = !kept?.dispatched || kept.account === resolution.account;
    // The key's window opens with the first request that may have reached the provider, not with the rendering: a row
    // held back for days before its first request still has the whole window. A row dispatched before that was recorded counts from its rendering.
    const submittedAt = kept?.submittedAt ?? (kept?.dispatched ? firstAttemptAt : now());
    const keyed = !live || (origin === "resend" && provider === "resend" && sameAccount && now() - submittedAt < RESEND_KEY_WINDOW_MS);
    if (live && kept?.dispatched && !keyed) {
      await noteClaim(delivery, { reason: "uncertain", ...FOR_A_PERSON });
      return "failed";
    }

    const href = frozen.link && bookingLink(tenantId, visit, frozen.link, live);
    const fill = (text: string) => text.split(LINK_MARK).join(href ?? "");
    let to = `customer:${customer.id}`;
    if (live) {
      const gate = await dispatch(delivery, message, provider, resolution.account, submittedAt);
      if (gate === "skip") return "skipped";
      if (gate === "gone") return "failed";
      if (gate === "lost") throw new Error("EMAIL_CLAIM_LOST");
      to = gate.to;
    }
    // The marker stays when an earlier attempt may have sent: only a request that left nothing behind is released.
    // Also after this claim's timeout made the row `failed`: the marker must not make an unsent message look uncertain.
    // Its first-submission time goes too: only a request that may have been carried out starts the provider's key window.
    const ownSubmission = kept?.submittedAt === undefined;
    const release = async () => { if (!kept?.dispatched) await releaseUnsent(delivery, ownSubmission); };
    if (signal.aborted) {
      await release();
      throw new Error("EMAIL_TIMEOUT");
    }
    // The last moment the pause can hold it: nothing has been requested yet. Returned at once, with no write of its
    // own, so it cannot run into the sink timeout: the outbox drops the marker in the write that releases the row.
    if (emailDeliveryPaused()) return kept?.dispatched ? "deferred" : "held";
    // A simulated send keeps no address, only a reference to the customer, and never touches a live adapter.
    const adapter = live || !resolution.live ? resolution.adapter : simulatedEmail({ outbox: createOutbox(1) });
    const result = await adapter.send({
      to: [to], from, ...(replyTo ? { replyTo } : {}),
      subject: mail.subject, text: fill(mail.text), html: fill(mail.html), language: state.localization.language, idempotencyKey: id, tracking: false,
    });
    if (result.ok) {
      await confirm(id, { sent: true, dispatched: null, provider: null, account: null, submittedAt: null, ...SETTLED });
      return;
    }
    const { code, providerCode } = result.error;
    const inProgress = code === "conflict" && providerCode === "concurrent_idempotent_requests";
    if (UNCERTAIN.has(code) || inProgress) {
      // The request may have been carried out, or is still running. It stays dispatched: the next claim decides by provider and age.
      if (keyed) throw new Error(inProgress ? "EMAIL_RETRYABLE" : "EMAIL_UNCERTAIN");
      await noteClaim(delivery, { reason: "uncertain", ...FOR_A_PERSON });
      return "failed";
    }
    // Nothing was sent. A rate limit and a bad or missing API key will pass.
    if (result.error.retryable || code === "unauthorized") {
      await release();
      throw new Error("EMAIL_RETRYABLE");
    }
    // A same key with a changed body: an earlier request did reach the provider, so only a person can settle it.
    if (code === "conflict") {
      await noteClaim(delivery, { reason: "reconcile", ...FOR_A_PERSON });
      return "failed";
    }
    // A bad address, an unverified domain, other 4xx: refused outright, so this request starts no key window.
    await noteClaim(delivery, { reason: code, ...SETTLED, ...(ownSubmission ? { submittedAt: null } : {}) });
    return "failed";
  };
}
