import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

// Keys and stored values for owner two-step sign-in. node:crypto only.
//
// OWNER_MFA_KEY is 32 random bytes in base64 (`openssl rand -base64 32`). It encrypts the authenticator secret
// with AES-256-GCM, stored as `v1:<iv>:<tag>:<ciphertext>` (base64url), so a later key can use another version.
// The account id is authenticated with it, so a secret copied onto another account's row does not decrypt.
// Recovery codes are stored as HMAC-SHA-256 under a key derived from OWNER_MFA_KEY with HKDF and a label of
// its own: a database copy alone reveals no code. The codes carry 50 random bits, so no slow hash is needed.
// Nothing here logs a secret, a code or a key.

const KEY_PATTERN = /^[A-Za-z0-9+/]{43}=?$/;
const STORED_PATTERN = /^v1:([A-Za-z0-9_-]{16}):([A-Za-z0-9_-]{22}):([A-Za-z0-9_-]{1,200})$/;
const RECOVERY_LABEL = "owner-recovery-code:v1";

/** Unambiguous letters and digits (Crockford's base32 in lower case: no i, l, o or u). */
export const RECOVERY_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
export const RECOVERY_CODE_COUNT = 10;
const RECOVERY_LENGTH = 10;

/** The configured key, or null when OWNER_MFA_KEY is missing or is not 32 bytes of base64. */
export function mfaKey(value = process.env.OWNER_MFA_KEY): Buffer | null {
  if (!value || !KEY_PATTERN.test(value)) return null;
  const key = Buffer.from(value, "base64");
  return key.length === 32 ? key : null;
}

/** Thrown when a stored secret does not decrypt with the configured key: a rotated key, or a changed row. */
export class MfaSecretUnreadable extends Error {
  constructor() { super("MFA_SECRET_UNREADABLE"); }
}

const aad = (accountId: string) => Buffer.from(`owner-totp:v1:${accountId}`);

export function encryptSecret(secret: Uint8Array, accountId: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv).setAAD(aad(accountId));
  const body = Buffer.concat([cipher.update(secret), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${body.toString("base64url")}`;
}

export function decryptSecret(stored: string, accountId: string, key: Buffer): Buffer {
  const parts = STORED_PATTERN.exec(stored);
  if (!parts) throw new MfaSecretUnreadable();
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64url")).setAAD(aad(accountId));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]);
  } catch {
    throw new MfaSecretUnreadable();
  }
}

/** A fresh code, shown as `xxxxx-xxxxx`. */
export function newRecoveryCode(): string {
  const chars = [...randomBytes(RECOVERY_LENGTH)].map((byte) => RECOVERY_ALPHABET[byte & 31]).join("");
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

export const newRecoveryCodes = () => Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);

/** A code as typed: any case, with or without the dash or spaces; o, i and l read as 0, 1 and 1. Null for anything else. */
export function normalizeRecoveryCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 40) return null;
  const code = input.toLowerCase().replace(/[\s-]+/g, "").replace(/o/g, "0").replace(/[il]/g, "1");
  return code.length === RECOVERY_LENGTH && [...code].every((c) => RECOVERY_ALPHABET.includes(c)) ? code : null;
}

const recoveryKey = (key: Buffer) => Buffer.from(hkdfSync("sha256", key, Buffer.alloc(0), RECOVERY_LABEL, 32));

/** The stored form of a code, bound to its account so it cannot open another. */
export function hashRecoveryCode(code: string, accountId: string, key: Buffer): string {
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) throw new Error("invalid recovery code");
  return createHmac("sha256", recoveryKey(key)).update(`${accountId}:${normalized}`).digest("hex");
}

/** Compares two stored hashes in constant time. */
export function sameHash(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
