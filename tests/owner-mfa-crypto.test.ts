import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptSecret, encryptSecret, hashRecoveryCode, mfaKey, MfaSecretUnreadable, newRecoveryCodes, normalizeRecoveryCode, RECOVERY_ALPHABET,
  RECOVERY_CODE_COUNT, RECOVERY_SCRYPT, sameHash,
} from "@/lib/owner-mfa-crypto";
import { SECOND_STEP_TTL_MS, parsePending, signPending } from "@/lib/owner-mfa-pending";
import { base32, hotp, matchTotp, normalizeTotp, otpauthUri, TOTP_STEP_SECONDS, totpStep } from "@/lib/owner-totp";

// The pure parts of owner two-step sign-in. All values are invented, except the published RFC test vectors.

afterEach(() => vi.unstubAllEnvs());

// RFC 6238 appendix B, SHA-1, with the RFC's 20-byte ASCII secret.
const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");
const RFC_VECTORS: [number, string][] = [
  [59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"], [20000000000, "65353130"],
];

describe("TOTP (RFC 6238)", () => {
  it("matches the RFC test vectors, in eight digits and in the six this product uses", () => {
    for (const [seconds, code] of RFC_VECTORS) {
      const step = totpStep(seconds * 1000);
      expect(hotp(RFC_SECRET, step, 8), String(seconds)).toBe(code);
      expect(hotp(RFC_SECRET, step), String(seconds)).toBe(code.slice(-6));
    }
  });

  it("accepts the current step and one either side, nothing further", () => {
    const now = 1111111111 * 1000;
    const step = totpStep(now);
    for (const offset of [-1, 0, 1]) expect(matchTotp(RFC_SECRET, hotp(RFC_SECRET, step + offset), now, null)).toBe(step + offset);
    for (const offset of [-2, 2, 10]) expect(matchTotp(RFC_SECRET, hotp(RFC_SECRET, step + offset), now, null)).toBeNull();
    expect(matchTotp(randomBytes(20), hotp(RFC_SECRET, step), now, null)).toBeNull();
  });

  it("refuses a code for the last used step or an earlier one", () => {
    const now = 1234567890 * 1000;
    const step = totpStep(now);
    const code = hotp(RFC_SECRET, step);
    expect(matchTotp(RFC_SECRET, code, now, step - 1)).toBe(step);
    expect(matchTotp(RFC_SECRET, code, now, step)).toBeNull();
    expect(matchTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1), now, step)).toBeNull();
    expect(matchTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1), now, step)).toBe(step + 1);
  });

  it("refuses a code two steps in the window share", () => {
    // Steps 153567 and 153569 of the RFC secret both give 468457.
    expect(hotp(RFC_SECRET, 153567)).toBe("468457");
    expect(hotp(RFC_SECRET, 153569)).toBe("468457");
    const middle = 153568 * TOTP_STEP_SECONDS * 1000;
    expect(matchTotp(RFC_SECRET, "468457", middle, null)).toBeNull();
    expect(matchTotp(RFC_SECRET, "468457", middle, 153567)).toBeNull();
    // Outside the overlap the code is an ordinary one.
    expect(matchTotp(RFC_SECRET, "468457", middle - TOTP_STEP_SECONDS * 1000, null)).toBe(153567);
  });

  it("reads typed codes with spaces and refuses anything else", () => {
    expect(normalizeTotp("123 456")).toBe("123456");
    for (const bad of ["12345", "1234567", "12a456", "", 123456, null, "1".repeat(30)]) expect(normalizeTotp(bad)).toBeNull();
  });

  it("encodes the secret in base32 for the app and names the account", () => {
    expect(base32(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32(RFC_SECRET)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    const uri = new URL(otpauthUri(RFC_SECRET, "owner@example.test"));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.searchParams.get("secret")).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(uri.searchParams.get("digits")).toBe("6");
    expect(uri.searchParams.get("period")).toBe(String(TOTP_STEP_SECONDS));
    expect(decodeURIComponent(uri.pathname)).toMatch(/:owner@example\.test$/);
  });
});

