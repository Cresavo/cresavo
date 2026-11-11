import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
function secret() { const s = process.env.SESSION_SECRET; if (!s || s.length < 32) throw new Error("SESSION_SECRET måste vara minst 32 tecken"); return s; }
function sign(s: string) { return createHmac("sha256", secret()).update(s).digest("hex"); }
function equal(a: string, b: string) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export function checkPassword(password: string) { const expected = process.env.ADMIN_PASSWORD; if (!expected || expected.length < 12) throw new Error("ADMIN_PASSWORD måste vara minst 12 tecken"); return equal(password, expected); }
export async function login() { const expiry = String(Date.now() + 8 * 3600_000); (await cookies()).set("booking_admin", `${expiry}.${sign(expiry)}`, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 8 * 3600 }); }
export async function isAdmin() { const value = (await cookies()).get("booking_admin")?.value; if (!value) return false; const [expiry, signature] = value.split("."); return !!expiry && !!signature && /^\d+$/.test(expiry) && Number(expiry) > Date.now() && equal(sign(expiry), signature); }
export async function sameOrigin() { const h = await headers(); const origin = h.get("origin"), host = h.get("host"); try { return !!origin && new URL(origin).host === host; } catch { return false; } }
