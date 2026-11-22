import type { NextRequest } from "next/server";
import type { z } from "zod";
import { onlineChangeBlock, type DemoAction, type PublicChange } from "@/concept/actions";
import { publicBookingView } from "@/concept/booking/public-booking-view";
import { salonClock } from "@/concept/tools/clock";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
import { scopedIdempotencyKey } from "@/concept/store/idempotency";
import { verifyBookingToken } from "./booking-token";
import { readBoundedJson } from "./bounded-json";
import { loadPublicTenant } from "./public-booking";
import { MAX_MANAGE_BODY_BYTES } from "./public-booking-request";
import { publicError, publicOk, publicRoute } from "./public-http";
import { checkRateLimit } from "./rate-limit";
import { idempotencyKeySchema } from "./validation";

// The one path of a customer's cancel and move from the link in their e-mail.
// The token is a secret, so it travels in the body; every refusal that could
// tell a guesser something is the same 404. The rules are the reducer's.

/** The token of a request body, or "" when it has none; whatever else the body holds is the schema's to judge. */
const tokenOf = (json: unknown) => json && typeof json === "object" && typeof (json as { token?: unknown }).token === "string" ? (json as { token: string }).token : "";

/** The parts every change shares: a placeholder for the time (the store stamps the real one) and the salon's address. */
type Common = { at: { date: "1970-01-01"; time: 0 }; public: PublicChange };

export function manageBooking<S extends z.ZodType<{ token: string }>>(
  request: NextRequest, params: Promise<{ slug: string; id: string }>, schema: S,
  toAction: (id: string, body: z.infer<S>, common: Common) => Extract<DemoAction, { type: "online/cancel" | "online/move" }>,
) {
  return publicRoute(request, async () => {
    await checkRateLimit("public-booking", waitlistClientKey(request.headers));
    const json = await readBoundedJson(request, MAX_MANAGE_BODY_BYTES);
    if (json === "too_large") return publicError("too_large", 413);
    const { slug, id: ref } = await params;
    const found = await loadPublicTenant(slug.toLowerCase());
    const booking = found?.state.bookings.find((b) => b.publicRef === ref);
    const token = tokenOf(json);
    if (!found || !booking || !token || !verifyBookingToken(token, { tenantId: found.tenantId, bookingId: booking.id, ref, customerId: booking.customerId, purpose: "manage" })) {
      return publicError("not_found", 404);
    }
    const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
    const body = schema.safeParse(json);
    if (!key.success || !body.success) return publicError("invalid", 422);
    // The salon's allowance is charged once per new change, below; a salon that has used it takes no new attempt.
    await checkRateLimit("public-tenant", found.tenantId, false);

    const address = found.state.salon.slug;
    const action = toAction(booking.id, body.data, { at: { date: "1970-01-01", time: 0 }, public: { slug: address } });
    const { ownerStore } = await import("@/lib/owner-store");
    const result = await ownerStore().apply(found.tenantId, action, { actor: "customer", source: "customer-page" },
      { idempotencyKey: scopedIdempotencyKey(action.type === "online/cancel" ? "booking-cancel" : "booking-move", key.data) });
    if (result.ok) {
      if (!result.replayed) {
        try {
          await checkRateLimit("public-tenant", found.tenantId);
        } catch {
          // The change is made; reaching the allowance with it only closes the next attempt.
        }
      }
      const changed = result.state.bookings.find((b) => b.id === booking.id);
      if (!changed) throw new Error("PUBLIC_BOOKING_MISSING");
      return publicOk({ booking: publicBookingView(result.state, changed) });
    }
    if (result.reason === "rejected") {
      // The reducer refused: say whether the booking can no longer be changed, or only that time cannot be had.
      const current = await loadPublicTenant(slug.toLowerCase());
      if (current?.tenantId !== found.tenantId) return publicError("not_found", 404);
      const clock = salonClock(new Date());
      const block = onlineChangeBlock(current.state, booking.id, address, { date: clock.today, time: clock.minutes });
      return publicError(block ?? "slot_unavailable", 409);
    }
    if (result.reason === "not-found") return publicError("not_found", 404);
    if (result.reason === "idempotency-mismatch") return publicError("idempotency_mismatch", 422);
    const busy = publicError("unavailable", 503);
    busy.headers.set("Retry-After", "1");
    return busy;
  }, { write: true });
}
