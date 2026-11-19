import { connectionError, fail, isBefore, isCountry, isE164, isEmail, isMoney, isRecipientRef, isTimeZone, isUtc, ok, stableHash, type Money, type PortName, type PortResult } from "../core";
import { isBalanced } from "../ports/accounting";
import type { AccountingPort } from "../ports/accounting";
import type { AdsPort } from "../ports/ads";
import type { BusyEvent, CalendarPort } from "../ports/calendar";
import type { EmailMessage, EmailPort, EmailReceipt } from "../ports/email";
import type { PortMap } from "../ports";
import type { ListingPort } from "../ports/listing";
import type { CheckoutInput, CheckoutSession, PaymentsPort, Refund, RefundInput } from "../ports/payments";
import { smsSegments, type SmsMessage, type SmsPort, type SmsReceipt } from "../ports/sms";
import type { SocialPort } from "../ports/social";
import { buildReserveFeeds } from "../providers/listing/reserve-feeds";
import { createOutbox, type Outbox } from "./outbox";

// The default adapter for every port and the only one the public demo uses.
// Deterministic (ids are hashes of the input), no network, no clock, no
// secrets. Each call records what would have been sent in the outbox.

const PROVIDER = "simulated";
const invalid = (port: PortName) => fail(connectionError(port, PROVIDER, "invalid_input"));
const idFor = (port: PortName, action: string, input: unknown) => `sim-${port}-${stableHash(`${action}:${JSON.stringify(input)}`)}`;
const zero = (currency: string): Money => ({ amountMinor: 0, currency });

/** Like the live providers: one idempotency key, one request. Reusing a key with other content is a conflict. */
function keyGuard(port: PortName, seen = new Map<string, string>(), committed?: ReadonlyMap<string, string>) {
  return (key: string | undefined, fingerprint: unknown) => {
    if (!key) return null;
    const print = stableHash(JSON.stringify(fingerprint));
    const known = seen.get(key) ?? committed?.get(key);
    if (known && known !== print) return fail<never>(connectionError(port, PROVIDER, "conflict"));
    seen.set(key, print);
    return null;
  };
}
const isHttps = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export interface SimulatedOptions {
  outbox: Outbox;
  /** Currency the zero costs are reported in (ISO 4217). */
  currency?: string;
}

export interface SimulatedSms extends SmsPort {
  /** Synchronous variant for pure state reducers. Same result and record as `send`. */
  deliver(message: SmsMessage): PortResult<SmsReceipt>;
}

export interface SimulatedEmail extends EmailPort {
  deliver(message: EmailMessage): PortResult<EmailReceipt>;
}

export function simulatedSms({ outbox, currency = "EUR" }: SimulatedOptions, guard = keyGuard("sms")): SimulatedSms {
  const deliver = (message: SmsMessage): PortResult<SmsReceipt> => {
    if (!(isE164(message.to) || isRecipientRef(message.to)) || !message.body.trim() || message.body.length > 1600) return invalid("sms");
    const conflict = guard(message.idempotencyKey, [message.to, message.body]);
    if (conflict) return conflict;
    const id = idFor("sms", "send", [message.to, message.body, message.reference, message.idempotencyKey]);
    const cost = zero(currency);
    outbox.record({ id, port: "sms", action: "send", to: message.to, body: message.body, reference: message.reference, cost });
    return ok({ id, to: message.to, segments: smsSegments(message.body) }, "simulated", cost, id);
  };
  return {
    info: { port: "sms", provider: PROVIDER, kind: "simulated", capabilities: ["send", "alphanumeric-sender", "idempotency"], secrets: [] },
    deliver,
    send: async (message) => deliver(message),
  };
}

