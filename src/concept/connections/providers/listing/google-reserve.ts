// Reserve with Google / Google Actions Center (Booking Server v3) - partner approval required.
// Sources (checked 2026-11):
// - Partner interest form: https://services.google.com/fb/forms/reservationsappointmentsonlinebooking-interestform/
// - Onboarding: https://developers.google.com/actions-center/verticals/appointments/redirect/integration-steps/overview
// - Booking Server and Basic auth: https://developers.google.com/actions-center/verticals/local-services/e2e/integration-steps/implement-booking-server
// - Methods: https://developers.google.com/actions-center/verticals/local-services/e2e/reference/booking-server-api-rest/e2e-methods/createbooking-method
// - Real-time updates (mapsbooking.googleapis.com v1alpha, service-account OAuth):
//   https://developers.google.com/actions-center/verticals/local-services/e2e/reference/real-time-updates-rest/rtu
// Only Google-approved partners get a Partner Portal, feed dropboxes and booking-server traffic. Until then
// this adapter builds feeds and authenticates calls; it uploads and notifies nothing.
// verify: whether new partners can still join Appointments End-to-End or only Appointments Redirect.
// verify: availability RTU needs a service-account JWT; not implemented, full feeds cover availability.
import { connectionError, fail, ok } from "../../core";
import type { ListingBookingRequest, ListingPort } from "../../ports/listing";
import { safeEqual } from "../../server/crypto";
import { basicAuth } from "../../server/http";
import type { ProviderDefinition } from "../definition";
import { buildReserveFeeds } from "./reserve-feeds";

const PROVIDER = "google-reserve";
const METHODS: ListingBookingRequest["method"][] = ["HealthCheck", "BatchAvailabilityLookup", "CheckAvailability", "CreateBooking", "UpdateBooking", "GetBookingStatus", "ListBookings"];
const MAX_BODY = 64 * 1024;

export function googleReserve(options: { username: string; password: string }): ListingPort {
  return {
    info: definition.info,
    buildFeeds: (snapshot, generatedAt) => {
      const built = buildReserveFeeds(snapshot, generatedAt, "listing", PROVIDER);
      return built.ok ? ok(built.value, "queued") : built;
    },
    async authenticateBookingCall(call) {
      const given = call.headers.authorization;
      if (options.password.length < 16 || !given || !safeEqual(given, basicAuth(options.username, options.password))) return fail(connectionError("listing", PROVIDER, "invalid_signature"));
      let path: string;
      try {
        path = new URL(call.url).pathname;
      } catch {
        return fail(connectionError("listing", PROVIDER, "invalid_input"));
      }
      const method = METHODS.find((name) => path.replace(/\/+$/, "").endsWith(`/v3/${name}`));
      if (!method || call.rawBody.length > MAX_BODY) return fail(connectionError("listing", PROVIDER, "invalid_input"));
      if (method === "HealthCheck") return ok({ method, body: null }, "delivered");
      let body: unknown;
      try {
        body = JSON.parse(call.rawBody);
      } catch {
        return fail(connectionError("listing", PROVIDER, "invalid_input"));
      }
      const token = (body as { idempotency_token?: unknown })?.idempotency_token;
      if (method === "CreateBooking" && (typeof token !== "string" || !token)) return fail(connectionError("listing", PROVIDER, "invalid_input"));
      return ok({ method, body, ...(typeof token === "string" ? { idempotencyToken: token } : {}) }, "delivered");
    },
    notifyAvailability: async () => fail(connectionError("listing", PROVIDER, "not_supported")),
  };
}

export const definition: ProviderDefinition<"listing"> = {
  info: { port: "listing", provider: PROVIDER, kind: "live", capabilities: ["feeds", "booking-server"], secrets: ["GOOGLE_RESERVE_BOOKING_PASSWORD"] },
  secrets: ["GOOGLE_RESERVE_BOOKING_PASSWORD"],
  settings: ["GOOGLE_RESERVE_BOOKING_USER"],
  create: ({ secrets, settings }) => googleReserve({ username: settings.GOOGLE_RESERVE_BOOKING_USER ?? "", password: secrets.GOOGLE_RESERVE_BOOKING_PASSWORD }),
};
