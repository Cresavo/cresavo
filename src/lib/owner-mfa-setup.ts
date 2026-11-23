import { z } from "zod";
import { db } from "./db";
import type { OwnerIdentity } from "./owner-accounts";
import { loginGuard } from "./owner-guard-store";
import { decryptSecret, encryptSecret, mfaKey, newRecoveryCodes } from "./owner-mfa-crypto";
import { readingSecret, recoveryFactor, replaceRecoveryCodes, spendFactor, spendTotp, totpFactor } from "./owner-mfa";
import { closeAllOwnerSessions, openOwnerSession, type OwnerCookie } from "./owner-session";
import { base32, matchTotp, newTotpSecret, normalizeTotp, otpauthUri } from "./owner-totp";
import { verifyPasswordHash } from "./password";
import { assertWritable } from "./public-readonly";

// Setting up, turning off and renewing two-step sign-in. Every step needs a signed-in owner and the current
// password typed again; a wrong password counts toward the same lock-out as at sign-in. Turning it on or off
// raises the credential version, which ends every other session and every pending sign-in, and opens a new
// session for this device.

/** How long a secret shown for setup can be confirmed. */
export const SETUP_TTL_MS = 10 * 60_000;

const password = z.string().min(1).max(128);
const setupSchema = z.object({ password }).strict();
const enableSchema = totpFactor.extend({ password }).strict();
const disableSchema = z.union([totpFactor.extend({ password }).strict(), recoveryFactor.extend({ password }).strict()]);

export type MfaFailure = "invalid" | "wrong_password" | "invalid_code" | "not_configured" | "already_enabled" | "not_enabled" | "setup_expired";
export const MFA_FAILURE_STATUS: Record<MfaFailure, number> = {
  invalid: 400, wrong_password: 403, invalid_code: 400, not_configured: 503, already_enabled: 409, not_enabled: 409, setup_expired: 409,
};
type Failed = { ok: false; reason: MfaFailure };
const fail = (reason: MfaFailure): Failed => ({ ok: false, reason });

const accountFields = {
  id: true, email: true, active: true, passwordHash: true, credentialVersion: true,
  totpSecretEnc: true, totpPendingEnc: true, totpPendingExpiresAt: true, totpLastStep: true,
} as const;

/** The account when the password is right and the address is not locked; null otherwise. */
async function confirmPassword(accountId: string, typed: string) {
  const account = await db.ownerAccount.findUnique({ where: { id: accountId }, select: accountFields });
  if (!account?.active) return null;
  const guard = loginGuard();
  const locked = await guard.locked(account.email);
  const valid = await verifyPasswordHash(account.passwordHash, typed);
  if (!valid) await guard.failed(account.email);
  return valid && !locked && !(await guard.locked(account.email)) ? account : null;
}

type Account = NonNullable<Awaited<ReturnType<typeof confirmPassword>>>;

/** Parses the body, checks the key and the password; the account and key, or why not. */
async function authorize<T extends { password: string }>(accountId: string, schema: z.ZodType<T>, input: unknown) {
  const key = mfaKey();
  if (!key) return fail("not_configured");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("invalid");
  const account = await confirmPassword(accountId, parsed.data.password);
  return account ? { ok: true as const, account, key, body: parsed.data } : fail("wrong_password");
}

/**
 * Ends every session of the account and opens a new one for this device, marked as past the second step when
 * two-step sign-in is now on. Null when the account changed meanwhile.
 */
async function restartSessions(identity: OwnerIdentity, now: number, mfaVerified: boolean): Promise<OwnerCookie | null> {
  await closeAllOwnerSessions(identity.id, now);
  return openOwnerSession(identity, now, { mfaVerified });
}

/** A wrong second factor from a signed-in owner counts like one at sign-in. */
async function spendOrCount(account: Account, factor: Parameters<typeof spendFactor>[1], key: Buffer, now: number) {
  const used = await readingSecret(() => spendFactor(account, factor, key, now));
  if (used === false) await loginGuard().failed(account.email);
  return used;
}

/** Starts setup: a new secret, kept pending for ten minutes, for the authenticator app. */
export async function beginMfaSetup(accountId: string, input: unknown, now = Date.now()) {
  assertWritable();
  const auth = await authorize(accountId, setupSchema, input);
  if (!auth.ok) return auth;
  const { account, key } = auth;
  if (account.totpSecretEnc) return fail("already_enabled");
  const secret = newTotpSecret();
  const { count } = await db.ownerAccount.updateMany({
    // The row lock of the update checks the account is still the one whose password was confirmed.
    where: { id: account.id, active: true, credentialVersion: account.credentialVersion, totpSecretEnc: null },
    data: { totpPendingEnc: encryptSecret(secret, account.id, key), totpPendingExpiresAt: new Date(now + SETUP_TTL_MS) },
  });
  if (count !== 1) return fail("already_enabled");
  return { ok: true as const, otpauthUri: otpauthUri(secret, account.email), secret: base32(secret) };
}

