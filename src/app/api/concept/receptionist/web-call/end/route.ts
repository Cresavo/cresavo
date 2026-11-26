import { z } from "zod";
import { verifyPageToken } from "@/concept/receptionist/web-call/page-token";
import { cleanupRuntime } from "@/concept/receptionist/web-call/runtime";
import { endWebCall, ledgerKey, sweepOverdue } from "@/concept/receptionist/web-call/server";
import { withRequestLog } from "@/concept/server/logger";
import { fromSameOrigin } from "@/concept/server/same-origin";
import { readCapped } from "@/concept/site/waitlist-server";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ token: z.string().min(10).max(200), callId: z.string().regex(/^[A-Za-z0-9_-]{6,120}$/) }).strict();
const done = (status = 204) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });

/** The browser hung up: the server ends the call at OpenAI too. Works with the switch off, so a call is never left running. */
export const POST = withRequestLog("/api/concept/receptionist/web-call/end", async (request: Request) => {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  const runtime = cleanupRuntime();
  if (!runtime) return done(404);
  if (!fromSameOrigin(request)) return done(403);
  const raw = await readCapped(request, 1_000);
  if (raw === "too-large") return done(413);
  let parsed;
  try {
    parsed = input.safeParse(JSON.parse(raw));
  } catch {
    return done(400);
  }
  if (!parsed.success) return done(400);
  // An expired page may still end its own call; only a token this server signed is accepted.
  const token = verifyPageToken(runtime.secret, parsed.data.token);
  if (!token.ok && token.reason !== "expired") return done(403);
  try {
    // Only the page that started a call can end it; any other answers the same, and nothing happens.
    if (await runtime.ledger.owns(parsed.data.callId, ledgerKey(runtime.secret, "sid", token.session))) await endWebCall(parsed.data.callId, runtime);
    await sweepOverdue(runtime);
  } catch {
    return done(503);
  }
  return done();
});
