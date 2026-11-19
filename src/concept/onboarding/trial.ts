// A salon made in setup is a trial that lives only in this browser. It is removed
// when it has not been used for a day. The demo salon (Salong Eko) never expires.
// The clock is a parameter so the rule can be tested without waiting.

export const TRIAL_IDLE_MS = 24 * 60 * 60 * 1000;

/** The stored last-use time, or null when there is none (an older salon or unavailable storage). */
export function parseLastUse(raw: string | null): number | null {
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** True when the trial has gone unused for 24 hours. Without a record the trial starts counting now. */
export function trialExpired(lastUse: number | null, now: number): boolean {
  return lastUse !== null && now - lastUse >= TRIAL_IDLE_MS;
}
