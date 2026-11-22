import { z } from "zod";
import { isMobilePhone } from "@/concept/booking/lookup";
import { dateSchema } from "./validation";

// What the public booking form may send. Strict: an unknown field is refused,
// and there is no free-text field. `website` is the honeypot (a person never
// sees it), and a refusal never says which rule failed.

export const MAX_BOOKING_BODY_BYTES = 4096;

export const publicBookingSchema = z.object({
  serviceId: z.string().min(1).max(64),
  staffId: z.string().min(1).max(64),
  date: dateSchema,
  start: z.number().int().min(0).max(1439),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(20).refine(isMobilePhone),
  email: z.email().max(254),
  language: z.enum(["en", "sv"]),
  website: z.literal(""),
  issuedAt: z.string().max(200),
  /** What the customer saw, so a change since then is told rather than booked. */
  price: z.number().min(0).max(10_000_000).optional(),
  duration: z.number().int().min(0).max(1440).optional(),
}).strict();
