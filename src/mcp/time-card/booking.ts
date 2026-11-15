import { assertWritable } from "../../lib/public-readonly";
import { z } from "zod";
import { createBooking } from "../../lib/domain";
import { db } from "../../lib/db";
import { DomainError, safeFailure } from "../../lib/errors";
import {
  rememberCardAttempt,
  finishCardAttempt,
  assertCardBookingChannel,
} from "./recovery";
import { MCP_BOOKING_CLIENT, mcpBookingSchema } from "../booking";
import { timeCardBookingsEnabled } from "./guard";

// No customer contact can be supplied by the app or model in this proof.
export const CARD_CUSTOMER = {
  customerName: "Tidkort Demo",
  customerEmail: "tidkort@example.test",
} as const;

export const cardBookingSchema = mcpBookingSchema
  .omit({ customerName: true, customerEmail: true })
  .extend({
    staffId: z.string().min(1).max(128),
    serviceVersion: z.number().int().min(1),
    clientRequestId: z.uuid(),
  })
  .strict();

export async function bookDemoTime(input: unknown) {
  assertWritable();
  if (!timeCardBookingsEnabled()) throw new DomainError("Åtkomst nekad", 403);
  const args = cardBookingSchema.parse(input);
  await rememberCardAttempt(args);
  let booking;
  try {
    booking = await createBooking(
      mcpBookingSchema.parse({ ...args, ...CARD_CUSTOMER }),
      `time-card_${args.clientRequestId}`,
      MCP_BOOKING_CLIENT,
    );
    // Another legacy/non-card client may win the domain key after admission.
    // Domain replay intentionally keeps its old contract; never return its row
    // to this card unless the server-owned channel also matches.
    assertCardBookingChannel(booking.clientKey);
    await finishCardAttempt(args.clientRequestId, "saved");
  } catch (error) {
    if (safeFailure(error).status < 500)
      await finishCardAttempt(args.clientRequestId, "failed");
    throw error;
  }
  const staff = await db.staff.findFirst({
    where: { businessId: booking.businessId, id: args.staffId },
    select: { name: true },
  });
  return {
    demo: true,
    bookingCreated: true,
    timezone: "Europe/Stockholm",
    id: booking.id,
    serviceId: booking.serviceId,
    staffId: args.staffId,
    status: booking.status,
    // Initial timestamps are populated on INSERT by the historical trigger.
    // The existing booking version tracks later workspace changes.
    changedSinceCreation: booking.version > 1,
    serviceName: booking.serviceName,
    staffName: staff?.name ?? "Demopersonal",
    duration: booking.duration,
    priceOre: booking.priceOre,
    startsAt: booking.startsAt.toISOString(),
    endsAt: booking.endsAt.toISOString(),
  };
}
