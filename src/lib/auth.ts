import { db } from "./db";
import { safeFailure } from "./errors";
import {
  createHmac,
  timingSafeEqual,
  randomBytes,
  createHash,
} from "node:crypto";
import { cookies, headers } from "next/headers";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET måste vara minst 32 tecken");
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

export function checkPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length < 12)
    throw new Error("ADMIN_PASSWORD måste vara minst 12 tecken");
  return password.length <= 1024 && equal(password, expected);
}

export async function login() {
  await pruneSessions();
  const expiry = String(Date.now() + 8 * 3600_000);
  const token = randomBytes(32).toString("hex");
  await db.adminSession.create({
    data: { id: sessionId(token), expiresAt: new Date(Number(expiry)) },
  });
  const value = `${token}.${expiry}`;
  (await cookies()).set("booking_admin", `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 3600,
  });
}

export async function pruneSessions(now = new Date()) {
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
export async function isAdmin() {
  const id = await currentSessionId();
  if (!id) return false;
  try {
    return !!(await db.adminSession.findFirst({
      where: { id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    }));
  } catch (error) {
    safeFailure(error);
    return false; // Fail closed without exposing database errors through SSR or auth guards.
  }
}

export async function logout() {
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
