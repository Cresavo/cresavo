import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { OwnerIdentity } from "./owner-accounts";
import { assertWritable } from "./public-readonly";

// Owner sessions. The cookie holds a random token, two deadlines and an HMAC
// over all three; the database stores only the token's SHA-256 with the
// account's credential version, so a password reset or disable ends every
// session.
//
// Two timeouts. The idle deadline is the cookie's own expiry: it moves forward
// when the owner uses the studio and the signature stops a client from moving
// it. The absolute deadline is fixed at sign-in, also stored on the session row,
// and no activity extends it.

export const OWNER_COOKIE = "cresavo_owner";
export { OWNER_HINT_COOKIE } from "@/concept/account/hint";
/** Longest a session lives, whatever the owner does. */
export const OWNER_SESSION_MS = 14 * 24 * 3600_000;
/** A session unused for this long ends. */
export const OWNER_IDLE_MS = 12 * 3600_000;
const COOKIE_PATTERN = /^[a-f0-9]{64}\.\d{13}\.\d{13}\.[a-f0-9]{64}$/;

function sign(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(`owner-session:v1:${value}`).digest("hex");
}

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

function equal(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export interface OwnerCookie {
  /** The cookie value. */
  value: string;
  /** When the cookie stops working unless the owner is active before then. */
  expires: Date;
}

const cookieValue = (token: string, idle: number, absolute: number): OwnerCookie => {
  const body = `${token}.${idle}.${absolute}`;
  return { value: `${body}.${sign(body)}`, expires: new Date(idle) };
};

/** The parts of a cookie value, or null when it is malformed, past either deadline or not signed by this server. */
function parseCookie(cookie: string | undefined, now: number) {
  if (!cookie || !COOKIE_PATTERN.test(cookie)) return null;
  const [token, idleText, absoluteText, signature] = cookie.split(".");
  const idle = Number(idleText), absolute = Number(absoluteText);
  if (idle <= now || absolute <= now || idle > absolute || idle > now + OWNER_IDLE_MS || absolute > now + OWNER_SESSION_MS) return null;
  if (!equal(sign(`${token}.${idleText}.${absoluteText}`), signature)) return null;
  return { token, idle, absolute };
}

const sessionIdOf = (cookie: string | undefined, now: number) => {
  const parsed = parseCookie(cookie, now);
  return parsed ? digest(parsed.token) : null;
};

/**
 * A cookie with the idle deadline moved forward, for a request that just proved the session is live. Null when
 * the cookie is invalid or has more than half its idle time left, so most requests set no cookie.
 */
export function renewedOwnerCookie(cookie: string | undefined, now = Date.now()): OwnerCookie | null {
  const parsed = parseCookie(cookie, now);
  if (!parsed || parsed.idle - now > OWNER_IDLE_MS / 2) return null;
  return cookieValue(parsed.token, Math.min(now + OWNER_IDLE_MS, parsed.absolute), parsed.absolute);
}

/**
 * Writes a session row inside the caller's transaction, which has already locked and checked the account.
 * `mfaVerified` records that the sign-in passed the second step. Returns the cookie for it.
 */
export async function insertOwnerSession(tx: Prisma.TransactionClient, identity: OwnerIdentity, now: number, mfaVerified: boolean): Promise<OwnerCookie> {
  const token = randomBytes(32).toString("hex");
  const absolute = now + OWNER_SESSION_MS;
  await tx.ownerSession.create({
    data: {
      id: digest(token), accountId: identity.id, credentialVersion: identity.credentialVersion, expiresAt: new Date(absolute),
      mfaVerifiedAt: mfaVerified ? new Date(now) : null,
    },
  });
  return cookieValue(token, now + OWNER_IDLE_MS, absolute);
}

/**
 * Starts a session for a verified identity. Returns the cookie, or null when the account changed since it was
 * verified, or when it has two-step sign-in and `mfaVerified` is not set. The second step at sign-in opens its
 * session inside its own transaction instead (owner-mfa.ts).
 */
export async function openOwnerSession(identity: OwnerIdentity, now = Date.now(), { mfaVerified = false } = {}): Promise<OwnerCookie | null> {
  assertWritable();
  await pruneOwnerSessions(new Date(now));
  return db.$transaction(async (tx) => {
    const [account] = await tx.$queryRaw<{ active: boolean; credential_version: number; totp_enabled_at: Date | null }[]>`
      SELECT "active", "credential_version", "totp_enabled_at" FROM "owner_account" WHERE "id" = ${identity.id} FOR UPDATE`;
    if (!account?.active || account.credential_version !== identity.credentialVersion) return null;
    if (account.totp_enabled_at && !mfaVerified) return null;
    return insertOwnerSession(tx, identity, now, mfaVerified);
  });
}

export interface OwnerContext {
  accountId: string;
  email: string;
  tenantId: string;
  /** Two-step sign-in is on for the account. */
  mfaEnabled: boolean;
  /** Raised by a password reset, a change to two-step sign-in and "sign out everywhere". */
  credentialVersion: number;
}

/** The signed-in owner for a cookie value; null for anything else. */
export async function ownerFromCookie(cookie: string | undefined, now = Date.now()): Promise<OwnerContext | null> {
  const id = sessionIdOf(cookie, now);
  if (!id) return null;
  const session = await db.ownerSession.findFirst({
    where: { id, revokedAt: null, expiresAt: { gt: new Date(now) }, account: { is: { active: true } } },
    select: {
      credentialVersion: true, mfaVerifiedAt: true,
      account: { select: { id: true, email: true, tenantId: true, credentialVersion: true, totpEnabledAt: true } },
    },
  });
  if (!session || session.credentialVersion !== session.account.credentialVersion) return null;
  // A session that did not pass the second step never counts for an account with two-step sign-in on.
  if (session.account.totpEnabledAt && !session.mfaVerifiedAt) return null;
  const { account } = session;
  return { accountId: account.id, email: account.email, tenantId: account.tenantId, mfaEnabled: account.totpEnabledAt !== null, credentialVersion: account.credentialVersion };
}

export async function closeOwnerSession(cookie: string | undefined, now = Date.now()) {
  assertWritable();
  const id = sessionIdOf(cookie, now);
  if (id) await db.ownerSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(now) } });
}

