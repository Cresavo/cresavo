import { z } from "zod";
import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { bookingSchema, idempotencyKeySchema } from "../lib/domain";
import { safeFailure } from "../lib/errors";

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

// Keep the same strict advertised schema and validate before the callback.
// SDK 2.4 otherwise formats validation issues itself, outside reply/safeFailure.
export const mcpBookingToolSchema: StandardSchemaWithJSON<
  z.input<typeof mcpBookingSchema>,
  z.output<typeof mcpBookingSchema>
> = {
  "~standard": {
    ...mcpBookingSchema["~standard"],
    validate(value: unknown) {
      try {
        return { value: mcpBookingSchema.parse(value) };
      } catch (error) {
        throw new Error(safeFailure(error).message);
      }
    },
  },
};

export function bookingModeAllowed(args: string[], secret: string | undefined) {
  const enabled = args.includes("--allow-bookings");
  if (enabled && (!args.includes("--admin") || !secret || secret.length < 32))
    throw new Error("MCP_BOOKING_CONFIG_INVALID");
  return enabled;
}
