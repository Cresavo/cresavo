import type { NextRequest } from "next/server";
import { loadPublicTenant } from "@/lib/public-booking";
import { MAX_BOOKING_BODY_BYTES, publicBookingSchema } from "@/lib/public-booking-request";
import { publicError, publicOk, publicRoute } from "@/lib/public-http";
import { issuedAtValid } from "@/lib/public-issued-at";
import { readBoundedJson } from "@/lib/owner-http";
import { ownerStore } from "@/lib/owner-store";
import { checkRateLimit } from "@/lib/rate-limit";
import { idempotencyKeySchema } from "@/lib/validation";
import type { DemoAction } from "@/concept/actions";
import type { StaffId } from "@/concept/data/types";
import { findCustomerByPhone } from "@/concept/booking/lookup";
import { quote } from "@/concept/booking/protection";
import { t } from "@/concept/i18n";
import { formatDayLong, formatTime } from "@/concept/i18n/format";
import { withTenantPresentation } from "@/concept/i18n/presentation";
import { bookableServices } from "@/concept/selectors";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
import { scopedIdempotencyKey } from "@/concept/store/idempotency";

/**
 * Books a time on the salon's page: the one public write. The salon comes
 * from the address and the booking rules from the studio's reducer; the
 * response says what was booked and never any of the salon's state.
 */
export function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return publicRoute(request, async () => {
    await checkRateLimit("public-booking", waitlistClientKey(request.headers));
    const json = await readBoundedJson(request, MAX_BOOKING_BODY_BYTES);
    if (json === "too_large") return publicError("too_large", 413);
    const slug = (await params).slug.toLowerCase();
    const key = idempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));
    const body = publicBookingSchema.safeParse(json);
    // One answer for every refusal, the honeypot's and the form-time token's included.
    if (!key.success || !body.success || !issuedAtValid(body.data.issuedAt, slug)) return publicError("invalid", 422);
    const found = await loadPublicTenant(slug);
    if (!found) return publicError("not_found", 404);
    const { tenantId, state } = found;
    await checkRateLimit("public-tenant", tenantId);

    const { name, phone, email, serviceId, date, start } = body.data;
    const staffId = body.data.staffId as StaffId;
    const service = bookableServices(state).find((s) => s.id === serviceId);
    if (service) {
      if ((body.data.price !== undefined && body.data.price !== service.price) || (body.data.duration !== undefined && body.data.duration !== service.duration)) {
        return publicError("terms_changed", 409);
      }
      // Deposits are not taken on the server yet; the salon takes those bookings by phone.
      if (quote(state.cancellationPolicy, service, state.localization.currency, !findCustomerByPhone(state, phone)).depositMinor) {
        return publicError("deposit_unsupported", 409);
      }
    }
    const person = state.staff.find((s) => s.id === staffId);
    const notice = withTenantPresentation(state, () => ({
      title: t("booking.inboxTitle"),
      body: t("booking.inboxBody", { service: service?.name ?? "", staff: person?.firstName ?? "", day: formatDayLong(date), time: formatTime(start) }),
    }));
    // `at` is a placeholder: the store stamps the real time, and the same request always fingerprints the same.
    const action: DemoAction = { type: "online/book", guest: { name, phone, email, at: { date: "1970-01-01", time: 0 } }, notice, serviceId, staffId, date, start };
    const result = await ownerStore().apply(tenantId, action, { actor: "customer", source: "customer-page" },
      { idempotencyKey: scopedIdempotencyKey("booking-page", key.data) });
    if (result.ok) {
      const booking = result.state.bookings.filter((b) => b.source === "online" && b.status === "booked" && b.serviceId === serviceId && b.staffId === staffId && b.date === date && b.start === start).at(-1);
      if (!booking) throw new Error("PUBLIC_BOOKING_MISSING");
      return publicOk({ bookingId: booking.id, serviceId, staffId, date, start, duration: booking.duration }, 201);
    }
    if (result.reason === "rejected") return publicError("slot_unavailable", 409);
    if (result.reason === "not-found") return publicError("not_found", 404);
    if (result.reason === "idempotency-mismatch") return publicError("idempotency_mismatch", 422);
    const busy = publicError("unavailable", 503);
    busy.headers.set("Retry-After", "1");
    return busy;
  }, { write: true });
}
