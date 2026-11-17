import { z } from "zod";
import { decideProposal } from "@/concept/server/demo-business";
import { withRequestLog } from "@/concept/server/logger";
import { fromSameOrigin } from "@/concept/server/same-origin";
export const runtime = "nodejs";

const body = z.object({ decision: z.enum(["approved", "declined", "failed"]) }).strict();

/** The owner's decision on one proposal, sent by the studio. */
export const POST = withRequestLog("/api/concept/proposals/[id]", async (request: Request, context: { params: Promise<{ id: string }> }) => {
  if (!fromSameOrigin(request)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid decision" }, { status: 400 });
  const { id } = await context.params;
  const proposal = decideProposal(id, parsed.data.decision);
  return proposal ? Response.json({ proposal }) : Response.json({ error: "No pending proposal with this id" }, { status: 404 });
});