describe("secret encryption", () => {
  const key = randomBytes(32);

  it("round-trips in the versioned format", () => {
    const secret = randomBytes(20);
    const stored = encryptSecret(secret, "acct-one", key);
    expect(stored).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    expect(decryptSecret(stored, "acct-one", key).equals(secret)).toBe(true);
    expect(encryptSecret(secret, "acct-one", key)).not.toBe(stored);
  });

  it("refuses a changed value, another account's row and the wrong key", () => {
    const stored = encryptSecret(randomBytes(20), "acct-one", key);
    const [version, iv, tag, body] = stored.split(":");
    const flip = (text: string) => (text[0] === "A" ? "B" : "A") + text.slice(1);
    for (const changed of [`${version}:${iv}:${tag}:${flip(body)}`, `${version}:${iv}:${flip(tag)}:${body}`, `${version}:${flip(iv)}:${tag}:${body}`, `v2:${iv}:${tag}:${body}`, "garbage"])
      expect(() => decryptSecret(changed, "acct-one", key), changed).toThrow(MfaSecretUnreadable);
    expect(() => decryptSecret(stored, "acct-two", key)).toThrow(MfaSecretUnreadable);
    expect(() => decryptSecret(stored, "acct-one", randomBytes(32))).toThrow(MfaSecretUnreadable);
  });

  it("reads OWNER_MFA_KEY only as 32 bytes of base64", () => {
    const good = randomBytes(32).toString("base64");
    expect(mfaKey(good)?.length).toBe(32);
    expect(mfaKey(good.replace(/=$/, ""))?.length).toBe(32);
    for (const bad of [undefined, "", randomBytes(16).toString("base64"), randomBytes(33).toString("base64"), randomBytes(32).toString("hex"), `${good.slice(0, -2)}!=`])
      expect(mfaKey(bad), String(bad)).toBeNull();
    vi.stubEnv("OWNER_MFA_KEY", good);
    expect(mfaKey()?.toString("base64")).toBe(good);
    vi.stubEnv("OWNER_MFA_KEY", "");
    expect(mfaKey()).toBeNull();
  });
});

describe("recovery codes", () => {
  const key = randomBytes(32);

  it("are ten codes of ten unambiguous characters, shown as xxxxx-xxxxx", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) expect(code).toMatch(/^[0-9a-hjkmnp-tv-z]{5}-[0-9a-hjkmnp-tv-z]{5}$/);
    expect(RECOVERY_ALPHABET).toHaveLength(32);
    for (const ambiguous of ["i", "l", "o", "u"]) expect(RECOVERY_ALPHABET).not.toContain(ambiguous);
  });

  it("read the way people type them", () => {
    expect(normalizeRecoveryCode(" AB2CD-EF3GH ")).toBe("ab2cdef3gh");
    expect(normalizeRecoveryCode("ab2cd ef3gh")).toBe("ab2cdef3gh");
    expect(normalizeRecoveryCode("oiL00-11111")).toBe("01100" + "11111");
    for (const bad of ["ab2cd-ef3g", "ab2cd-ef3ghj", "ab2cd-ef3g!", "", 42, "u".repeat(10)]) expect(normalizeRecoveryCode(bad), String(bad)).toBeNull();
  });

  it("hash with scrypt under a salt from the server key, bound to the account, the same however typed", async () => {
    const hash = await hashRecoveryCode("ab2cd-ef3gh", "acct-one", key);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("ab2cd");
    expect(RECOVERY_SCRYPT).toMatchObject({ N: 16384, r: 8, p: 1 });
    expect(sameHash(await hashRecoveryCode("AB2CDEF3GH", "acct-one", key), hash)).toBe(true);
    expect(sameHash(await hashRecoveryCode("ab2cd-ef3gh", "acct-two", key), hash)).toBe(false);
    expect(sameHash(await hashRecoveryCode("ab2cd-ef3gh", "acct-one", randomBytes(32)), hash)).toBe(false);
    await expect(hashRecoveryCode("not a code", "acct-one", key)).rejects.toThrow();
    expect(sameHash(hash, hash.slice(1))).toBe(false);
  });
});

describe("pending second-step cookie", () => {
  const now = Date.UTC(2026, 10, 22, 10);
  const pending = { accountId: "cacct0000000000000000001", credentialVersion: 3 };

  it("names the account and version until it expires after five minutes", () => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    const { value, expires, challenge } = signPending(pending, now);
    expect(expires.getTime()).toBe(now + SECOND_STEP_TTL_MS);
    expect(SECOND_STEP_TTL_MS).toBe(5 * 60_000);
    expect(challenge).toMatch(/^[a-f0-9]{64}$/);
    expect(value).not.toContain(challenge);
    expect(parsePending(value, now)).toEqual({ ...pending, challenge });
    expect(parsePending(value, now + SECOND_STEP_TTL_MS - 1)).toEqual({ ...pending, challenge });
    expect(parsePending(value, now + SECOND_STEP_TTL_MS)).toBeNull();
    expect(signPending(pending, now).value).not.toBe(value);
  });

  it("refuses forged, altered and foreign-key cookies", () => {
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    const { value } = signPending(pending, now);
    const [id, version, expiry, nonce, signature] = value.split(".");
    const bump = (text: string) => String(Number(text) + 1);
    for (const changed of [
      `${id}.${bump(version)}.${expiry}.${nonce}.${signature}`,
      `${id}.${version}.${bump(expiry)}.${nonce}.${signature}`,
      `cacct0000000000000000002.${version}.${expiry}.${nonce}.${signature}`,
      `${id}.${version}.${expiry}.${nonce}.${"0".repeat(64)}`,
      `${id}.${version}.${now + 60 * 60_000}.${nonce}.${signature}`,
      "", "garbage", undefined,
    ]) expect(parsePending(changed, now), String(changed)).toBeNull();
    vi.stubEnv("SESSION_SECRET", "y".repeat(40));
    expect(parsePending(value, now)).toBeNull();
  });
});
