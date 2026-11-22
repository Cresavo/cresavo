import { DomainError } from "./errors";
import { checkRateLimit, clearRateLimit } from "./rate-limit";
import { RATE_POLICY } from "./rate-limit-policy";

// Per-account lockout for owner sign-in, on top of the per-address limit.
//
// Five wrong passwords within 15 minutes lock the account. The first lock lasts
// 15 minutes and each further lock within a day doubles it (30 min, 1 h, 2 h ...)
// up to 8 hours. The counters live in the shared rate-limit store, keyed by the
// e-mail address typed, so an unknown address locks exactly like a known one and
// the answer never reveals whether an account exists.

const BASE_LOCK_MS = 15 * 60_000;
const MAX_LOCK_MS = 8 * 3600_000;
const THRESHOLD = RATE_POLICY["login-account"].limit;

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

/** Counts one wrong password; the fifth locks the account and starts a new count after the lock. */
export async function recordFailedLogin(email: string, now = Date.now()) {
  // A refusal means the count is already at the threshold (a concurrent request got there first).
  let failures = THRESHOLD;
  await refused(async () => { failures = await checkRateLimit("login-account", email); });
  if (failures < THRESHOLD) return;
  let strikes = RATE_POLICY["login-strikes"].limit;
  await refused(async () => { strikes = await checkRateLimit("login-strikes", email); });
  await refused(() => checkRateLimit("login-lock", email, true, now, lockDurationMs(strikes)));
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
