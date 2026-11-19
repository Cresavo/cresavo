import { createHash } from "node:crypto";
import type { DemoChannels } from "../connections/demo";
import type { PortName } from "../connections/core";
import { simulatedEmail, simulatedPayments, simulatedSms, simulatedSocial } from "../connections/simulated/adapters";
import type { Outbox, OutboxEntry } from "../connections/simulated/outbox";
import { canonicalJson } from "../data/json-equal";
import type { TenantId } from "./studio-store";

// Simulated channels for one server-side apply. Like `channelLedger().stage()`
// they only record what would be sent, but each record keeps the full provider
// request it came from: its port, operation, idempotency key and input. The
// outbox record id is a 32-bit hash and two different requests can share it,
// so durable effect ids and conflict checks are derived from the request.

/** One provider call the reducer made, with the record the simulated adapter wrote for it. */
export interface StagedRequest {
  port: PortName;
  operation: string;
  /** The provider idempotency key, or null for a port without one (social posts). */
  key: string | null;
  request: unknown;
  record: OutboxEntry;
}

interface Context { port: PortName; operation: string; key: string | null; request: unknown }

export function stagedChannels(currency: string) {
  const records: OutboxEntry[] = [];
  const requests: StagedRequest[] = [];
  let context: Context | null = null;
  // Keeps every record, even one whose id repeats: the effect list decides what is new.
  const outbox: Outbox = {
    record(entry) {
      const record = Object.freeze({ ...entry });
      records.push(record);
      requests.push({ ...(context ?? { port: entry.port, operation: entry.action, key: null, request: entry }), record });
    },
    list: (port) => (port ? records.filter((entry) => entry.port === port) : [...records]),
    clear() {},
  };
  /** Runs one port call with its request as the context of whatever it records. */
  function call<I, R>(port: PortName, operation: string, keyOf: (input: I) => string | null | undefined, run: (input: I) => R) {
    return (input: I): R => {
      const previous = context;
      context = { port, operation, key: keyOf(input) ?? null, request: input };
      try {
        return run(input);
      } finally {
        context = previous;
      }
    };
  }

  const options = { outbox, currency };
  const payments = simulatedPayments(options);
  const checkoutNow = call("payments", "checkout", (input: Parameters<typeof payments.checkoutNow>[0]) => input.idempotencyKey, payments.checkoutNow);
  const refundNow = call("payments", "refund", (input: Parameters<typeof payments.refundNow>[0]) => input.idempotencyKey, payments.refundNow);
  const paymentLink = call("payments", "payment-link", (input: Parameters<typeof payments.createPaymentLink>[0]) => input.idempotencyKey, payments.createPaymentLink);
  const sms = simulatedSms(options);
  const smsDeliver = call("sms", "send", (message: Parameters<typeof sms.deliver>[0]) => message.idempotencyKey, sms.deliver);
  const email = simulatedEmail(options);
  const emailDeliver = call("email", "send", (message: Parameters<typeof email.deliver>[0]) => message.idempotencyKey, email.deliver);
  const social = simulatedSocial(options);
  const publish = call("social", "publish", () => null, social.publish);

  const channels: DemoChannels = {
    outbox,
    sms: { ...sms, deliver: smsDeliver, send: async (message) => smsDeliver(message) },
    email: { ...email, deliver: emailDeliver, send: async (message) => emailDeliver(message) },
    social: { ...social, publish },
  };
  return {
    ...channels,
    payments: { ...payments, checkoutNow, refundNow, createCheckout: async (input: Parameters<typeof checkoutNow>[0]) => checkoutNow(input), createPaymentLink: paymentLink },
    hasPayments: () => requests.some((entry) => entry.port === "payments"),
    /** Nothing to publish: the store turns `requests` into outbox rows in its own transaction. */
    publish() {},
    requests: () => [...requests],
  };
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/**
 * The durable effect id: the tenant plus the full logical provider key (port,
 * operation, idempotency key), or the whole request for a port without keys.
 * Stable across retries, unique across tenants, used as the provider's key.
 */
export function effectId(tenantId: TenantId, staged: StagedRequest): string {
  const logical = staged.key ?? canonicalJson(staged.request);
  return `eff_${sha256(JSON.stringify([tenantId, staged.port, staged.operation, logical]))}`;
}

/** SHA-256 of the full request: the same id with another fingerprint is a key reused for different content. */
export function requestFingerprint(staged: StagedRequest): string {
  return sha256(canonicalJson([staged.port, staged.operation, staged.request]));
}
