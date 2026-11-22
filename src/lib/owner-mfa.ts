import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import type { OwnerIdentity } from "./owner-accounts";
import { loginGuard } from "./owner-guard-store";
import { decryptSecret, hashRecoveryCode, mfaKey, MfaSecretUnreadable, normalizeRecoveryCode, sameHash } from "./owner-mfa-crypto";
import { MFA_PENDING_MS, parsePending, signPending } from "./owner-mfa-pending";
import { matchTotp, normalizeTotp } from "./owner-totp";
import { assertWritable } from "./public-readonly";

// Two-step sign-in for owner accounts: the second step at sign-in, and the checks the setup routes share
// (owner-mfa-setup.ts). Wrong codes count toward the same per-address lock-out as wrong passwords
// (owner-guard-store.ts), and only a correct second step clears it. Every code works once: an authenticator
// code moves `totp_last_step` forward with a conditional update, a recovery code sets `used_at` the same way,
// so of two simultaneous uses exactly one succeeds. A code is only judged once the stored secret decrypts with
// the configured key: a key that does not fit answers `not_configured` and never counts as a wrong code.

/** OWNER_MFA_REQUIRED=1: an account without two-step sign-in may only set it up. Off by default. */
export const mfaRequired = () => process.env.OWNER_MFA_REQUIRED === "1";

/** True for a session that may only reach the enrolment routes. Derived from the account on every request. */
export const enrolmentOnly = (owner: { mfaEnabled: boolean }) => mfaRequired() && !owner.mfaEnabled;

export const totpFactor = z.object({ code: z.string().max(20) }).strict();
export const recoveryFactor = z.object({ recoveryCode: z.string().max(40) }).strict();
const factorSchema = z.union([totpFactor, recoveryFactor]);
export type SecondFactor = z.infer<typeof factorSchema>;

type Client = Prisma.TransactionClient | typeof db;
interface SecretRow { id: string; totpSecretEnc: string | null; totpLastStep: bigint | null }

/** Uses an authenticator code once. Throws MfaSecretUnreadable when the stored secret does not decrypt. */
export async function spendTotp(account: SecretRow, input: string, key: Buffer, now: number, client: Client = db): Promise<boolean> {
  if (!account.totpSecretEnc) return false;
  const secret = decryptSecret(account.totpSecretEnc, account.id, key);
  const code = normalizeTotp(input);
  const step = code ? matchTotp(secret, code, now, account.totpLastStep === null ? null : Number(account.totpLastStep)) : null;
  if (step === null) return false;
  // Conditional on the secret and on no later step having been used since it was read: the first use wins.
  const { count } = await client.ownerAccount.updateMany({
    where: { id: account.id, totpSecretEnc: account.totpSecretEnc, OR: [{ totpLastStep: null }, { totpLastStep: { lt: BigInt(step) } }] },
    data: { totpLastStep: BigInt(step) },
  });
  return count === 1;
}

/**
 * Uses a recovery code once. The stored secret is decrypted first, so a key that does not fit throws
 * MfaSecretUnreadable instead of judging the code. The stored hashes are compared in constant time.
 */
export async function spendRecoveryCode(account: SecretRow, input: string, key: Buffer, now: number, client: Client = db): Promise<boolean> {
  if (!account.totpSecretEnc) return false;
  decryptSecret(account.totpSecretEnc, account.id, key);
  const code = normalizeRecoveryCode(input);
  if (!code) return false;
  const hash = hashRecoveryCode(code, account.id, key);
  const rows = await client.ownerRecoveryCode.findMany({ where: { accountId: account.id, usedAt: null }, select: { id: true, codeHash: true } });
  let match: string | null = null;
  for (const row of rows) if (sameHash(row.codeHash, hash) && match === null) match = row.id;
  if (!match) return false;
  const { count } = await client.ownerRecoveryCode.updateMany({ where: { id: match, accountId: account.id, usedAt: null }, data: { usedAt: new Date(now) } });
  return count === 1;
}

export const spendFactor = (account: SecretRow, factor: SecondFactor, key: Buffer, now: number, client: Client = db) =>
  "code" in factor ? spendTotp(account, factor.code, key, now, client) : spendRecoveryCode(account, factor.recoveryCode, key, now, client);

