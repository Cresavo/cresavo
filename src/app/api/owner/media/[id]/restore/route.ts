import { NextResponse, type NextRequest } from "next/server";
import { restoreMedia } from "@/lib/media/library";
import { MEDIA_ID } from "@/lib/media/limits";
import { ownerError, ownerOk, ownerRoute, sessionKey, fullOwner, refusedOwner, sessionOwner } from "@/lib/owner-http";
export const runtime = "nodejs";

/** Undo for a delete: brings back a picture of this business deleted within the last day. */
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return ownerRoute(request, async () => {
    const owner = await sessionOwner(request);
    if (!fullOwner(owner)) return refusedOwner(owner);
    const { id } = await params;
    if (!MEDIA_ID.test(id)) return ownerError("not_found", 404);
    const result = await restoreMedia(owner.tenantId, id);
    return result.ok ? ownerOk({ asset: result.asset, session: sessionKey(owner) }) : ownerError(result.reason, result.reason === "conflict" ? 409 : 404);
  });
}
