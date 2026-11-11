import { z } from "zod";
import { bookingSchema, idempotencyKeySchema } from "../lib/domain";

// A stable, server-owned channel identity. Never accept this from tool arguments.
export const MCP_BOOKING_CLIENT = "mcp:local-booking-channel:v1";

export const mcpBookingSchema = bookingSchema
  .extend({
    customerEmail: bookingSchema.shape.customerEmail.refine(
      (email) => email.endsWith("@example.test"),
      "Endast syntetiska example.test-adresser tillåts",
    ),
    clientRequestId: idempotencyKeySchema,
    confirmed: z.literal(true),
  })
  .strict();

export function bookingModeAllowed(args: string[], secret: string | undefined) {
  const enabled = args.includes("--allow-bookings");
  if (enabled && (!args.includes("--admin") || !secret || secret.length < 32))
    throw new Error("MCP_BOOKING_CONFIG_INVALID");
  return enabled;
}