export function simulatedEmail({ outbox, currency = "EUR" }: SimulatedOptions, guard = keyGuard("email")): SimulatedEmail {
  const deliver = (message: EmailMessage): PortResult<EmailReceipt> => {
    const recipients = message.to.length > 0 && message.to.length <= 50 && message.to.every((to) => isEmail(to) || isRecipientRef(to));
    if (!recipients || !message.subject.trim() || !message.text.trim()) return invalid("email");
    const conflict = guard(message.idempotencyKey, [message.to, message.subject, message.text]);
    if (conflict) return conflict;
    const id = idFor("email", "send", [message.to, message.subject, message.text, message.idempotencyKey]);
    const cost = zero(currency);
    outbox.record({ id, port: "email", action: "send", to: message.to.join(", "), subject: message.subject, body: message.text, cost });
    return ok({ id, to: message.to }, "simulated", cost, id);
  };
  return {
    info: { port: "email", provider: PROVIDER, kind: "simulated", capabilities: ["send", "html", "tags", "idempotency"], secrets: [] },
    deliver,
    send: async (message) => deliver(message),
  };
}

interface SimulatedPayments extends PaymentsPort {
  checkoutNow(input: CheckoutInput): PortResult<CheckoutSession>;
  refundNow(input: RefundInput): PortResult<Refund>;
}

/** Each browser write previews receipts and idempotency keys together. */
export function paymentLedger(outbox: Outbox) {
  const committed = new Map<string, string>();
  return {
    direct: simulatedPayments({ outbox }, keyGuard("payments", committed)),
    stage() {
      const pending = createOutbox(Infinity);
      const keys = new Map<string, string>();
      return {
        payments: simulatedPayments({ outbox: pending }, keyGuard("payments", keys, committed)),
        hasPayments: () => keys.size > 0,
        publish() {
          keys.forEach((value, key) => committed.set(key, value));
          pending.list().forEach(entry => outbox.record(entry));
        },
      };
    },
  };
}

/**
 * Like `paymentLedger`, for every port a reducer can call: each stage records
 * payments, SMS, email and social posts in a pending outbox and claims
 * idempotency keys only when it is published. Used by stores that commit
 * first and publish after (see src/concept/store).
 */
export function channelLedger(outbox: Outbox, currency?: string) {
  const committed = { payments: new Map<string, string>(), sms: new Map<string, string>(), email: new Map<string, string>() };
  return {
    outbox,
    stage() {
      const pending = createOutbox(Infinity);
      const keys = { payments: new Map<string, string>(), sms: new Map<string, string>(), email: new Map<string, string>() };
      const options = { outbox: pending, currency };
      return {
        outbox: pending,
        payments: simulatedPayments(options, keyGuard("payments", keys.payments, committed.payments)),
        sms: simulatedSms(options, keyGuard("sms", keys.sms, committed.sms)),
        email: simulatedEmail(options, keyGuard("email", keys.email, committed.email)),
        social: simulatedSocial(options),
        hasPayments: () => keys.payments.size > 0,
        publish() {
          for (const port of ["payments", "sms", "email"] as const) keys[port].forEach((value, key) => committed[port].set(key, value));
          pending.list().forEach(entry => outbox.record(entry));
        },
      };
    },
  };
}

