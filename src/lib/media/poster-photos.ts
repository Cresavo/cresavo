import { enrolmentOnly } from "../owner-mfa";
import { ownerAccountsEnabled } from "../owner-accounts";
import { OWNER_COOKIE, ownerFromCookie } from "../owner-session";
import { findMedia } from "./library";
import { MEDIA_ID, POSTER_PHOTO_FIELDS, posterPhotoRefId } from "./limits";

// A poster may name a library photo (`media:<id>`) instead of sending the photo itself. The renderer then
// reads it through the media store, for the signed-in owner's own business only. Satori cannot draw WebP, and
// a photo larger than the renderer's limit would make a huge poster, so such a photo is refused and the studio
// sends a scaled copy instead.

/** Base64 of this many bytes stays under the renderer's 2.8 MB limit for one photo. */
const MAX_RENDER_BYTES = 2_000_000;

export type PosterPhotoRefusal = "signed_out" | "photo_unsuitable";

const cookieOf = (request: Request) => request.headers.get("cookie")?.split(";")
  .map((part) => part.trim()).find((part) => part.startsWith(`${OWNER_COOKIE}=`))?.slice(OWNER_COOKIE.length + 1);

/** The request with each library photo replaced by its data URL, or why it cannot be drawn. */
export async function withLibraryPhotos(request: Request, body: { data: Record<string, unknown> }): Promise<{ ok: true } | { ok: false; reason: PosterPhotoRefusal }> {
  if (!ownerAccountsEnabled()) return { ok: false, reason: "signed_out" };
  const owner = await ownerFromCookie(cookieOf(request));
  if (!owner || enrolmentOnly(owner)) return { ok: false, reason: "signed_out" };
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
