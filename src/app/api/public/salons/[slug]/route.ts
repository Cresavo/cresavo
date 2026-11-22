import type { NextRequest } from "next/server";
import { loadPublicSalon } from "@/lib/public-booking";
import { publicError, publicOk, publicRoute } from "@/lib/public-http";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/** What a customer may see of a salon: its page, treatments, team and busy times. */
export function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return publicRoute(async () => {
    await checkRateLimit("public-read", clientIp(request.headers));
    const state = await loadPublicSalon((await params).slug);
    return state ? publicOk({ state }) : publicError("not_found", 404);
  });
}
