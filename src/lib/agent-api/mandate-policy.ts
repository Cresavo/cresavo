import { createHash } from "node:crypto";
import { z } from "zod";
import { AgentApiError } from "./errors";
import { DEMO_LOCATION_ID, placeForStaff } from "./place";

// Only trusted operator code may issue this record. No agent endpoint issues it.
export const mandateSchema = z.object({
  businessId: z.enum(["demo", "lab-partner"]),
  clientId: z.string().min(1).max(128),
  serviceId: z.string().min(1).max(128),
  staffId: z.string().min(1).max(128),
  locationId: z.literal(DEMO_LOCATION_ID).default(DEMO_LOCATION_ID),
  scheduleId: z.string().min(1).max(160).optional(),
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  maxPriceOre: z.number().int().min(0).max(2_000_000_000),
  currency: z.literal("SEK"),
  origin: z.literal("synthetic-operator"),
  originReference: z.string().trim().min(1).max(128),
}).strict().refine(v => !v.scheduleId || v.scheduleId === placeForStaff(v.staffId).scheduleId, {
  message: "MANDATE_SCHEDULE_INVALID",
}).refine(v => Date.parse(v.validFrom) < Date.parse(v.validUntil), {
  message: "MANDATE_RANGE_INVALID",
}).transform(v => ({ ...v, scheduleId: v.scheduleId ?? placeForStaff(v.staffId).scheduleId }));

export type StoredMandate = {
  businessId: string; clientId: string; serviceId: string; staffId: string;
  locationId: string; scheduleId: string;
  validFrom: Date; validUntil: Date; expiresAt: Date; revokedAt: Date | null;
  proposalHash?: string | null;
  maxPriceOre: number; currency: string; origin: string; originReference: string;
};
export type MandatedBooking = {
  businessId: string; clientId: string; serviceId: string; staffId: string;
  locationId: string; scheduleId: string;
  start: Date; duration: number; priceOre: number;
};

/** A bounded synthetic authorisation, never a claim of real customer consent. */
export function assertMandatedBooking(m: StoredMandate | null, b: MandatedBooking, now = new Date()) {
  if (!m || m.revokedAt || !["synthetic-operator", "customer-consent"].includes(m.origin) || !m.originReference ||
      m.currency !== "SEK" || m.businessId !== b.businessId || m.clientId !== b.clientId ||
      m.serviceId !== b.serviceId || m.staffId !== b.staffId ||
      m.locationId !== b.locationId || m.scheduleId !== b.scheduleId ||
      !Number.isFinite(b.start.getTime()) || !Number.isInteger(b.duration) || b.duration <= 0 ||
      !Number.isInteger(b.priceOre) || b.priceOre < 0 || b.priceOre > m.maxPriceOre ||
      now.getTime() >= m.expiresAt.getTime() ||
      b.start.getTime() < m.validFrom.getTime() ||
      b.start.getTime() + b.duration * 60_000 > m.validUntil.getTime())
    throw new AgentApiError("mandate_denied");
  if (m.origin === "customer-consent" && (!m.proposalHash || m.proposalHash !== bookingProposalHash(b)))
    throw new AgentApiError("mandate_denied");
}

/** Fixed-order canonical projection: no client supplied scope or display labels. */
export function bookingProposalHash(b: MandatedBooking) {
  return createHash("sha256").update(JSON.stringify([
    "booking-proposal-v1", b.businessId, b.clientId, b.serviceId, b.staffId,
    b.locationId, b.scheduleId, b.start.toISOString(), b.duration, b.priceOre, "SEK",
  ])).digest("hex");
}