export function simulatedPayments({ outbox }: SimulatedOptions, guard = keyGuard("payments")): SimulatedPayments {
  const session = (action: string, input: Pick<CheckoutInput, "amount" | "description" | "reference" | "methods" | "idempotencyKey">) => {
    if (!isMoney(input.amount) || input.amount.amountMinor === 0 || !input.description.trim() || !input.reference || !input.idempotencyKey) return invalid("payments");
    const conflict = guard(input.idempotencyKey, [action, input.amount, input.reference, input.description, input.methods]);
    if (conflict) return conflict;
    const id = idFor("payments", action, [input.amount, input.reference, input.idempotencyKey]);
    // A reserved .invalid host: the link can never resolve to a real payment page.
    outbox.record({ id, port: "payments", action, body: input.description, reference: input.reference, cost: input.amount });
    return ok({ id, url: `https://checkout.invalid/simulated/${id}` }, "simulated", zero(input.amount.currency), id);
  };
  const checkoutNow = (input: CheckoutInput) => session("checkout", input);
  const refundNow = (input: RefundInput): PortResult<Refund> => {
    if (!input.paymentId || !input.idempotencyKey || (input.amount && !isMoney(input.amount))) return invalid("payments");
    const conflict = guard(input.idempotencyKey, ["refund", input.paymentId, input.amount]);
    if (conflict) return conflict;
    const id = idFor("payments", "refund", [input.paymentId, input.amount, input.idempotencyKey]);
    outbox.record({ id, port: "payments", action: "refund", body: input.paymentId, cost: input.amount ?? null });
    return ok({ id, amount: input.amount ?? null, state: "succeeded" }, "simulated", null, id);
  };
  return {
    info: { port: "payments", provider: PROVIDER, kind: "simulated", capabilities: ["checkout", "payment-link", "refund", "idempotency"], secrets: [] },
    checkoutNow, refundNow,
    createCheckout: async (input) => checkoutNow(input),
    createPaymentLink: async (input) => session("payment-link", input),
    refund: async (input) => refundNow(input),
    // Simulated payments have no webhooks: nothing outside can complete them.
    verifyWebhook: async () => fail(connectionError("payments", PROVIDER, "not_supported")),
  };
}

export function simulatedAccounting({ outbox }: SimulatedOptions): AccountingPort {
  return {
    info: { port: "accounting", provider: PROVIDER, kind: "simulated", capabilities: ["voucher", "daily-sales", "idempotency"], secrets: [] },
    async postVoucher(voucher) {
      if (!isBalanced(voucher.rows) || !/^\d{4}-\d{2}-\d{2}$/.test(voucher.date) || !voucher.reference) return invalid("accounting");
      const id = idFor("accounting", "voucher", [voucher.reference, voucher.rows]);
      outbox.record({ id, port: "accounting", action: "voucher", body: voucher.description, reference: voucher.reference, cost: null });
      return ok({ id, series: voucher.series }, "simulated", { amountMinor: 0, currency: voucher.currency }, id);
    },
  };
}

export function simulatedCalendar({ outbox }: SimulatedOptions): CalendarPort {
  // Per calendar: events plus a change counter, so a sync token returns only what changed since it.
  const calendars = new Map<string, { version: number; events: Map<string, BusyEvent & { version: number }> }>();
  const calendarOf = (id: string) => {
    let calendar = calendars.get(id);
    if (!calendar) calendars.set(id, (calendar = { version: 0, events: new Map() }));
    return calendar;
  };
  return {
    info: { port: "calendar", provider: PROVIDER, kind: "simulated", capabilities: ["push", "pull", "incremental-sync", "idempotency"], secrets: [] },
    async pushEvent(calendarId, event) {
      if (!calendarId || !isUtc(event.start) || !isUtc(event.end) || !isBefore(event.start, event.end) || !isTimeZone(event.timeZone) || !event.id) return invalid("calendar");
      const calendar = calendarOf(calendarId);
      const providerEventId = idFor("calendar", "event", [calendarId, event.id]);
      calendar.version += 1;
      calendar.events.set(providerEventId, { providerEventId, start: event.start, end: event.end, cancelled: false, ownId: event.id, version: calendar.version });
      outbox.record({ id: idFor("calendar", "push", [calendarId, event]), port: "calendar", action: "push", body: event.title, reference: event.id, cost: null });
      return ok({ providerEventId }, "simulated", null, providerEventId);
    },
    async deleteEvent(calendarId, providerEventId) {
      const calendar = calendarOf(calendarId);
      const event = calendar.events.get(providerEventId);
      if (!event) return fail(connectionError("calendar", PROVIDER, "not_found"));
      calendar.version += 1;
      calendar.events.set(providerEventId, { ...event, cancelled: true, version: calendar.version });
      outbox.record({ id: idFor("calendar", "delete", [calendarId, providerEventId, calendar.version]), port: "calendar", action: "delete", body: providerEventId, cost: null });
      return ok({ deleted: true }, "simulated");
    },
    async pullEvents(input) {
      const since = input.syncToken?.match(/^sim-(\d+)$/)?.[1];
      if (input.syncToken && since === undefined) return ok({ events: [], fullResyncRequired: true }, "simulated");
      if (!input.syncToken && (!input.from || !input.to || !isUtc(input.from) || !isUtc(input.to))) return invalid("calendar");
      const calendar = calendarOf(input.calendarId);
      const events = [...calendar.events.values()]
        .filter((e) => (since !== undefined ? e.version > Number(since) : !e.cancelled && isBefore(e.start, input.to!) && isBefore(input.from!, e.end)))
        .map((e): BusyEvent => ({ providerEventId: e.providerEventId, start: e.start, end: e.end, cancelled: e.cancelled, ...(e.ownId ? { ownId: e.ownId } : {}) }));
      return ok({ events, nextSyncToken: `sim-${calendar.version}`, fullResyncRequired: false }, "simulated");
    },
  };
}

