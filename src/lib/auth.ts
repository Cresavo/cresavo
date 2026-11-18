import { isPublicReadonly, assertWritable } from "./public-readonly";
import { db } from "./db";
import { safeFailure } from "./errors";
import { DEMO_BUSINESS_ID } from "./config";
import type { AdminIdentity } from "./admin-accounts";
import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  createHash,
} from "node:crypto";
import { cookies, headers } from "next/headers";
import { demoAccessEnabled, DEMO_ADMIN_EMAIL } from "./demo-access";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET must be at least 32 characters");
  return s;
}

function sign(s: string) {
  return createHmac("sha256", secret())
    .update(`${process.env.ADMIN_SESSION_VERSION ?? "1"}:${s}`)
    .digest("hex");
}

function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function login(identity: AdminIdentity) {
  assertWritable();
  const expiry = String(Date.now() + 8 * 3600_000);
  const token = randomBytes(32).toString("hex");
  const value = `${token}.${expiry}`;
  const signed = `${value}.${sign(value)}`;
  await pruneSessions();
  const created = await db.$transaction(async (tx) => {
    const accounts = await tx.$queryRaw<
      Array<{
        active: boolean;
        businessId: string;
        credentialVersion: number;
        email: string;
      }>
    >`SELECT "active", "businessId", "credentialVersion", "email" FROM "AdminUser" WHERE "id" = ${identity.id} FOR UPDATE`;
    const account = accounts[0];
    if (
      !account?.active ||
      account.businessId !== DEMO_BUSINESS_ID ||
      account.credentialVersion !== identity.credentialVersion ||
      (account.email === DEMO_ADMIN_EMAIL && !demoAccessEnabled())
    )
      return false;
    await tx.adminSession.create({
      data: {
        id: sessionId(token),
        userId: identity.id,
        expiresAt: new Date(Number(expiry)),
      },
    });
    return true;
  });
  if (!created) return false;
  (await cookies()).set("booking_admin", signed, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
  return true;
}

export async function pruneSessions(now = new Date()) {
  assertWritable();
  const obsolete = {
    OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }],
  };
  const rows = await db.adminSession.findMany({
    where: obsolete,
    select: { id: true },
    orderBy: { id: "asc" },
    take: 100,
  });
  if (rows.length)
    await db.adminSession.deleteMany({
      where: { ...obsolete, id: { in: rows.map((row) => row.id) } },
    });
}

function sessionId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
async function currentSessionId() {
  const value = (await cookies()).get("booking_admin")?.value;
  if (!value || !/^[a-f0-9]{64}\.\d{13}\.[a-f0-9]{64}$/.test(value))
    return null;
  const [token, expiry, signature] = value.split(".");
  if (
    Number(expiry) <= Date.now() ||
    Number(expiry) > Date.now() + 8 * 3600_000 ||
    !equal(sign(`${token}.${expiry}`), signature)
  )
    return null;
  return sessionId(token);
}
export async function getAdminContext() {
  if (isPublicReadonly()) return null;
  const id = await currentSessionId();
  if (!id) return null;
  try {
    const session = await db.adminSession.findFirst({
      where: {
        id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { is: { active: true, businessId: DEMO_BUSINESS_ID } },
      },
      select: { user: { select: { id: true, email: true } } },
    });
    if (session?.user?.email === DEMO_ADMIN_EMAIL && !demoAccessEnabled())
      return null;
    return session?.user ?? null;
  } catch (error) {
    safeFailure(error);
    return null; // Fail closed without exposing database errors through SSR or auth guards.
  }
}

export async function isAdmin() {
  return !!(await getAdminContext());
}

export async function logout() {
  assertWritable();
  const id = await currentSessionId();
  if (id)
    await db.adminSession.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  (await cookies()).set("booking_admin", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function sameOrigin() {
  const h = await headers();
  const origin = h.get("origin"),
    host = h.get("host");
  try {
    return !!origin && new URL(origin).host === host;
  } catch {
    return false;
  }
}
