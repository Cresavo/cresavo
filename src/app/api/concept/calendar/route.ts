import { feedToken } from "@/concept/server/feed-token";
import { toolContext } from "@/concept/server/demo-business";
import { withRequestLog } from "@/concept/server/logger";
import { fromSameOrigin } from "@/concept/server/same-origin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The subscription links for the studio's More > Staff page. The demo studio
 * has no login, so the same-origin check only keeps other websites from reading
 * the links; real owner authentication comes with the pilot gate.
 */
export const GET = withRequestLog("/api/concept/calendar", (request: Request) => {
  if (!fromSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { state } = toolContext();
  const feeds = state.staff.flatMap((person) => {
    const token = feedToken(person.id);
    return token ? [{ staffId: person.id, path: `/api/concept/calendar/${person.id}.ics?token=${token}` }] : [];
  });
  return Response.json({ feeds }, { headers: { "Cache-Control": "no-store" } });
});
