import type { NextRequest } from "next/server";
import { safeFailure } from "@/lib/errors";
import { findLogo } from "@/lib/media/library";
import { MEDIA_ID } from "@/lib/media/limits";
import { imageResponse } from "@/lib/media/respond";
import { fullOwner, ownerDeploymentRefusal, sessionOwner } from "@/lib/owner-http";
import { publicError } from "@/lib/public-http";
import { checkRateLimit } from "@/lib/rate-limit";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
export const runtime = "nodejs";

/**
 * A business's logo, for its booking page and the tab icon. The only picture served without a session, and
 * only while it is published, the business's saved page uses it, its owner account is active and the salon
 * has not expired (the conditions of the public booking page): the address needs the logo's id and the
 * SHA-256 of its bytes, so it cannot be guessed. Before the page is saved, only its own signed-in owner sees
 * it (the editor's preview), privately. Photos are never served here. Copies are revalidated after five
 * minutes, so a removed or replaced logo stops showing soon.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; sha256: string }> }) {
  const refused = ownerDeploymentRefusal();
  if (refused) return refused;
  const { id, sha256 } = await params;
  if (!MEDIA_ID.test(id) || !/^[0-9a-f]{64}$/.test(sha256)) return publicError("not_found", 404);
  try {
    await checkRateLimit("public-read", waitlistClientKey(request.headers));
    const logo = await findLogo(id, sha256);
    if (!logo) return publicError("not_found", 404);
    if (logo.published) return await imageResponse(request, logo.media, "public");
    const owner = await sessionOwner(request);
    return fullOwner(owner) && owner.tenantId === logo.media.tenantId ? await imageResponse(request, logo.media, "owner") : publicError("not_found", 404);
  } catch (error) {
    const { status, retryAfter } = safeFailure(error);
    const response = publicError(status === 429 ? "rate_limited" : "unavailable", status);
    if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
}
