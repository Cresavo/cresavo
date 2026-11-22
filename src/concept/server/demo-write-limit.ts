import { waitlistClientKey } from "../site/waitlist-server";
import { createRateLimiter, type Limit } from "./rate-limit";

/**
 * A per-address limit for the demo studio's server writes (the AI settings, the proposal decisions and the
 * demo reset). They are same-origin only, but that header is no credential, so a script could still write
 * disk and server state at will. The count is in this process, like the other concept limits.
 */
export function createDemoWriteGuard(limit: Limit = { max: 30, windowMs: 60_000 }) {
  const take = createRateLimiter(limit);
  return (request: Request): Response | undefined => {
    const taken = take(waitlistClientKey(request.headers));
    if (taken.ok) return undefined;
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(taken.retryAfter) } });
  };
}

export const demoWriteLimited = createDemoWriteGuard();
