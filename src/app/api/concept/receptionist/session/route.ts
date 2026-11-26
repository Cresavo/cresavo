import { realtimeKey, receptionistEnabled } from "@/concept/receptionist/server/config";
import { mintSession, sessionInput } from "@/concept/receptionist/server/session";
import { withRequestLog } from "@/concept/server/logger";
import { createRateLimiter } from "@/concept/server/rate-limit";
import { fromSameOrigin } from "@/concept/server/same-origin";
import { UNVERIFIED_CLIENT, waitlistClientKey } from "@/concept/site/waitlist-server";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Each call costs money, so a test call is rationed twice: per visitor, and per
// day for the whole deployment. The daily ceiling times the per-call ceiling
// is the most a day of test calls can cost.
const takeCall = createRateLimiter({ max: 3, windowMs: 60_000 });
const DAILY_CALLS = 40;
const takeDailyCall = createRateLimiter({ max: DAILY_CALLS, windowMs: 86_400_000 });

const refuse = (error: string, status: number, retryAfter?: number) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } });

/** Starts a browser test call with the sample salon's receptionist: answers with a client secret that lives for a minute. */
export const POST = withRequestLog("/api/concept/receptionist/session", async (request: Request) => {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  if (!receptionistEnabled()) return refuse("not_found", 404);
  if (!fromSameOrigin(request)) return refuse("invalid_origin", 403);
  const apiKey = realtimeKey();
  if (!apiKey) return refuse("not_configured", 503);
  let input;
  try {
    input = sessionInput.safeParse(await request.json());
  } catch {
    return refuse("invalid_request", 400);
  }
  if (!input.success) return refuse("invalid_request", 400);
  const client = waitlistClientKey(request.headers);
  if (client === UNVERIFIED_CLIENT) return refuse("invalid_origin", 403);
  const mine = takeCall(client);
  if (!mine.ok) return refuse("rate_limited", 429, mine.retryAfter);
  const today = takeDailyCall("all");
  if (!today.ok) return refuse("daily_limit", 429, today.retryAfter);
  const minted = await mintSession(input.data, { apiKey, client });
  if (!minted.ok) return refuse("provider_unavailable", 502);
  return Response.json(minted.session, { headers: { "Cache-Control": "no-store" } });
});