/** Replaces an account's recovery codes with these, inside the caller's transaction. */
export async function replaceRecoveryCodes(tx: Prisma.TransactionClient, accountId: string, codes: string[], key: Buffer, now: number) {
  await tx.ownerRecoveryCode.deleteMany({ where: { accountId } });
  await tx.ownerRecoveryCode.createMany({
    data: codes.map((code) => ({ accountId, codeHash: hashRecoveryCode(code, accountId, key), createdAt: new Date(now) })),
  });
}

/** Runs a check that reads a stored secret; a secret the configured key cannot read answers `not_configured`. */
export async function readingSecret<T>(work: () => Promise<T>): Promise<T | "not_configured"> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof MfaSecretUnreadable)) throw error;
    console.warn("[owner-mfa] a stored two-step secret could not be read with OWNER_MFA_KEY");
    return "not_configured";
  }
}

/** Records a correct password that still needs the second step; returns the pending cookie's value. */
export async function startSecondStep(identity: OwnerIdentity, now = Date.now()) {
  assertWritable();
  const pending = signPending({ accountId: identity.id, credentialVersion: identity.credentialVersion }, now);
  await db.ownerMfaChallenge.deleteMany({ where: { expiresAt: { lte: new Date(now) } } });
  await db.ownerMfaChallenge.create({
    data: { id: pending.challenge, accountId: identity.id, credentialVersion: identity.credentialVersion, expiresAt: new Date(now + MFA_PENDING_MS) },
  });
  return pending.value;
}

export type SecondStepResult =
  | { ok: true; identity: OwnerIdentity; challenge: string }
  | { ok: false; reason: "expired" | "invalid_code" | "not_configured" };

/**
 * The second step of a sign-in: the pending cookie from a correct password, then a code. A missing key answers
 * `not_configured` and never lets the step be skipped. A deactivated account, a locked address, a wrong or used
 * code all answer `invalid_code`; a pending cookie that is missing, expired, forged, already used, signed out
 * or older than the account's credential version answers `expired`, and the owner starts again with the
 * password. The session is opened by the caller, which consumes the challenge in the same transaction.
 */
export async function completeSecondStep(pendingCookie: string | undefined, input: unknown, now = Date.now()): Promise<SecondStepResult> {
  assertWritable();
  const pending = parsePending(pendingCookie, now);
  if (!pending) return { ok: false, reason: "expired" };
  const key = mfaKey();
  if (!key) return { ok: false, reason: "not_configured" };
  const account = await db.ownerAccount.findUnique({
    where: { id: pending.accountId },
    select: { id: true, email: true, active: true, credentialVersion: true, totpSecretEnc: true, totpLastStep: true },
  });
  if (!account) return { ok: false, reason: "expired" };
  // Before the version check: deactivation also raises the version, and must look like any refusal.
  if (!account.active) return { ok: false, reason: "invalid_code" };
  if (account.credentialVersion !== pending.credentialVersion || !account.totpSecretEnc) return { ok: false, reason: "expired" };
  const open = await db.ownerMfaChallenge.count({
    where: { id: pending.challenge, accountId: account.id, credentialVersion: account.credentialVersion, expiresAt: { gt: new Date(now) } },
  });
  if (!open) return { ok: false, reason: "expired" };
  const guard = loginGuard();
  if (await guard.locked(account.email)) return { ok: false, reason: "invalid_code" };
  const factor = factorSchema.safeParse(input);
  const used = factor.success ? await readingSecret(() => spendFactor(account, factor.data, key, now)) : false;
  if (used === "not_configured") return { ok: false, reason: "not_configured" };
  if (!used) {
    await guard.failed(account.email);
    return { ok: false, reason: "invalid_code" };
  }
  // Checks the lock and clears the failures in one step, like a correct password without two-step sign-in.
  if (!(await guard.succeeded(account.email))) return { ok: false, reason: "invalid_code" };
  return { ok: true, identity: { id: account.id, credentialVersion: account.credentialVersion }, challenge: pending.challenge };
}
