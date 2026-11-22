import { NextResponse } from "next/server";
import { safeFailure } from "./errors";
import { publicBookingLive } from "./public-booking";
import { isPublicReadonly, readonlyForbidden } from "./public-readonly";

// Shared plumbing for /api/public/*. Error bodies carry a code only, and a
// response is never cached.

const noStore = { "Cache-Control": "no-store" };

export const publicError = (code: string, status: number) => NextResponse.json({ error: code }, { status, headers: noStore });
export const publicOk = (body: Record<string, unknown>) => NextResponse.json(body, { headers: noStore });

/** Runs a handler only when public booking is switched on and the deployment is writable. */
export async function publicRoute(handler: () => Promise<NextResponse>) {
  if (isPublicReadonly()) return readonlyForbidden();
  if (!publicBookingLive()) return publicError("not_found", 404);
  try {
    return await handler();
  } catch (error) {
    const { status, retryAfter } = safeFailure(error);
    const response = publicError(status === 429 ? "rate_limited" : "unavailable", status);
    if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
}
