import { DomainError } from "./errors";
import { checkRateLimit, clearRateLimit, refundBucketUse } from "./rate-limit";
import { RATE_POLICY } from "./rate-limit-policy";

// Per-account lockout for owner sign-in, on top of the per-address limit.
//
// Five wrong passwords within 15 minutes lock the account. The first lock lasts
// 15 minutes and each further lock within a day doubles it (30 min, 1 h, 2 h ...)
// up to 8 hours. The counters live in the shared rate-limit store, keyed by the
// e-mail address typed, so an unknown address locks exactly like a known one and
// the answer never reveals whether an account exists.
//
// An attempt is reserved before the password is checked, so concurrent requests
// cannot all slip under the threshold. Creating the lock is the one atomic step
// (the lock bucket admits a single use): only the request that creates it records
// the strike, so a burst of failures counts as one lock-out.

const BASE_LOCK_MS = 15 * 60_000;
const MAX_LOCK_MS = 8 * 3600_000;
export const LOCK_THRESHOLD = RATE_POLICY["login-account"].limit;

/** How long the nth lock within a day lasts. */
export const lockDurationMs = (strikes: number) => Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** Math.max(0, strikes - 1));

/** True when the store refused: the route's limit is reached. */
async function refused(operation: () => unknown) {
  try {
    await operation();
    return false;
  } catch (error) {
    if (error instanceof DomainError && error.status === 429) return true;
    throw error;
  }
}

/** True while the account is locked. Reads only; it uses up nothing. */
export const accountLocked = (email: string) => refused(() => checkRateLimit("login-lock", email, false));

/**
 * Reserves one attempt before the password is checked. Returns the attempt's number, or null when the account
 * is already out of attempts (locked, or other requests took the last ones).
 */
export async function reserveLoginAttempt(email: string): Promise<number | null> {
  let count: number | null = null;
  await refused(async () => { count = await checkRateLimit("login-account", email); });
  return count;
}

/** Gives back an attempt that was reserved but never judged. */
export const refundLoginAttempt = (email: string) => refundBucketUse("login-account", email);

/** Locks the account. Only the request that creates the lock records the strike and starts the next count. */
export async function lockAccount(email: string, now = Date.now()) {
  let strikes = 0;
  await refused(async () => { strikes = await checkRateLimit("login-strikes", email, false); });
  strikes = Math.min(strikes, RATE_POLICY["login-strikes"].limit - 1) + 1;
  const created = !(await refused(() => checkRateLimit("login-lock", email, true, now, lockDurationMs(strikes))));
  if (!created) return;
  await refused(() => checkRateLimit("login-strikes", email));
  await clearRateLimit("login-account", email);
}

/** A correct password: forgets the failures and the lock history. */
export async function clearFailedLogins(email: string) {
  await clearRateLimit("login-account", email);
  await clearRateLimit("login-strikes", email);
}

/** A password reset proves the owner controls the mailbox: it lifts a lock. */
export async function clearAccountLock(email: string) {
  await clearFailedLogins(email);
  await clearRateLimit("login-lock", email);
}
