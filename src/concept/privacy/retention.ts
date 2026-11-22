import { IDEMPOTENCY_TTL_MS } from "../store/idempotency";

// Retention periods for personal data: the single place they are defined.
//
// THESE ARE DEFAULTS, NOT LEGAL ADVICE. The salon (as controller) or a lawyer
// must confirm every period before the pilot gate in docs/QUALITY_SECURITY.md
// is signed off. Shortening a period is always safe; lengthening one needs a
// stated purpose (GDPR art. 5(1)(e)). Bookkeeping records follow the
// bookkeeping law and are not governed by this file.

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION = {
  /**
   * A customer whose last visit is this many years ago (or who never visited
   * and was added this long ago) appears under "Customers due for review".
   * The owner decides; nothing is ever deleted automatically.
   */
  inactiveCustomerYears: 3,
  /** The owner may keep a customer after a review; they come back after this many months. */
  reviewAgainMonths: 12,
  /**
   * Journal entries follow the owner's own setting (`state.privacy`). Without a
   * setting they are kept until the owner decides, and never deleted
   * automatically. The owner picks one of these as the review period.
   */
  journalYearsChoices: [1, 2, 3, 5, 7, 10] as readonly number[],
  /** Activity log entries (the audit rows and the studio's history) lose their personal data after this many months. */
  activityPersonalDataMonths: 13,
  /** The log of journal reads is kept this long. An addition by engineering: the salon or a lawyer should confirm it. */
  journalAccessLogMonths: 24,
  /** Message bodies, subjects and addresses in the outbox are blanked after this many days, once the message is no longer pending. */
  outboxBodyDays: 90,
  /** Rate-limit rows are removed this many days after they expire. */
  rateLimitDays: 1,
  /** Idempotency keys (and the saved results they replay) live this many hours. Defined in the idempotency store. */
  idempotencyHours: IDEMPOTENCY_TTL_MS / (60 * 60 * 1000),
} as const;

export const OUTBOX_BODY_MS = RETENTION.outboxBodyDays * DAY_MS;
export const RATE_LIMIT_MS = RETENTION.rateLimitDays * DAY_MS;

/** The instant `months` calendar months before `at` (epoch ms, UTC). The day is clamped to the month's length. */
export function monthsBefore(at: number, months: number): number {
  const date = new Date(at);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.getTime();
}

/** Activity entries recorded before this instant have their personal data removed. */
export const activityCutoff = (now: number) => monthsBefore(now, RETENTION.activityPersonalDataMonths);
