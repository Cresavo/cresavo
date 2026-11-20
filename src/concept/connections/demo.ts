import type { Campaign } from "../data/types";
import { stableHash } from "./core";
import type { Outbox, OutboxEntry } from "./simulated/outbox";
import { createOutbox } from "./simulated/outbox";
import { channelLedger, simulatedEmail, paymentLedger, simulatedSms, simulatedSocial, type SimulatedEmail, type SimulatedSms } from "./simulated/adapters";
import type { SocialPort } from "./ports/social";

// The concept demo's sends go through the ports here, always with the
// simulated adapters: the browser never holds a key and never picks a live
// provider. Recipients are references ("customer:c-12"), not addresses, so the
// outbox holds no contact details. The demo business is Swedish, so costs are
// reported in SEK; the ports themselves take any ISO 4217 currency.

const DEMO_CURRENCY = "SEK";

export const demoOutbox: Outbox = createOutbox();
export const demoPaymentLedger = paymentLedger(demoOutbox);
export const demoPayments = demoPaymentLedger.direct;

/** Where the demo's messages and posts go. The reducer uses the shared outbox unless a store scopes it with `withDemoChannels`. */
export interface DemoChannels {
  outbox: Outbox;
  sms: SimulatedSms;
  email: SimulatedEmail;
  social: SocialPort;
}

const shared: DemoChannels = {
  outbox: demoOutbox,
  sms: simulatedSms({ outbox: demoOutbox, currency: DEMO_CURRENCY }),
  email: simulatedEmail({ outbox: demoOutbox, currency: DEMO_CURRENCY }),
  social: simulatedSocial({ outbox: demoOutbox, currency: DEMO_CURRENCY }),
};
let channels = shared;

const demoMessageLedger = channelLedger(demoOutbox, DEMO_CURRENCY);

/**
 * One browser save's sends, staged: payments (on the payment ledger, which the
 * direct port shares), SMS, email and posts. Run the reducer inside
 * `withDemoChannels(stage, …)`; nothing reaches `demoOutbox` until `publish`,
 * which the store calls only after the save succeeded.
 */
export function stageDemoSends() {
  const payments = demoPaymentLedger.stage();
  const messages = demoMessageLedger.stage();
  return {
    outbox: messages.outbox,
    sms: messages.sms,
    email: messages.email,
    social: messages.social,
    payments: payments.payments,
    hasPayments: payments.hasPayments,
    publish() {
      payments.publish();
      messages.publish();
    },
  };
}

/** The demo currency, for stores that build their own channels. */
export const DEMO_CHANNEL_CURRENCY = DEMO_CURRENCY;

/** Runs a synchronous reducer call with its sends going to `scoped` instead of the shared outbox. */
export function withDemoChannels<T>(scoped: DemoChannels, run: () => T): T {
  const previous = channels;
  channels = scoped;
  try {
    return run();
  } finally {
    channels = previous;
  }
}

export type DemoChannel = "sms" | "email";

export interface DemoMessage {
  channel: DemoChannel;
  /** A customer id, or a segment such as "waitlist" when the message goes to a group. */
  to: { customerId: string } | { segment: string };
  subject?: string;
  body: string;
  /** Stable per logical send (booking + kind + slot), so a replayed reducer records once. */
  reference: string;
}

const recipient = (to: DemoMessage["to"]) => ("customerId" in to ? `customer:${to.customerId}` : `segment:${to.segment}`);

/** Sends one simulated message and returns what was recorded, or null when the port refused the input. */
export function sendDemoMessage(message: DemoMessage): OutboxEntry | null {
  const to = recipient(message.to);
  // The body is part of the key: the same logical send with new text (a renamed salon) is a new message, not a conflict.
  const idempotencyKey = `${message.reference}-${stableHash(`${message.subject ?? ""}\n${message.body}`)}`;
  const { sms, email, outbox } = channels;
  const result = message.channel === "sms"
    ? sms.deliver({ to, body: message.body, reference: message.reference, idempotencyKey })
    : email.deliver({ to: [to], from: "demo@salon.invalid", subject: message.subject ?? "", text: message.body, idempotencyKey });
  if (!result.ok) return null;
  return outbox.list(message.channel).find((entry) => entry.id === result.providerId) ?? null;
}

/** What a campaign that goes live today would have posted and sent: one record per channel with copy. TikTok has no port yet. */
export function sendDemoCampaign(campaign: Pick<Campaign, "id" | "name" | "channels" | "copy">): void {
  const { sms, email, social } = channels;
  for (const channel of campaign.channels) {
    const copy = campaign.copy?.[channel]?.trim() || campaign.name;
    const reference = `campaign-${campaign.id}-${channel}`;
    if (channel === "instagram" || channel === "facebook") {
      void social.publish({ channel, caption: copy.slice(0, 2200), imageUrl: `https://media.invalid/campaigns/${campaign.id}.png`, reference });
    } else if (channel === "sms") {
      sms.deliver({ to: `segment:campaign-${campaign.id}`, body: copy.slice(0, 1600), reference, idempotencyKey: `${reference}-${stableHash(copy)}` });
    } else if (channel === "newsletter") {
      email.deliver({ to: [`segment:campaign-${campaign.id}`], from: "demo@salon.invalid", subject: campaign.name, text: copy, idempotencyKey: `${reference}-${stableHash(copy)}` });
    }
  }
}
