import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import type { OwnerIdentity } from "./owner-accounts";
import { assertWritable } from "./public-readonly";

// Owner sessions. The cookie holds a random token, its expiry and an HMAC over
// both; the database stores only the token's SHA-256 with the account's
// credential version, so a password reset or disable ends every session.

export const OWNER_COOKIE = "cresavo_owner";
export const OWNER_SESSION_MS = 30 * 24 * 3600_000;
const COOKIE_PATTERN = /^[a-f0-9]{64}\.\d{13}\.[a-f0-9]{64}$/;

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

/** The session id in a cookie value, or null when it is malformed, expired or not signed by this server. */
function sessionIdOf(cookie: string | undefined, now: number): string | null {
  if (!cookie || !COOKIE_PATTERN.test(cookie)) return null;
  const [token, expiry, signature] = cookie.split(".");
  const expires = Number(expiry);
  if (expires <= now || expires > now + OWNER_SESSION_MS || !equal(sign(`${token}.${expiry}`), signature)) return null;
  return digest(token);
}

/** Starts a session for a verified identity. Returns the cookie value, or null when the account changed since it was verified. */
export async function openOwnerSession(identity: OwnerIdentity, now = Date.now()): Promise<{ value: string; expires: Date } | null> {
  assertWritable();
  const token = randomBytes(32).toString("hex");
  const expires = new Date(now + OWNER_SESSION_MS);
  const value = `${token}.${expires.getTime()}`;
  await pruneOwnerSessions(new Date(now));
  const created = await db.$transaction(async (tx) => {
    const [account] = await tx.$queryRaw<{ active: boolean; credential_version: number }[]>`
      SELECT "active", "credential_version" FROM "owner_account" WHERE "id" = ${identity.id} FOR UPDATE`;
    if (!account?.active || account.credential_version !== identity.credentialVersion) return false;
    await tx.ownerSession.create({
      data: { id: digest(token), accountId: identity.id, credentialVersion: identity.credentialVersion, expiresAt: expires },
    });
    return true;
  });
  return created ? { value: `${value}.${sign(value)}`, expires } : null;
}

export interface OwnerContext {
  accountId: string;
  email: string;
  tenantId: string;
}

/** The signed-in owner for a cookie value; null for anything else. */
export async function ownerFromCookie(cookie: string | undefined, now = Date.now()): Promise<OwnerContext | null> {
  const id = sessionIdOf(cookie, now);
  if (!id) return null;
  const session = await db.ownerSession.findFirst({
    where: { id, revokedAt: null, expiresAt: { gt: new Date(now) }, account: { is: { active: true } } },
    select: { credentialVersion: true, account: { select: { id: true, email: true, tenantId: true, credentialVersion: true } } },
  });
  if (!session || session.credentialVersion !== session.account.credentialVersion) return null;
  return { accountId: session.account.id, email: session.account.email, tenantId: session.account.tenantId };
}

export async function closeOwnerSession(cookie: string | undefined, now = Date.now()) {
  assertWritable();
  const id = sessionIdOf(cookie, now);
  if (id) await db.ownerSession.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(now) } });
}

/** Deletes up to 100 expired or revoked sessions. */
export async function pruneOwnerSessions(now = new Date()) {
  assertWritable();
  const obsolete = { OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }] };
  const rows = await db.ownerSession.findMany({ where: obsolete, select: { id: true }, orderBy: { id: "asc" }, take: 100 });
  if (rows.length) await db.ownerSession.deleteMany({ where: { ...obsolete, id: { in: rows.map((row) => row.id) } } });
}
