import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { deleteMedia, findMedia, setAltText } from "@/lib/media/library";
import { MAX_ALT_TEXT, MEDIA_ID } from "@/lib/media/limits";
import { imageResponse } from "@/lib/media/respond";
import { ownerError, ownerOk, ownerRoute, readBoundedJson, sessionKey, fullOwner, refusedOwner, sessionOwner } from "@/lib/owner-http";
export const runtime = "nodejs";

// One picture of the signed-in owner's business. Another business's picture answers exactly like one that
// does not exist.

type Context = { params: Promise<{ id: string }> };

const altSchema = z.object({ altText: z.string().trim().max(MAX_ALT_TEXT).nullable() }).strict();

async function own(request: NextRequest, context: Context) {
  const owner = await sessionOwner(request);
  if (!fullOwner(owner)) return refusedOwner(owner);
  const { id } = await context.params;
  return MEDIA_ID.test(id) ? { tenantId: owner.tenantId, id, session: sessionKey(owner) } : ownerError("not_found", 404);
}

/** The picture's bytes, for the studio. */
export function GET(request: NextRequest, context: Context) {
  return ownerRoute(request, async () => {
    const target = await own(request, context);
    if (target instanceof NextResponse) return target;
    const media = await findMedia(target.tenantId, target.id);
    return media ? imageResponse(request, media, "owner") : ownerError("not_found", 404);
  }, { write: false });
}

/** Sets or clears the picture's description (`altText`). */
export function PATCH(request: NextRequest, context: Context) {
  return ownerRoute(request, async () => {
    const target = await own(request, context);
    if (target instanceof NextResponse) return target;
    const json = await readBoundedJson(request, 2048);
    if (json === "too_large") return ownerError("too_large", 413);
    const body = altSchema.safeParse(json);
    if (!body.success) return ownerError("invalid", 400);
    const asset = await setAltText(target.tenantId, target.id, body.data.altText || null);
    return asset ? ownerOk({ asset, session: target.session }) : ownerError("not_found", 404);
  });
}

/** Deletes the picture. It can be brought back for a day (`restore`) and is purged by the media sweep later. */
export function DELETE(request: NextRequest, context: Context) {
  return ownerRoute(request, async () => {
    const target = await own(request, context);
    if (target instanceof NextResponse) return target;
    return (await deleteMedia(target.tenantId, target.id)) ? ownerOk({ ok: true, session: target.session }) : ownerError("not_found", 404);
  });
}
