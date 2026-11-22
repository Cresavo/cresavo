import { NextResponse, type NextRequest } from "next/server";
import { failure } from "./http";
import { ownerAccountsEnabled } from "./owner-accounts";
import { OWNER_COOKIE, OWNER_HINT_COOKIE, renewedOwnerCookie, type OwnerCookie } from "./owner-session";
import { isPublicReadonly, readonlyForbidden } from "./public-readonly";
import { isSameOriginWrite } from "./same-origin";

// Shared plumbing for /api/owner/*. Error bodies carry a code only; the studio
// turns codes into text through its dictionary.

const noStore = { "Cache-Control": "no-store" };

export const ownerError = (code: string, status: number) => NextResponse.json({ error: code }, { status, headers: noStore });
export const ownerOk = (body: Record<string, unknown> = { ok: true }) => NextResponse.json(body, { headers: noStore });

/** Runs a handler only when owner accounts are on, the deployment is writable and, for writes, the request is same-origin. */
export async function ownerRoute(request: NextRequest, handler: () => Promise<NextResponse>, { write = true } = {}) {
  if (isPublicReadonly()) return readonlyForbidden();
  if (!ownerAccountsEnabled()) return ownerError("not_found", 404);
  if (write && !isSameOriginWrite((name) => request.headers.get(name))) return ownerError("forbidden_origin", 403);
  try {
    return await handler();
  } catch (error) {
    return failure(error);
  }
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export { readBoundedJson } from "./bounded-json";

const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" };

// The hint holds no secret: it only tells the studio to ask the server for an account salon.
const hintOptions = { ...cookieOptions, httpOnly: false };

/** Sets the session cookies; they last until the cookie's idle deadline. */
export function withSession(response: NextResponse, cookie: OwnerCookie, now = Date.now()) {
  const maxAge = Math.max(0, Math.floor((cookie.expires.getTime() - now) / 1000));
  response.cookies.set(OWNER_COOKIE, cookie.value, { ...cookieOptions, maxAge });
  response.cookies.set(OWNER_HINT_COOKIE, "1", { ...hintOptions, maxAge });
  return response;
}

/** Keeps an active owner signed in: moves the idle deadline forward once more than half of it has passed. */
export function withRenewedSession(response: NextResponse, request: NextRequest) {
  const renewed = renewedOwnerCookie(request.cookies.get(OWNER_COOKIE)?.value);
  return renewed ? withSession(response, renewed) : response;
}

export function withoutSession(response: NextResponse) {
  response.cookies.set(OWNER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(OWNER_HINT_COOKIE, "", { ...hintOptions, maxAge: 0 });
  return response;
}
