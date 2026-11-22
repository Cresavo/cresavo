import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// The short-lived proof that a password was right, carried from POST /api/owner/login to
// POST /api/owner/login/mfa. Nothing is stored: the cookie holds the account id, its credential version, an
// expiry and a random nonce, with an HMAC over all four under SESSION_SECRET. The second step checks the
// version against the account, so enabling or disabling two-step sign-in or a password reset retires every
// pending cookie. It never opens a session by itself.

export const OWNER_MFA_PENDING_COOKIE = "cresavo_owner_mfa";
export const OWNER_MFA_PENDING_PATH = "/api/owner/login";
export const MFA_PENDING_MS = 5 * 60_000;
const PATTERN = /^[a-z0-9]{20,32}\.\d{1,9}\.\d{13}\.[a-f0-9]{32}\.[a-f0-9]{64}$/;

function sign(body: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(`owner-mfa-pending:v1:${body}`).digest("hex");
}

export interface PendingSecondStep {
  accountId: string;
  credentialVersion: number;
}

export function signPending({ accountId, credentialVersion }: PendingSecondStep, now = Date.now()) {
  const expires = now + MFA_PENDING_MS;
  const body = `${accountId}.${credentialVersion}.${expires}.${randomBytes(16).toString("hex")}`;
  return { value: `${body}.${sign(body)}`, expires: new Date(expires) };
}

/** The account the cookie was issued for; null when it is malformed, expired or not signed by this server. */
export function parsePending(value: string | undefined, now = Date.now()): PendingSecondStep | null {
  if (!value || !PATTERN.test(value)) return null;
  const [accountId, version, expiry, nonce, signature] = value.split(".");
  const expires = Number(expiry);
  if (expires <= now || expires > now + MFA_PENDING_MS) return null;
  const expected = Buffer.from(sign(`${accountId}.${version}.${expiry}.${nonce}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { accountId, credentialVersion: Number(version) };
}
