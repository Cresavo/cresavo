import type { NextRequest } from "next/server";
import { z } from "zod";
import { verifyBookingLink } from "@/lib/booking-token";
import { readBoundedJson } from "@/lib/bounded-json";
import { loadPublicTenant } from "@/lib/public-booking";
import { publicError, publicOk, publicRoute } from "@/lib/public-http";
import { checkRateLimit } from "@/lib/rate-limit";
import { publicBookingView } from "@/concept/booking/public-booking-view";
import { waitlistClientKey } from "@/concept/site/waitlist-server";

const bodySchema = z.object({ token: z.string().min(1).max(300) }).strict();

/**
 * The read-only view of one booking for the holder of its e-mail link. The
 * token is a secret, so it travels in a POST body, never in a URL. Every
 * refusal is the same 404: a wrong, expired or foreign token says nothing.
 */
export function POST(request: NextRequest, { params }: { params: Promise<{ slug: string; id: string }> }) {
  return publicRoute(request, async () => {
    await checkRateLimit("public-read", waitlistClientKey(request.headers));
    const json = await readBoundedJson(request, 1024);
    if (json === "too_large") return publicError("too_large", 413);
    const body = bodySchema.safeParse(json);
    const { slug, id } = await params;
    const found = body.success ? await loadPublicTenant(slug.toLowerCase()) : null;
    const booking = found?.state.bookings.find((b) => b.publicRef === id);
    if (!body.success || !found || !booking || !verifyBookingLink(body.data.token, { tenantId: found.tenantId, bookingId: booking.id, ref: id, customerId: booking.customerId, purpose: "manage", contactEmail: booking.contactEmail ?? "" }, booking)) {
      return publicError("not_found", 404);
    }
    return publicOk({ booking: publicBookingView(found.state, booking) });
  }, { write: true });
}
