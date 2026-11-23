import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// The short-lived proof that a password was right, carried from POST /api/owner/login to
// POST /api/owner/login/mfa. The cookie holds the account id, its credential version, an expiry and a random
// nonce, with an HMAC over all four under SESSION_SECRET. The database keeps only the SHA-256 of the nonce
// (owner_mfa_challenge), which opening the session consumes, so a challenge works once; "sign out
// everywhere", a password reset and any credential version change retire it. It never opens a session by itself.

export const SECOND_STEP_COOKIE = "cresavo_owner_step";
export const SECOND_STEP_PATH = "/api/owner/login";
export const SECOND_STEP_TTL_MS = 5 * 60_000;
const PATTERN = /^[a-z0-9]{20,32}\.\d{1,9}\.\d{13}\.[a-f0-9]{32}\.[a-f0-9]{64}$/;

/** The HMAC over the cookie's four parts. Only the account id, two numbers and the random nonce go in. */
function sign(accountId: string, version: number, expires: number, nonce: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(Buffer.from(`owner-second-step:v1:${accountId}.${version}.${expires}.${nonce}`, "utf8")).digest("hex");
}

export interface PendingSecondStep {
  accountId: string;
  credentialVersion: number;
}

/** The stored id of a challenge: the SHA-256 of its nonce. */
export const challengeId = (nonce: string) => createHash("sha256").update(Buffer.from(nonce, "hex")).digest("hex");

export function signPending({ accountId, credentialVersion }: PendingSecondStep, now = Date.now()) {
  const expires = now + SECOND_STEP_TTL_MS;
  const nonce = randomBytes(16).toString("hex");
  const body = `${accountId}.${credentialVersion}.${expires}.${nonce}`;
  return { value: `${body}.${sign(accountId, credentialVersion, expires, nonce)}`, expires: new Date(expires), challenge: challengeId(nonce) };
}

/** The account the cookie was issued for; null when it is malformed, expired or not signed by this server. */
export function parsePending(value: string | undefined, now = Date.now()): (PendingSecondStep & { challenge: string }) | null {
  if (!value || !PATTERN.test(value)) return null;
  const [accountId, version, expiry, nonce, signature] = value.split(".");
  const expires = Number(expiry);
  if (expires <= now || expires > now + SECOND_STEP_TTL_MS) return null;
  const expected = Buffer.from(sign(accountId, Number(version), expires, nonce));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { accountId, credentialVersion: Number(version), challenge: challengeId(nonce) };
}