export function simulatedListing({ outbox }: SimulatedOptions): ListingPort {
  return {
    info: { port: "listing", provider: PROVIDER, kind: "simulated", capabilities: ["feeds", "realtime-updates"], secrets: [] },
    buildFeeds: (snapshot, generatedAt) => buildReserveFeeds(snapshot, generatedAt, "listing", PROVIDER),
    // Nobody outside can call a simulated booking server.
    authenticateBookingCall: async () => fail(connectionError("listing", PROVIDER, "not_supported")),
    async notifyAvailability(snapshot) {
      outbox.record({ id: idFor("listing", "availability", snapshot.slots), port: "listing", action: "availability", body: `${snapshot.slots.length} slots`, reference: snapshot.merchant.id, cost: null });
      return ok({ accepted: snapshot.slots.length }, "simulated");
    },
  };
}

export function simulatedSocial({ outbox }: SimulatedOptions): SocialPort {
  return {
    info: { port: "social", provider: PROVIDER, kind: "simulated", capabilities: ["post-image", "instagram", "facebook"], secrets: [] },
    async publish(post) {
      if (!post.caption.trim() || post.caption.length > 2200 || !isHttps(post.imageUrl) || !post.reference) return invalid("social");
      const id = idFor("social", post.channel, [post.reference, post.caption, post.imageUrl]);
      outbox.record({ id, port: "social", action: post.channel, body: post.caption, reference: post.reference, cost: null });
      return ok({ postId: id }, "simulated", null, id);
    },
  };
}

export function simulatedAds({ outbox }: SimulatedOptions): AdsPort {
  return {
    info: { port: "ads", provider: PROVIDER, kind: "simulated", capabilities: ["campaign-draft"], secrets: [] },
    async createDraft(draft) {
      if (!isMoney(draft.dailyBudget) || !isCountry(draft.country) || !isUtc(draft.start) || !isUtc(draft.end) || !isBefore(draft.start, draft.end) || !draft.name.trim()) return invalid("ads");
      const id = idFor("ads", "draft", [draft.reference, draft.name, draft.dailyBudget]);
      outbox.record({ id, port: "ads", action: "draft", body: draft.name, reference: draft.reference, cost: null });
      return ok({ draftId: id, state: "paused" }, "simulated", null, id);
    },
  };
}

export function simulatedAdapters(options: SimulatedOptions): PortMap {
  return {
    sms: simulatedSms(options),
    email: simulatedEmail(options),
    payments: simulatedPayments(options),
    accounting: simulatedAccounting(options),
    calendar: simulatedCalendar(options),
    listing: simulatedListing(options),
    social: simulatedSocial(options),
    ads: simulatedAds(options),
  };
}
