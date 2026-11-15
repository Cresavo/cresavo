import { z } from "zod";
import { AgentApiError } from "./errors";

// Only trusted operator code may issue this record. No agent endpoint issues it.
export const mandateSchema = z.object({
  businessId: z.literal("demo"),
  clientId: z.string().min(1).max(128),
  serviceId: z.string().min(1).max(128),
  staffId: z.string().min(1).max(128),
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  maxPriceOre: z.number().int().min(0).max(2_000_000_000),
  currency: z.literal("SEK"),
  origin: z.literal("synthetic-operator"),
  originReference: z.string().trim().min(1).max(128),
}).strict().refine(v => Date.parse(v.validFrom) < Date.parse(v.validUntil), {
  message: "MANDATE_RANGE_INVALID",
});

export type StoredMandate = {
  businessId: string; clientId: string; serviceId: string; staffId: string;
  validFrom: Date; validUntil: Date; expiresAt: Date; revokedAt: Date | null;
  maxPriceOre: number; currency: string; origin: string; originReference: string;
};
export type MandatedBooking = {
  businessId: string; clientId: string; serviceId: string; staffId: string;
  start: Date; duration: number; priceOre: number;
};

/** A bounded synthetic authorisation, never a claim of real customer consent. */
export function assertMandatedBooking(m: StoredMandate | null, b: MandatedBooking, now = new Date()) {
  if (!m || m.revokedAt || m.origin !== "synthetic-operator" || !m.originReference ||
      m.currency !== "SEK" || m.businessId !== b.businessId || m.clientId !== b.clientId ||
      m.serviceId !== b.serviceId || m.staffId !== b.staffId ||
      !Number.isFinite(b.start.getTime()) || !Number.isInteger(b.duration) || b.duration <= 0 ||
      !Number.isInteger(b.priceOre) || b.priceOre < 0 || b.priceOre > m.maxPriceOre ||
      now.getTime() >= m.expiresAt.getTime() ||
      b.start.getTime() < m.validFrom.getTime() ||
      b.start.getTime() + b.duration * 60_000 > m.validUntil.getTime())
    throw new AgentApiError("mandate_denied");
}
