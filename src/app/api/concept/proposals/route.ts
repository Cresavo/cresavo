import { pendingProposals, resetDemoBusiness } from "@/concept/server/demo-business";
import { withRequestLog } from "@/concept/server/logger";
import { fromSameOrigin } from "@/concept/server/same-origin";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Proposals from outside AIs waiting for the owner. The studio polls this. */
export const GET = withRequestLog("/api/concept/proposals", () => Response.json({ proposals: pendingProposals() }, { headers: { "Cache-Control": "no-store" } }));

/** Resets the server's demo business: fresh data, no proposals. */
export const DELETE = withRequestLog("/api/concept/proposals", (request: Request) => {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  if (!fromSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  resetDemoBusiness();
  return new Response(null, { status: 204 });
});
