import { createRateLimiter } from "../server/rate-limit";
import { fromSameOrigin } from "../server/same-origin";
import { readCapped, waitlistClientKey } from "../site/waitlist-server";
import { publicReadonlyResponse } from "../../lib/public-readonly";

// Shared by the three pay-request routes (src/app/api/concept/register/pay-requests).
// They stay open on the read-only public demo (see publicReadonlyResponse):
// same-origin only, each with its own limit per client address.

const limiters = {
  create: createRateLimiter({ max: 30, windowMs: 15 * 60_000 }),
  // A register polls every two seconds for at most ten minutes per request.
  status: createRateLimiter({ max: 1200, windowMs: 15 * 60_000 }),
  pay: createRateLimiter({ max: 30, windowMs: 15 * 60_000 }),
};

export const payJson = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", ...headers } });

/** The refusal for a request that may not proceed, or undefined when it may. */
export function payRequestRefusal(request: Request, limit: keyof typeof limiters): Response | undefined {
  const readonly = publicReadonlyResponse(request);
  if (readonly) return readonly;
  if (!fromSameOrigin(request)) return payJson({ error: "forbidden_origin" }, 403);
  const taken = limiters[limit](waitlistClientKey(request.headers));
  if (!taken.ok) return payJson({ error: "rate_limited" }, 429, { "Retry-After": String(taken.retryAfter) });
}

/** A small JSON body, or null when it is too large or not JSON. */
export async function payRequestBody(request: Request): Promise<unknown | null> {
  const raw = await readCapped(request, 1024);
  if (raw === "too-large") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
