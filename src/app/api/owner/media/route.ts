import { NextResponse, type NextRequest } from "next/server";
import { readBoundedBytes } from "@/lib/bounded-json";
import { listMedia, uploadMedia } from "@/lib/media/library";
import { MAX_MEDIA_BYTES, MEDIA_KINDS, type MediaKind } from "@/lib/media/limits";
import { ownerError, ownerOk, ownerRoute, sessionKey, fullOwner, refusedOwner, sessionOwner } from "@/lib/owner-http";
import { checkRateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";

// The signed-in owner's photo library. The business always comes from the session, never the request.

const STATUS = { heic: 415, unsupported: 415, animated: 415, corrupt: 422, too_many_pixels: 422, photo_limit: 409, storage_limit: 409, busy: 409 } as const;

/** The business's active photos and its logo, newest first. */
export function GET(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await sessionOwner(request);
    if (!fullOwner(owner)) return refusedOwner(owner);
    return ownerOk({ media: await listMedia(owner.tenantId), session: sessionKey(owner) });
  }, { write: false });
}

/**
 * Stores one picture sent as the raw request body (`?kind=photo` or `?kind=logo`). The body is capped while it
 * streams (and before, by `src/proxy.ts` and the HTTP entry point, from its declared length). Its real type is
 * read from its bytes and its metadata is removed before it is stored.
 */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await sessionOwner(request);
    if (!fullOwner(owner)) return refusedOwner(owner);
    const kind = request.nextUrl.searchParams.get("kind") ?? "photo";
    if (!MEDIA_KINDS.includes(kind as MediaKind)) return ownerError("invalid", 400);
    await checkRateLimit("media-upload", owner.tenantId);
    const body = await readBoundedBytes(request, MAX_MEDIA_BYTES);
    if (body === "too_large") return ownerError("too_large", 413);
    if (!body.length) return ownerError("invalid", 400);
    const result = await uploadMedia(owner.tenantId, kind as MediaKind, body);
    if (!result.ok) return ownerError(result.reason, STATUS[result.reason]);
    return ownerOk({ asset: result.asset, deduped: result.deduped, session: sessionKey(owner) });
  });
}
