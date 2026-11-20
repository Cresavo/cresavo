import type { Booking, Customer, DateKey, Interval, StaffId } from "../data/types";

// Waitlist offers (docs/design/WAITLIST_OFFERS.md): what a customer asked to
// be told about, the freed times found for them, and the personal offers sent.

export interface WaitlistEntry {
  id: string;
  customerId: string;
  /** Older entries (a plain "waiting list" flag) have no treatment, days or window yet. */
  serviceId?: string;
  staffId?: StaffId;
  /** Salon dates, sorted. Empty for an older entry. */
  days: DateKey[];
  /** Wall-clock minutes the whole visit must fit in, on every requested day. 0–1440 is "any time". */
  window: Interval;
  /** Epoch milliseconds; the queue order. */
  joinedAt: number;
}

/** A freed or chosen stretch of one person's day that a waiting customer could fill. */
export interface WaitlistGap extends Interval {
  id: string;
  staffId: StaffId;
  date: DateKey;
  /** The customer whose cancellation freed it is not offered their own time back. */
  excludeCustomer?: string;
  /** The owner said yes (ask me first), so the queue for it may run. */
  approved?: boolean;
  /** Automatic sends wait for the end of quiet hours: the moment the first offer may go out. */
  readyAt?: number;
}

export interface WaitlistOffer extends Pick<Booking, "serviceId" | "staffId" | "date" | "start" | "duration" | "bufferBefore" | "bufferAfter" | "resourceId"> {
  id: string;
  gapId: string;
  entryId: string;
  customerId: string;
  offeredAt: number;
  offeredBy: "owner" | "automatic";
  /** The time is held for this customer until then. */
  expiresAt: number;
  status: "offered" | "claimed" | "lapsed" | "declined";
  endedAt?: number;
  bookingId?: string;
}

export type OfferMode = "off" | "ask" | "automatic";

export interface OfferRules {
  mode: OfferMode;
  /** How long a personal offer holds the time. */
  minutes: number;
  paused: boolean;
}

export const OFFER_MODES: readonly OfferMode[] = ["off", "ask", "automatic"];
export const HOLD_MINUTES = [10, 15, 30, 60] as const;
export const DEFAULT_OFFER_RULES: OfferRules = { mode: "ask", minutes: 15, paused: false };
export const ANY_TIME: Interval = { start: 0, end: 1440 };

/** An entry for each customer with the older waiting-list flag, so nobody already waiting is lost. */
export function legacyEntries(customers: readonly Pick<Customer, "id" | "waitlist">[]): WaitlistEntry[] {
  return customers.filter((c) => c.waitlist).map((c) => ({ id: `legacy-${c.id}`, customerId: c.id, days: [], window: { ...ANY_TIME }, joinedAt: 0 }));
}

/** The waitlist part of a state: "ask me first", 15-minute holds, and the customers already waiting. */
export function initialWaitlist(customers: readonly Pick<Customer, "id" | "waitlist">[] = []) {
  return {
    waitlistRules: { ...DEFAULT_OFFER_RULES },
    waitlistEntries: legacyEntries(customers),
    waitlistOffers: [] as WaitlistOffer[],
    waitlistGaps: [] as WaitlistGap[],
  };
}