/**
 * Ends every session and every pending sign-in of an account, in one transaction. Returns how many sessions were
 * still open. Callers that change the credentials raise the version themselves.
 */
export async function closeAllOwnerSessions(accountId: string, now = Date.now()) {
  assertWritable();
  return db.$transaction(async (tx) => {
    await tx.ownerMfaChallenge.deleteMany({ where: { accountId } });
    const { count } = await tx.ownerSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date(now) } });
    return count;
  });
}

/**
 * "Sign out everywhere": raises the credential version and ends every session and pending sign-in in one
 * transaction, so a password check already under way cannot leave a session or a usable challenge behind.
 */
export async function signOutEverywhere(accountId: string, now = Date.now()) {
  assertWritable();
  return db.$transaction(async (tx) => {
    await tx.ownerAccount.update({ where: { id: accountId }, data: { credentialVersion: { increment: 1 } } });
    await tx.ownerMfaChallenge.deleteMany({ where: { accountId } });
    const { count } = await tx.ownerSession.updateMany({ where: { accountId, revokedAt: null }, data: { revokedAt: new Date(now) } });
    return count;
  });
}

/** Deletes up to 100 expired or revoked sessions. */
export async function pruneOwnerSessions(now = new Date()) {
  assertWritable();
  const obsolete = { OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] };
  const rows = await db.ownerSession.findMany({ where: obsolete, select: { id: true }, orderBy: { id: "asc" }, take: 100 });
  if (rows.length) await db.ownerSession.deleteMany({ where: { ...obsolete, id: { in: rows.map((row) => row.id) } } });
}
