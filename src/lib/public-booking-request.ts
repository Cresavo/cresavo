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
  // No control characters and no explicit bidi overrides or isolates; ordinary Unicode, right-to-left scripts included, is fine.
  name: z.string().trim().min(2).max(80).regex(/^[^\p{Cc}\u202A-\u202E\u2066-\u2069]+$/u),
  phone: z.string().trim().max(20).refine(isMobilePhone),
  email: z.email().max(254),
  language: z.enum(["en", "sv"]),
  website: z.literal(""),
  issuedAt: z.string().max(200),
  /** The price, length and policy the guest saw; the reducer books only while they still hold. */
  terms: z.object({
    version: z.number().int().min(0), freeHours: z.number().min(0), latePercent: z.number().min(0), noShowPercent: z.number().min(0),
    currency: z.string().max(8), priceMinor: z.number().int().min(0), depositMinor: z.number().int().min(0), duration: z.number().int().min(0).max(1440),
  }).strict(),
}).strict();

/** The change of a booking by the holder of its link: the link's token, and for a move the new time. Strict, and no free text. */
export const MAX_MANAGE_BODY_BYTES = 2048;

const token = z.string().min(1).max(300);

/** The visit as the customer saw it; the change is refused if the booking is no longer that. */
const expected = z.object({ staffId: z.string().min(1).max(64), date: dateSchema, start: z.number().int().min(0).max(1439) }).strict();

export const cancelBookingSchema = z.object({ token, expected }).strict();

export const moveBookingSchema = z.object({
  token, expected, staffId: z.string().min(1).max(64), date: dateSchema, start: z.number().int().min(0).max(1439),
}).strict();
