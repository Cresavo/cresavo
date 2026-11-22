import { NextResponse } from "next/server";
import { safeFailure } from "./errors";
import { publicBookingLive, publicReadonly } from "./public-booking";
import { readonlyForbidden } from "./public-readonly";

// Shared plumbing for /api/public/*. Error bodies carry a code only, and a
// response is never cached.

const noStore = { "Cache-Control": "no-store" };

export const publicError = (code: string, status: number) => NextResponse.json({ error: code }, { status, headers: noStore });
export const publicOk = (body: Record<string, unknown>) => NextResponse.json(body, { headers: noStore });

/**
 * Runs a handler only when public booking is live for this request: switched
 * on, the deployment writable, and not the demo build or the demo's host.
 */
export async function publicRoute(request: Request, handler: () => Promise<NextResponse>) {
  if (publicReadonly()) return readonlyForbidden();
  if (!publicBookingLive((name) => request.headers.get(name))) return publicError("not_found", 404);
  try {
    return await handler();
  } catch (error) {
    const { status, retryAfter } = safeFailure(error);
    const response = publicError(status === 429 ? "rate_limited" : "unavailable", status);
    if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
}
