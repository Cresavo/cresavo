import type { Money, PortName } from "../core";

/** Bookkeeping a sink keeps on a stored message effect, never sent anywhere. Erasure drops all of it. */
export interface DeliveryState {
  /** Epoch milliseconds of the first attempt. */
  firstAttemptAt?: number;
  /** Before the live flag moved to the effect itself (`OutboxEntry.live`): read only, so a row written then keeps its intent. */
  live?: boolean;
  /** The provider the first request went to, recorded with `dispatched`: only that provider's idempotency key can make a repeat safe. */
  provider?: string;
  /** A fingerprint of the sending account (never the key), recorded with `provider`: a repeat is safe only at the same account. */
  account?: string;
  /**
   * Epoch milliseconds of the first time a request may have reached the provider: set with the first `dispatched`
   * marker that was followed by a real call, never cleared. The provider's idempotency window counts from here, not
   * from the first rendering, so a long pause before the first request does not use it up.
   */
  submittedAt?: number;
  /** The provider accepted it. A retry that finds this only acknowledges. */
  sent?: boolean;
  /** Committed before the provider is called, and cleared only when nothing was sent: a request that may have left. */
  dispatched?: boolean;
  /** Why the effect failed, for whoever reconciles it by hand. */
  reason?: string;
  /** The code of the last attempt's error (`EMAIL_NOT_CONFIGURED`, `EMAIL_RETRYABLE`, ...), never its text. Kept by the outbox. */
  lastError?: string;
  /** Attempts that do not count toward the outbox's limit (deferrals, and those before an operator's retry). Kept by the outbox; `attempts` itself never goes down. */
  attemptBase?: number;
  /** What an operator settled by hand with `npm run effects:reconcile` (`sent`, `not_sent`, `retried`). */
  reconciled?: string;
  /** The message as first rendered, resent unchanged under the same key. */
  mail?: { subject: string; text: string; html: string };
  /** The booking link as first made: its address and the token's expiry in epoch seconds, never the token. Frozen with the message. */
  link?: { url: string; exp: number };
  /** The sender and the reply-to as first built. Frozen with the message. */
  from?: string;
  replyTo?: string;
}

/** What a simulated adapter "would have sent". Recipients are references or addresses exactly as given; nothing here leaves the process. */
export interface OutboxEntry {
  id: string;
  port: PortName;
  action: string;
  to?: string;
  subject?: string;
  body: string;
  reference?: string;
  cost: Money | null;
  /** Set when the store stages a message: the deployment meant it to be sent for real. A `false` row is only ever simulated. */
  live?: boolean;
  delivery?: DeliveryState;
}

export interface Outbox {
  /** Idempotent: an entry with a known id is ignored, so replays and React double renders record once. */
  record(entry: OutboxEntry): void;
  list(port?: PortName): OutboxEntry[];
  clear(): void;
}

export function createOutbox(limit = 500): Outbox {
  const entries = new Map<string, OutboxEntry>();
  return {
    record(entry) {
      if (entries.has(entry.id)) return;
      entries.set(entry.id, Object.freeze({ ...entry }));
      while (entries.size > limit) entries.delete(entries.keys().next().value as string);
    },
    list(port) {
      const all = [...entries.values()];
      return port ? all.filter((e) => e.port === port) : all;
    },
    clear() {
      entries.clear();
    },
  };
}
