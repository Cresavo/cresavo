import { buildStaffFeed } from "@/concept/calendar/feed";
import { feedSecretSource, validFeedToken } from "@/concept/server/feed-token";
import { toolContext } from "@/concept/server/demo-business";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_FOUND = () => new Response("Not found", { status: 404 });

/**
 * `/api/concept/calendar/<staff>.ics?token=...`: one person's bookings as a
 * calendar subscription. The token is the only credential, so a wrong token and
 * an unknown person look the same. Nothing from the URL reaches the log.
 * The studio keeps its edits in the owner's browser, so this feed is the
 * server's sample business; the studio says so beside the link.
 */
export const GET = withRequestLog("/api/concept/calendar/[staff]", async (request: Request, context: { params: Promise<{ staff: string }> }) => {
  if (feedSecretSource() === "missing") return new Response("Calendar feeds are switched off", { status: 503 });
  const { staff } = await context.params;
  if (!staff.endsWith(".ics")) return NOT_FOUND();
  const staffId = staff.slice(0, -".ics".length);
  if (!validFeedToken(staffId, new URL(request.url).searchParams.get("token"))) return NOT_FOUND();
  const now = new Date();
  const { state, clock } = toolContext(now);
  const feed = buildStaffFeed(state, staffId, clock.today, now);
  if (!feed) return NOT_FOUND();
  return new Response(feed, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
});
