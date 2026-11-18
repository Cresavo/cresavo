import type { Adapter, CountryCode, LanguageTag, Money, PhoneE164, PortResult, TimeZone, UtcTimestamp } from "../core";
import type { WebhookRequest } from "./webhook";

export type ListingCapability = "feeds" | "booking-server" | "realtime-updates";

export interface ListingSnapshot {
  merchant: {
    id: string;
    name: string;
    phone?: PhoneE164;
    url: string;
    address: { street: string; locality: string; postalCode: string; country: CountryCode };
    timeZone: TimeZone;
    language: LanguageTag;
  };
  services: { id: string; name: string; description?: string; price: Money; durationMinutes: number }[];
  /** Bookable start times. */
  slots: { serviceId: string; staffId?: string; start: UtcTimestamp; durationMinutes: number; spotsOpen: number }[];
}

export interface FeedFile {
  /** File name the partner portal expects. */
  name: string;
  contentType: "application/json";
  body: string;
}

/** A booking request arriving from the listing platform, already authenticated. */
export interface ListingBookingRequest {
  method: "HealthCheck" | "CheckAvailability" | "BatchAvailabilityLookup" | "CreateBooking" | "UpdateBooking" | "GetBookingStatus" | "ListBookings";
  idempotencyToken?: string;
  body: unknown;
}

export interface ListingPort extends Adapter<ListingCapability> {
  buildFeeds(snapshot: ListingSnapshot, generatedAt: UtcTimestamp): PortResult<FeedFile[]>;
  /** Authenticates a booking-server call and returns the parsed request. */
  authenticateBookingCall(request: WebhookRequest): Promise<PortResult<ListingBookingRequest>>;
  /** Tells the platform that availability changed (real-time update). */
  notifyAvailability(snapshot: ListingSnapshot): Promise<PortResult<{ accepted: number }>>;
}