/** Confirms setup with a first code: two-step sign-in is on, and the recovery codes are returned this once. */
export async function enableMfa(accountId: string, input: unknown, now = Date.now()) {
  assertWritable();
  const auth = await authorize(accountId, enableSchema, input);
  if (!auth.ok) return auth;
  const { account, key, body } = auth;
  if (account.totpSecretEnc) return fail("already_enabled");
  const pending = account.totpPendingEnc;
  if (!pending || !account.totpPendingExpiresAt || account.totpPendingExpiresAt.getTime() <= now) return fail("setup_expired");
  const secret = await readingSecret(async () => decryptSecret(pending, account.id, key));
  if (secret === "not_configured") return fail(secret);
  const code = normalizeTotp(body.code);
  const step = code ? matchTotp(secret, code, now, null) : null;
  const guard = loginGuard();
  if (step === null) {
    await guard.failed(account.email);
    return fail("invalid_code");
  }
  if (await guard.locked(account.email)) return fail("invalid_code");
  const recoveryCodes = newRecoveryCodes();
  const enabled = await db.$transaction(async (tx) => {
    const { count } = await tx.ownerAccount.updateMany({
      where: { id: account.id, active: true, credentialVersion: account.credentialVersion, totpSecretEnc: null, totpPendingEnc: pending },
      data: {
        totpSecretEnc: pending, totpPendingEnc: null, totpPendingExpiresAt: null, totpEnabledAt: new Date(now),
        totpLastStep: BigInt(step), credentialVersion: { increment: 1 },
      },
    });
    if (count !== 1) return false;
    await replaceRecoveryCodes(tx, account.id, recoveryCodes, key, now);
    return true;
  });
  if (!enabled) return fail("setup_expired");
  const cookie = await restartSessions({ id: account.id, credentialVersion: account.credentialVersion + 1 }, now, true);
  return { ok: true as const, recoveryCodes, cookie };
}

/** Turns two-step sign-in off with an authenticator or recovery code, and deletes the recovery codes. */
export async function disableMfa(accountId: string, input: unknown, now = Date.now()) {
  assertWritable();
  const auth = await authorize(accountId, disableSchema, input);
  if (!auth.ok) return auth;
  const { account, key, body } = auth;
  const secret = account.totpSecretEnc;
  if (!secret) return fail("not_enabled");
  const used = await spendOrCount(account, body, key, now);
  if (used !== true) return fail(used || "invalid_code");
  const disabled = await db.$transaction(async (tx) => {
    const { count } = await tx.ownerAccount.updateMany({
      where: { id: account.id, active: true, credentialVersion: account.credentialVersion, totpSecretEnc: secret },
      data: {
        totpSecretEnc: null, totpPendingEnc: null, totpPendingExpiresAt: null, totpEnabledAt: null, totpLastStep: null,
        credentialVersion: { increment: 1 },
      },
    });
    if (count !== 1) return false;
    await tx.ownerRecoveryCode.deleteMany({ where: { accountId: account.id } });
    return true;
  });
  if (!disabled) return fail("not_enabled");
  const cookie = await restartSessions({ id: account.id, credentialVersion: account.credentialVersion + 1 }, now, false);
  return { ok: true as const, cookie };
}

/** Replaces the recovery codes with new ones, returned this once. Needs an authenticator code. */
export async function regenerateRecoveryCodes(accountId: string, input: unknown, now = Date.now()) {
  assertWritable();
  const auth = await authorize(accountId, enableSchema, input);
  if (!auth.ok) return auth;
  const { account, key, body } = auth;
  if (!account.totpSecretEnc) return fail("not_enabled");
  const recoveryCodes = newRecoveryCodes();
  // Under the account's row lock: still active, still the credential version whose password was confirmed (a
  // password reset in between keeps the secret but raises the version), the code spent and the codes replaced
  // in one transaction.
  const outcome = await readingSecret(() => db.$transaction(async (tx): Promise<"replaced" | "wrong_code" | "changed"> => {
    const [row] = await tx.$queryRaw<{ active: boolean; credential_version: number; totp_secret_enc: string | null; totp_last_step: bigint | null }[]>`
      SELECT "active", "credential_version", "totp_secret_enc", "totp_last_step" FROM "owner_account" WHERE "id" = ${account.id} FOR UPDATE`;
    if (!row?.active || row.credential_version !== account.credentialVersion || !row.totp_secret_enc) return "changed";
    const current = { id: account.id, totpSecretEnc: row.totp_secret_enc, totpLastStep: row.totp_last_step };
    if (!(await spendTotp(current, body.code, key, now, tx))) return "wrong_code";
    await replaceRecoveryCodes(tx, account.id, recoveryCodes, key, now);
    return "replaced";
  }));
  if (outcome === "not_configured") return fail(outcome);
  if (outcome === "changed") return fail("not_enabled");
  if (outcome === "wrong_code") {
    await loginGuard().failed(account.email);
    return fail("invalid_code");
  }
  return { ok: true as const, recoveryCodes };
}
