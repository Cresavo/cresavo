import type { NextResponse } from "next/server";
import type { Locale } from "./locale";

export const LOCALE_COOKIE = "booking-locale";
export const DEMO_VISITOR_COOKIE = "demo-booking-language";

function cookieOptions() {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
}

export function setLocaleCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(LOCALE_COOKIE, locale, { ...cookieOptions(), path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export function setDemoVisitorCookie(response: NextResponse, locale: Locale) {
  response.cookies.set(DEMO_VISITOR_COOKIE, locale, { ...cookieOptions(), path: "/boka/salong-eko" });
}
