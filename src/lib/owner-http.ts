import { NextResponse, type NextRequest } from "next/server";
import { failure } from "./http";
import { ownerAccountsEnabled } from "./owner-accounts";
import { OWNER_COOKIE, OWNER_HINT_COOKIE, OWNER_SESSION_MS } from "./owner-session";
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

/** The request's JSON, read with a byte cap while it streams: "too_large" past `maxBytes`, null when it is not JSON. */
export async function readBoundedJson(request: NextRequest, maxBytes: number): Promise<unknown | "too_large"> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return "too_large";
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return "too_large";
    }
    chunks.push(part.value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" };

// The hint holds no secret: it only tells the studio to ask the server for an account salon.
const hintOptions = { ...cookieOptions, httpOnly: false };

export function withSession(response: NextResponse, value: string) {
  response.cookies.set(OWNER_COOKIE, value, { ...cookieOptions, maxAge: OWNER_SESSION_MS / 1000 });
  response.cookies.set(OWNER_HINT_COOKIE, "1", { ...hintOptions, maxAge: OWNER_SESSION_MS / 1000 });
  return response;
}

export function withoutSession(response: NextResponse) {
  response.cookies.set(OWNER_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(OWNER_HINT_COOKIE, "", { ...hintOptions, maxAge: 0 });
  return response;
}
