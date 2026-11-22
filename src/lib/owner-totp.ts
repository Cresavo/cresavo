import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BRAND } from "@/concept/brand";

// Time-based one-time codes (RFC 6238 over RFC 4226): HMAC-SHA-1, six digits, a 30-second step. A code is
// accepted for the current step and one step either side, and only for a step later than the last one used,
// so a code works once. Pure functions: the database side (owner-mfa.ts) records the step that was used.

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted either side of the current one. */
export const TOTP_WINDOW = 1;
export const TOTP_SECRET_BYTES = 20;

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 without padding, as authenticator apps expect it. */
export function base32(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export const newTotpSecret = () => randomBytes(TOTP_SECRET_BYTES);

/** The HOTP value for one counter (RFC 4226, dynamic truncation). */
export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(message).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

export const totpStep = (nowMs: number) => Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);

/** A code as typed: digits only, spaces allowed between them. Null for anything else. */
export function normalizeTotp(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 20) return null;
  const code = input.replace(/\s+/g, "");
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code) ? code : null;
}

/**
 * The step whose code this is, within the window and later than `lastStep`; null otherwise. Every candidate is
 * compared, in constant time, so the answer takes the same time whichever step matched.
 */
export function matchTotp(secret: Uint8Array, code: string, nowMs: number, lastStep: number | null): number | null {
  const current = totpStep(nowMs);
  const given = Buffer.from(code.padEnd(TOTP_DIGITS, "x").slice(0, TOTP_DIGITS));
  let matched: number | null = null;
  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step++) {
    const same = timingSafeEqual(Buffer.from(hotp(secret, step)), given);
    if (same && step > (lastStep ?? -1) && matched === null) matched = step;
  }
  return matched;
}

/** The address an authenticator app reads from the QR code. */
export function otpauthUri(secret: Uint8Array, accountName: string): string {
  const label = encodeURIComponent(`${BRAND.name}:${accountName}`);
  const params = new URLSearchParams({
    secret: base32(secret), issuer: BRAND.name, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}
