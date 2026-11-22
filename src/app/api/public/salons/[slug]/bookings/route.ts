import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "@/lib/bounded-json";
import { loadPublicTenant } from "@/lib/public-booking";
import { MAX_BOOKING_BODY_BYTES, publicBookingSchema } from "@/lib/public-booking-request";
import { publicError, publicOk, publicRoute } from "@/lib/public-http";
import { issuedAtValid } from "@/lib/public-issued-at";
import { checkRateLimit } from "@/lib/rate-limit";
import { idempotencyKeySchema } from "@/lib/validation";
import type { DemoAction } from "@/concept/actions";
import { acceptedTerms } from "@/concept/booking/public-terms";
import type { StaffId } from "@/concept/data/types";
import { jsonEqual } from "@/concept/data/json-equal";
import { bookableServices } from "@/concept/selectors";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
import { scopedIdempotencyKey } from "@/concept/store/idempotency";

// Nothing here reaches the database before the guards in `publicRoute` have
// passed: the store is imported inside the handler, the salon through a lazy
// lookup.

/**
 * Books a time on the salon's page: the one public write. The salon comes
 * from the address, and the rules (free time, accepted terms, deposits, the
 * address the guest was on) are the studio reducer's, decided under the
 * salon's lock. The response says what was booked, by an opaque reference,
 * and never any of the salon's state.
 */
export function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return publicRoute(request, async () => {
    // The attempt budget: every well-formed or not request from one address counts.
    await checkRateLimit("public-booking", waitlistClientKey(request.headers));
    const json = await readBoundedJson(request, MAX_BOOKING_BODY_BYTES);
    if (json === "too_large") return publicError("too_large", 413);
    const slug = (await params).slug.toLowerCase();
    const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
    const body = publicBookingSchema.safeParse(json);
    if (!key.success || !body.success) return publicError("invalid", 422);
    const found = await loadPublicTenant(slug);
    if (!found) return publicError("not_found", 404);
    const { tenantId } = found;
    const address = found.state.salon.slug;
    // One answer for every refusal, the honeypot's (the schema's) and the form-time token's included.
    if (!issuedAtValid(body.data.issuedAt, tenantId, address)) return publicError("invalid", 422);
    // The salon's allowance is charged once per new booking, below; a salon that has used it takes no new attempt.
    await checkRateLimit("public-tenant", tenantId, false);

    const { name, phone, email, serviceId, date, start, terms } = body.data;
    const staffId = body.data.staffId as StaffId;
    // `at` is a placeholder: the store stamps the real time, and the same request always fingerprints the same.
    const action: DemoAction = {
      type: "online/book", guest: { name, phone, email, at: { date: "1970-01-01", time: 0 } }, serviceId, staffId, date, start,
      public: { slug: address, terms, publicRef: randomUUID() },
    };
    const { ownerStore } = await import("@/lib/owner-store");
    const result = await ownerStore().apply(tenantId, action, { actor: "customer", source: "customer-page" },
      { idempotencyKey: scopedIdempotencyKey("booking-page", key.data) });
    if (result.ok) {
      if (!result.replayed) {
        try {
          await checkRateLimit("public-tenant", tenantId);
        } catch {
          // The booking is made; reaching the allowance with it only closes the next attempt.
        }
      }
      // On a replay the state is the original commit's, so the reference is the one first given out.
      const booking = result.state.bookings.filter((b) => b.publicRef && b.source === "online" && b.status === "booked" && b.serviceId === serviceId && b.staffId === staffId && b.date === date && b.start === start).at(-1);
      if (!booking) throw new Error("PUBLIC_BOOKING_MISSING");
      return publicOk({ ref: booking.publicRef, serviceId, staffId, date, start, duration: booking.duration }, 201);
    }
    if (result.reason === "rejected") {
      // The reducer refused; say why when it was the terms or a deposit, which the page can act on. Anything else is the time.
      const current = await loadPublicTenant(slug);
      if (current?.tenantId !== tenantId) return publicError("not_found", 404);
      const service = bookableServices(current.state).find((s) => s.id === serviceId);
      const now = service && acceptedTerms(current.state, service);
      if (now && !jsonEqual(now, terms)) return publicError("terms_changed", 409);
      if (now?.depositMinor) return publicError("deposit_unsupported", 409);
      return publicError("slot_unavailable", 409);
    }
    if (result.reason === "not-found") return publicError("not_found", 404);
    if (result.reason === "idempotency-mismatch") return publicError("idempotency_mismatch", 422);
    const busy = publicError("unavailable", 503);
    busy.headers.set("Retry-After", "1");
    return busy;
  }, { write: true });
}
