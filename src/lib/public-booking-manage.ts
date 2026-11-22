import type { NextRequest } from "next/server";
import type { z } from "zod";
import { onlineChangeBlock, type DemoAction, type ExpectedVisit, type PublicChange } from "@/concept/actions";
import { publicBookingView } from "@/concept/booking/public-booking-view";
import type { Booking, StaffId } from "@/concept/data/types";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
import { scopedIdempotencyKey } from "@/concept/store/idempotency";
import { verifyBookingLink } from "./booking-token";
import { readBoundedJson } from "./bounded-json";
import { loadPublicTenant } from "./public-booking";
import { MAX_MANAGE_BODY_BYTES } from "./public-booking-request";
import { publicError, publicOk, publicRoute } from "./public-http";
import { checkRateLimit, reserveTenantQuota } from "./rate-limit";
import { idempotencyKeySchema } from "./validation";

// The one path of a customer's cancel and move from the link in their e-mail.
// The token is a secret, so it travels in the body; every refusal that could
// tell a guesser something is the same 404. The rules are the reducer's.

/** The token of a request body, or "" when it has none; whatever else the body holds is the schema's to judge. */
const tokenOf = (json: unknown) => json && typeof json === "object" && typeof (json as { token?: unknown }).token === "string" ? (json as { token: string }).token : "";

/** Whether the link's token opens this snapshot's booking now: the one rule of the view, so the refusal path asks it of its own snapshot too. */
const linkOpens = (token: string, tenantId: string, ref: string, booking: Booking) =>
  verifyBookingLink(token, { tenantId, bookingId: booking.id, ref, customerId: booking.customerId, purpose: "manage" }, booking);

/** The parts every change shares. The times are placeholders: the store stamps its own clock under the lock. */
type Common = { at: { date: "1970-01-01"; time: 0 }; instant: 0; public: PublicChange; expected: ExpectedVisit };

export function manageBooking<S extends z.ZodType<{ token: string; expected: { date: string; start: number; staffId: string } }>>(
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
    if (!found || !booking || !token || !linkOpens(token, found.tenantId, ref, booking)) {
      return publicError("not_found", 404);
    }
    const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
    const body = schema.safeParse(json);
    if (!key.success || !body.success) return publicError("invalid", 422);

    const address = found.state.salon.slug;
    const expected = body.data.expected as ExpectedVisit & { staffId: StaffId };
    const action = toAction(booking.id, body.data, { at: { date: "1970-01-01", time: 0 }, instant: 0, public: { slug: address }, expected });
    const { ownerStore } = await import("@/lib/owner-store");
    const result = await ownerStore().apply(found.tenantId, action, { actor: "customer", source: "customer-page" }, {
      idempotencyKey: scopedIdempotencyKey(action.type === "online/cancel" ? "booking-cancel" : "booking-move", key.data),
      // The salon's allowance is taken by each new change inside the store's transaction, under the salon's lock and after a retry has been recognised: a committed retry gets its receipt, no two can take the last one, and a commit that fails keeps none. The account is checked under the same lock.
      requireActiveAccount: true,
      beforeCommit: (transaction) => reserveTenantQuota(found.tenantId, transaction),
    });
    if (result.ok) {
      const changed = result.state.bookings.find((b) => b.id === booking.id);
      if (!changed) throw new Error("PUBLIC_BOOKING_MISSING");
      return publicOk({ booking: publicBookingView(result.state, changed) });
    }
    if (result.reason === "rejected") {
      // The reducer refused: say what stands in the way, or else that the time cannot be had.
      const current = await loadPublicTenant(slug.toLowerCase());
      if (current?.tenantId !== found.tenantId) return publicError("not_found", 404);
      // The salon may have moved the visit earlier meanwhile: the link then expires with it, as the view says.
      const latest = current.state.bookings.find((b) => b.id === booking.id);
      if (!latest || !linkOpens(token, found.tenantId, ref, latest)) return publicError("not_found", 404);
      return publicError(onlineChangeBlock(current.state, booking.id, address, Date.now(), expected) ?? "slot_unavailable", 409);
    }
    if (result.reason === "not-found") return publicError("not_found", 404);
    if (result.reason === "idempotency-mismatch") return publicError("idempotency_mismatch", 422);
    const busy = publicError("unavailable", 503);
    busy.headers.set("Retry-After", "1");
    return busy;
  }, { write: true });
}
