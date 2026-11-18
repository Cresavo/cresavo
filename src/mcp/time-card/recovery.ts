import { assertWritable } from "../../lib/public-readonly";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { db } from "../../lib/db";
import { DEMO_BUSINESS_ID as businessId } from "../../lib/config";
import { DomainError } from "../../lib/errors";
import { MCP_BOOKING_CLIENT } from "../booking";
import { timeCardBookingsEnabled } from "./guard";
import { cardBookingSchema } from "./booking";

export const cardHistorySchema = z
  .object({ requestId: z.uuid().optional() })
  .strict();

// The private local profile authorises ONE demo channel, not individual humans.
// Arguments, booking IDs and model claims can never choose/upgrade this scope.
export function cardScope() {
  if (!timeCardBookingsEnabled()) throw new DomainError("Access denied.", 403);
  return createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`${businessId}:time-card-recovery:v1`)
    .digest("hex");
}
function channelKey() {
  return createHmac("sha256", process.env.SESSION_SECRET!)
    .update(MCP_BOOKING_CLIENT)
    .digest("hex");
}

export function assertCardBookingChannel(clientKey: string | null) {
  if (clientKey !== channelKey())
    throw new DomainError(
      "This demo profile cannot access the booking.",
      403,
    );
}

async function currentCardBooking(requestId: string) {
  // Callers first authorise and select an attempt in cardScope(). No raw id lookup.
  const row = await db.booking.findFirst({
    where: {
      businessId,
      idempotencyKey: `time-card_${requestId}`,
      clientKey: channelKey(),
    },
    select: {
      id: true,
      staffId: true,
      serviceId: true,
      serviceName: true,
      startsAt: true,
      endsAt: true,
      duration: true,
      buffer: true,
      priceOre: true,
      status: true,
      version: true,
    },
  });
  if (!row) return null;
  const staff = await db.staff.findFirst({
    where: { businessId, id: row.staffId },
    select: { name: true },
  });
  return {
    demo: true,
    bookingCreated: true,
    timezone: "Europe/Stockholm",
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    staffName: staff?.name ?? "Demopersonal",
    changedSinceCreation: row.version > 1,
  };
}

export async function rememberCardAttempt(input: unknown) {
  assertWritable();
  const scope = cardScope(),
    args = cardBookingSchema.parse(input);
  // Claim UUIDs across profiles under the SAME key lock used by createBooking.
  // Release admission locks before the domain transaction; its order is unchanged.
  const denied = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:key:time-card_${args.clientRequestId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:card-attempt:${scope}`}))`;
      const priorBooking = await tx.booking.findFirst({
        where: {
          businessId,
          idempotencyKey: `time-card_${args.clientRequestId}`,
        },
        select: { clientKey: true },
      });
      const claim = await tx.cardBookingAttempt.findFirst({
        where: { businessId, requestId: args.clientRequestId },
        orderBy: [{ createdAt: "asc" }, { scope: "asc" }],
        select: { scope: true },
      });
      if (
        priorBooking
          ? priorBooking.clientKey !== channelKey()
          : claim && claim.scope !== scope
      ) {
        // Commit this recovery marker BEFORE returning 403. Throwing in the
        // transaction would roll it back and permanently strand our own pending.
        await tx.cardBookingAttempt.updateMany({
          where: {
            businessId,
            scope,
            requestId: args.clientRequestId,
            outcome: "pending",
          },
          data: { outcome: "failed" },
        });
        return true;
      }
      const existing = await tx.cardBookingAttempt.findUnique({
        where: {
          businessId_scope_requestId: {
            businessId,
            scope,
            requestId: args.clientRequestId,
          },
        },
      });
      if (existing) {
        if (
          JSON.stringify(cardBookingSchema.parse(existing.payload)) !==
          JSON.stringify(args)
        )
          throw new DomainError(
            "This booking attempt was already used with different details.",
            409,
          );
        if (existing.outcome === "failed")
          throw new DomainError(
            "The previous attempt was declined. Choose another time and confirm again.",
            409,
          );
        return;
      }
      const pending = await tx.cardBookingAttempt.findFirst({
        where: { businessId, scope, outcome: "pending" },
      });
      if (pending) {
        const saved = await tx.booking.findFirst({
          where: {
            businessId,
            clientKey: channelKey(),
            idempotencyKey: `time-card_${pending.requestId}`,
          },
          select: { id: true },
        });
        if (!saved) {
          const previous = cardBookingSchema.parse(pending.payload);
          if (
            previous.start === args.start &&
            previous.staffId === args.staffId
          )
            throw new DomainError("That time is no longer available. Choose another time.");
          throw new DomainError(
            "Check the previous booking attempt first.",
            409,
          );
        }
        await tx.cardBookingAttempt.update({
          where: {
            businessId_scope_requestId: {
              businessId,
              scope,
              requestId: pending.requestId,
            },
          },
          data: { outcome: "saved" },
        });
      }
      await tx.cardBookingAttempt.create({
        data: {
          businessId,
          scope,
          requestId: args.clientRequestId,
          payload: args,
        },
      });
    },
    { maxWait: 30000, timeout: 30000 },
  );
  if (denied)
    throw new DomainError(
      "This demo profile cannot access the booking.",
      403,
    );
}

export async function finishCardAttempt(
  requestId: string,
  outcome: "saved" | "failed",
) {
  assertWritable();
  await db.cardBookingAttempt.update({
    where: {
      businessId_scope_requestId: { businessId, scope: cardScope(), requestId },
    },
    data: { outcome },
  });
}

export async function readCardBookings(input: unknown) {
  const scope = cardScope(),
    args = cardHistorySchema.parse(input);
  // Pending always comes first, independent of the twenty-receipt history bound.
  const pending = await db.cardBookingAttempt.findFirst({
    where: { businessId, scope, outcome: "pending" },
  });
  const attempts = await db.cardBookingAttempt.findMany({
    where: {
      businessId,
      scope,
      ...(args.requestId
        ? { requestId: args.requestId }
        : { outcome: { not: "pending" } }),
    },
    orderBy: [{ createdAt: "desc" }, { requestId: "desc" }],
    take: 20,
  });
  if (
    args.requestId &&
    !attempts.length &&
    pending?.requestId !== args.requestId
  )
    throw new DomainError(
      "This demo profile cannot access the booking.",
      403,
    );
  const rows = [
    ...(pending && (!args.requestId || pending.requestId === args.requestId)
      ? [pending]
      : []),
    ...attempts.filter((a) => a.requestId !== pending?.requestId),
  ];
  const items = [];
  for (const row of rows) {
    const receipt = await currentCardBooking(row.requestId);
    items.push({
      requestId: row.requestId,
      createdAt: row.createdAt.toISOString(),
      outcome: receipt ? "saved" : row.outcome,
      ...(receipt
        ? { receipt }
        : row.outcome === "pending"
          ? { retry: cardBookingSchema.parse(row.payload) }
          : {}),
    });
  }
  return {
    demo: true,
    channel: "Local time card demo",
    items,
    historyLimit: 20,
    notice:
      "Shows attempts from this trusted local demo channel only. Customer sign-in and full history are unavailable.",
  };
}
