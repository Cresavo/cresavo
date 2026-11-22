import type { NextRequest } from "next/server";
import { findPublicLogo } from "@/lib/media/library";
import { MEDIA_ID } from "@/lib/media/limits";
import { imageResponse } from "@/lib/media/respond";
import { ownerAccountsEnabled } from "@/lib/owner-accounts";
import { publicError } from "@/lib/public-http";
import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeFailure } from "@/lib/errors";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
export const runtime = "nodejs";

/**
 * A business's active logo, for its booking page and the tab icon. The only picture served without a
 * session: the address needs the logo's id and the SHA-256 of its bytes, so it cannot be guessed, and it
 * stops working when the logo is replaced or deleted. Photos are never served here.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; sha256: string }> }) {
  if (isPublicReadonly()) return readonlyForbidden();
  if (!ownerAccountsEnabled()) return publicError("not_found", 404);
  const { id, sha256 } = await params;
  if (!MEDIA_ID.test(id) || !/^[0-9a-f]{64}$/.test(sha256)) return publicError("not_found", 404);
  try {
    await checkRateLimit("public-read", waitlistClientKey(request.headers));
    const logo = await findPublicLogo(id, sha256);
    return logo ? await imageResponse(request, logo, "public") : publicError("not_found", 404);
  } catch (error) {
    const { status, retryAfter } = safeFailure(error);
    const response = publicError(status === 429 ? "rate_limited" : "unavailable", status);
    if (retryAfter) response.headers.set("Retry-After", String(retryAfter));
    return response;
  }
}
