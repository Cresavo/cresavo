import type { NextRequest } from "next/server";
import { loadPublicSalon } from "@/lib/public-booking";
import { publicError, publicOk, publicRoute } from "@/lib/public-http";
import { issuedAtToken } from "@/lib/public-issued-at";
import { checkRateLimit } from "@/lib/rate-limit";
import { waitlistClientKey } from "@/concept/site/waitlist-server";

/** What a customer may see of a salon: its page, treatments, team and busy times. */
export function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return publicRoute(request, async () => {
    await checkRateLimit("public-read", waitlistClientKey(request.headers));
    const slug = (await params).slug.toLowerCase();
    const state = await loadPublicSalon(slug);
    return state ? publicOk({ state, issuedAt: issuedAtToken(slug) }) : publicError("not_found", 404);
  });
}
