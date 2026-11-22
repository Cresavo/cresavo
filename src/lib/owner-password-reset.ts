import { createHmac, timingSafeEqual } from "node:crypto";
import { loginGuard, mailboxQuota } from "./owner-guard-store";
import { z } from "zod";
import { BRAND } from "@/concept/brand";
import { translate } from "@/concept/i18n";
import { createRegistry, type ResolutionReason } from "@/concept/connections/server/registry";
import type { EmailPort } from "@/concept/connections/ports/email";
import { productDomain } from "@/concept/page/address";
import { db } from "./db";
import { ownerEmailSchema } from "./owner-accounts";
import { hashPassword, newPasswordSchema } from "./password";
import { closeAllOwnerSessions } from "./owner-session";
import { assertWritable } from "./public-readonly";
import type { Locale } from "./locale";

// Password reset for owner accounts, without a table.
//
// The reset token is a signed value, never stored: `<account>.<expiry>.<version>.<hmac>`. The HMAC key is the
// server secret and its input includes the account's current password hash, so the token only checks out while
// the password is the one it was issued for. A reset bumps `credential_version`, and the update that sets the new
// password is conditional on the version in the token, so one token works once, even when two requests race, and
// a token issued earlier stops working too. Nothing readable is kept: the database holds no token, only the
// password hash and the version the token is checked against. The token expires after 30 minutes.

export const RESET_TTL_MS = 30 * 60_000;
const TOKEN_PATTERN = /^[a-z0-9]{20,32}\.\d{13}\.\d{1,9}\.[a-f0-9]{64}$/;

const requestSchema = z.object({ email: ownerEmailSchema }).strict();
export const resetSchema = z.object({ token: z.string().max(200), password: newPasswordSchema }).strict();

function sign(accountId: string, expires: number, version: number, passwordHash: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(`owner-reset:v1:${accountId}.${expires}.${version}.${passwordHash}`).digest("hex");
}

const mintToken = (account: { id: string; credentialVersion: number; passwordHash: string }, now: number) => {
  const expires = now + RESET_TTL_MS;
  return `${account.id}.${expires}.${account.credentialVersion}.${sign(account.id, expires, account.credentialVersion, account.passwordHash)}`;
};

const sameSignature = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** The e-mail connection: a real send only when the live flags and a provider are set, simulated otherwise. */
export type ResetRegistry = { resolve: (port: "email", business: string) => Promise<{ adapter: EmailPort; live: boolean; reason: ResolutionReason }> };
let defaultRegistry: ResetRegistry | undefined;

/**
 * Providers that can switch link tracking off for one message. The reset link is a bearer secret, so it must not
 * go through a tracking redirect. Resend tracks per sending domain: set OWNER_RESET_TRACKING_OFF=1 once the
 * sending domain is verified with click tracking disabled, to allow it.
 */
const trackingOff = (provider: string) => provider === "postmark" || process.env.OWNER_RESET_TRACKING_OFF === "1";

const resetPage = (token: string) => `https://${productDomain()}/account/reset#t=${token}`;

function resetEmail(language: Locale, link: string | undefined) {
  const say = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(language, key, vars);
  const minutes = RESET_TTL_MS / 60_000;
  const subject = say("account.reset.mail.subject", { brand: BRAND.name });
  const lines = [say("account.reset.mail.intro"), "", ...(link ? [say("account.reset.mail.link", { minutes }), link, ""] : []), say("account.reset.mail.ignore")];
  const text = lines.join("\n");
  const html = `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${subject}</title></head>`
    + `<body style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:36rem;margin:0 auto;padding:16px">`
    + `<p>${say("account.reset.mail.intro")}</p>`
    + (link ? `<p>${say("account.reset.mail.link", { minutes })}</p><p><a href="${link}">${link}</a></p>` : "")
    + `<p>${say("account.reset.mail.ignore")}</p></body></html>`;
  return { subject, text, html };
}

/**
 * Sends the reset e-mail when an active account has this address; does nothing otherwise, and never says which.
 * Simulated unless the e-mail connection is live: a simulated message names the account by reference and carries
 * no link, so nothing that opens a reset is ever recorded. Failures are logged without detail and swallowed, so
 * the caller's answer is the same either way. The mailbox quota (3 per 15 minutes, in a store of its own with
 * its own small cap) is spent only when a mail was actually sent: discarded requests, blocked sends and failed
 * sends spend nothing. Over the quota the request is dropped silently, with the same answer.
 */
export async function requestPasswordReset(input: unknown, registry: ResetRegistry = (defaultRegistry ??= createRegistry()), now = Date.now()) {
  assertWritable();
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return;
  const account = await db.ownerAccount.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, tenantId: true, active: true, credentialVersion: true, passwordHash: true },
  });
  if (!account?.active) return;
  const quota = mailboxQuota();
  if (!(await quota.available(account.email))) return;
  try {
    const tenant = await db.tenantState.findUnique({ where: { tenantId: account.tenantId }, select: { doc: true } });
    const language = (tenant?.doc as { localization?: { language?: unknown } } | null)?.localization?.language === "sv" ? "sv" : "en";
    const resolution = await registry.resolve("email", account.tenantId);
    if (resolution.live && !trackingOff(resolution.adapter.info.provider)) {
      console.warn(`[owner-password-reset] the e-mail was not sent: provider "${resolution.adapter.info.provider}" cannot turn link tracking off per message`);
      return;
    }
    const mail = resetEmail(language, resolution.live ? resetPage(mintToken(account, now)) : undefined);
    const result = await resolution.adapter.send({
      // A simulated send keeps a reference to the account, not the address.
      to: [resolution.live ? account.email : `owner:${account.id}`],
      from: `"${BRAND.name}" <accounts@${productDomain()}>`,
      ...mail, language, idempotencyKey: `owner-reset:${account.id}:${now}`, tracking: false,
    });
    if (result.ok) await quota.spend(account.email);
    else console.warn(`[owner-password-reset] the e-mail was not sent: ${result.error.code}`);
  } catch {
    console.warn("[owner-password-reset] the e-mail was not sent");
  }
}

export type ResetResult = { ok: true } | { ok: false; reason: "invalid" | "invalid_token" };

/**
 * Sets a new password from a reset token, ends every session of the account and lifts a lock.
 * One answer for a malformed, forged, expired, used or superseded token.
 */
export async function resetPassword(input: unknown, now = Date.now()): Promise<ResetResult> {
  assertWritable();
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const { token, password } = parsed.data;
  if (!TOKEN_PATTERN.test(token)) return { ok: false, reason: "invalid_token" };
  const [id, expiry, versionText, signature] = token.split(".");
  const expires = Number(expiry), version = Number(versionText);
  const account = await db.ownerAccount.findUnique({ where: { id }, select: { email: true, active: true, credentialVersion: true, passwordHash: true } });
  // The token is checked before any password is hashed: a bad token costs a lookup, not a password hash.
  if (!account?.active || expires <= now || expires > now + RESET_TTL_MS || account.credentialVersion !== version
    || !sameSignature(sign(id, expires, version, account.passwordHash), signature)) return { ok: false, reason: "invalid_token" };
  const passwordHash = await hashPassword(password);
  // Conditional on the version the token was issued for: the first request wins, a concurrent one updates nothing.
  const updated = await db.ownerAccount.updateMany({
    where: { id, active: true, credentialVersion: version },
    data: { passwordHash, credentialVersion: { increment: 1 } },
  });
  if (updated.count !== 1) return { ok: false, reason: "invalid_token" };
  await closeAllOwnerSessions(id, now);
  await loginGuard().lift(account.email);
  return { ok: true };
}
