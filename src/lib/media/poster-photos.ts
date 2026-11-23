import { NextRequest } from "next/server";
import { fullOwner, ownerDeploymentRefusal, sessionOwner } from "../owner-http";
import { findMedia } from "./library";
import { MEDIA_ID, POSTER_PHOTO_FIELDS, posterPhotoRefId } from "./limits";

// A poster may name a library photo (`media:<id>`) instead of sending the photo itself. The renderer then
// reads it through the media store, for the signed-in owner's own business only, with the same deployment
// and session checks as the owner routes (read-only deployment, accounts off, signed out or enrolment-only
// session: refused). Fixture photos sent as data need none of this. Satori cannot draw WebP, and
// a photo larger than the renderer's limit would make a huge poster, so such a photo is refused and the studio
// sends a scaled copy instead.

/** Base64 of this many bytes stays under the renderer's 2.8 MB limit for one photo. */
const MAX_RENDER_BYTES = 2_000_000;

export type PosterPhotoRefusal = "signed_out" | "photo_unsuitable" | "unavailable";

/** The request with each library photo replaced by its data URL, or why it cannot be drawn. */
export async function withLibraryPhotos(request: Request, body: { data: Record<string, unknown> }): Promise<{ ok: true } | { ok: false; reason: PosterPhotoRefusal }> {
  if (ownerDeploymentRefusal()) return { ok: false, reason: "unavailable" };
  const owner = await sessionOwner(new NextRequest(request.url, { headers: request.headers }));
  if (!fullOwner(owner)) return { ok: false, reason: "signed_out" };
  for (const field of POSTER_PHOTO_FIELDS) {
    const id = posterPhotoRefId(body.data[field]);
    if (id === null) continue;
    if (!MEDIA_ID.test(id)) return { ok: false, reason: "photo_unsuitable" };
    const media = await findMedia(owner.tenantId, id);
    if (!media || media.contentType === "image/webp" || media.byteSize > MAX_RENDER_BYTES) return { ok: false, reason: "photo_unsuitable" };
    const bytes = await media.bytes();
    if (!bytes) return { ok: false, reason: "photo_unsuitable" };
    body.data[field] = `data:${media.contentType};base64,${bytes.toString("base64")}`;
  }
  return { ok: true };
}
