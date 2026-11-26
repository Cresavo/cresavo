import { after } from "next/server";
import { verifyPageToken } from "@/concept/receptionist/web-call/page-token";
import { webCallEnabled } from "@/concept/receptionist/web-call/config";
import { cleanupRuntime, webCallRuntime } from "@/concept/receptionist/web-call/runtime";
import { hangUpAll, MAX_OFFER_BYTES, startWebCall, superviseCall, sweepOverdue, webCallInput } from "@/concept/receptionist/web-call/server";
import { withRequestLog } from "@/concept/server/logger";
import { fromSameOrigin } from "@/concept/server/same-origin";
import { readCapped, UNVERIFIED_CLIENT, waitlistClientKey } from "@/concept/site/waitlist-server";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The route stays alive after answering to watch the call and hang it up at its limits (4 minutes by default).
export const maxDuration = 300;

/** Work that runs after the answer is sent; outside a request scope (tests, scripts) it simply runs. */
function later(work: () => Promise<unknown>) {
  try {
    after(work);
  } catch {
    void work();
  }
}

const refuse = (error: string, status: number, retryAfter?: number) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) } });

/** Starts a web call with the sample salon's receptionist: takes the browser's WebRTC offer, answers with OpenAI's answer. */
export const POST = withRequestLog("/api/concept/receptionist/web-call", async (request: Request) => {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  const runtime = webCallRuntime();
  if (runtime === "off") {
    // The kill switch also ends calls that are still running.
    const cleanup = cleanupRuntime();
    if (cleanup) later(() => hangUpAll(cleanup).catch(() => undefined));
    return refuse("closed", 404);
  }
  if (typeof runtime === "string") return refuse("not_configured", 503);
  if (!fromSameOrigin(request)) return refuse("invalid_origin", 403);
  const raw = await readCapped(request, MAX_OFFER_BYTES + 2_000);
  if (raw === "too-large") return refuse("invalid_request", 413);
  let input;
  try {
    input = webCallInput.safeParse(JSON.parse(raw));
  } catch {
    return refuse("invalid_request", 400);
  }
  if (!input.success) return refuse("invalid_request", 400);
  const token = verifyPageToken(runtime.secret, input.data.token);
  if (!token.ok) return refuse(token.reason === "expired" ? "page_expired" : "invalid_token", 403);
  const client = waitlistClientKey(request.headers);
  if (client === UNVERIFIED_CLIENT) return refuse("invalid_origin", 403);
  try {
    await sweepOverdue(runtime);
    const started = await startWebCall(input.data, { ...runtime, client, session: token.session });
    if (!started.ok) return refuse(started.error, started.error === "provider_unavailable" ? 502 : 429, started.retryAfter);
    // The server watches the call itself: deadline, cost ceiling from OpenAI's own usage reports, tampering.
    later(() => superviseCall(started.callId, started.deadline, { ...runtime, limits: started.limits, model: started.model, instructions: started.instructions, toolNames: started.toolNames, enabled: () => webCallEnabled(process.env),
      // One line per call: how it ended, what it cost, and how each turn was heard (digits and e-mails masked).
      onReport: (report, why) => console.log(JSON.stringify({ level: "info", msg: "web_call_ended", why, model: started.model, ...report })) })
      .catch(() => undefined));
    return Response.json({ callId: started.callId, sdp: started.sdp, limits: started.limits, model: started.model }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // The ledger could not be reached: no call starts without its limits.
    return refuse("not_configured", 503);
  }
});
