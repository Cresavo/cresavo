import { z } from "zod";
import { date, id, minutes, required, staffId, text, uuid } from "./primitives";

// Bookings, the inbox and reviews.

const slotSuggestion = z.strictObject({ staffId, serviceId: id, date, start: minutes });

/** An inbox note as the studio writes it, without its id. `delivery` is the sender's own record and never comes from the owner. */
export const inboxNotice = z.strictObject({
  kind: z.enum(["request", "reschedule", "cancel", "review", "message", "system"]),
  customerId: id.optional(),
  fromName: required().optional(),
  date,
  time: minutes,
  title: required(),
  body: text(),
  read: z.boolean(),
  handled: z.boolean(),
  bookingId: id.optional(),
  requestedStaffId: staffId.optional(),
  reviewId: id.optional(),
  suggestion: slotSuggestion.optional(),
  waitlistOffer: z.boolean().optional(),
  recallServiceId: id.optional(),
  draftReply: text().optional(),
  reply: text().optional(),
});

const newBooking = z.strictObject({
  type: z.literal("booking/create"),
  id: uuid.optional(),
  serviceId: id,
  staffId,
  date,
  start: minutes,
  source: z.enum(["online", "phone", "walk-in", "campaign", "assistant"]),
});

const guest = z.strictObject({ name: required(), phone: required(30), email: text(254).optional() });

export const bookingSchemas = {
  "booking/cancel": z.strictObject({ type: z.literal("booking/cancel"), id, reason: text().optional(), notice: inboxNotice.optional() }),
  "booking/complete": z.strictObject({ type: z.literal("booking/complete"), id }),
  "booking/create": z.union([
    newBooking.extend({ customerId: id }),
    newBooking.extend({ newCustomer: guest.extend({ since: date }) }),
    newBooking.extend({ fictionalCustomer: z.strictObject({ id: uuid, name: required(), since: date }), source: z.literal("assistant") }),
  ]),
  "booking/fee": z.strictObject({
    type: z.literal("booking/fee"), id, incident: z.enum(["noshow", "late"]), outcome: z.enum(["charge", "waive"]), reason: text().optional(),
  }),
  "booking/move": z.strictObject({
    type: z.literal("booking/move"), id, date, start: minutes, staffId: staffId.optional(), notice: inboxNotice.optional(),
  }),
  "inbox/add": z.strictObject({ type: z.literal("inbox/add"), item: inboxNotice }),
  "inbox/read": z.strictObject({ type: z.literal("inbox/read"), id }),
  "inbox/read-all": z.strictObject({ type: z.literal("inbox/read-all") }),
  "inbox/reply": z.strictObject({ type: z.literal("inbox/reply"), id, reply: required(2000), slot: slotSuggestion.optional() }),
  "review/approve": z.strictObject({ type: z.literal("review/approve"), id }),
  "review/reply": z.strictObject({ type: z.literal("review/reply"), id, reply: required(2000) }),
};
