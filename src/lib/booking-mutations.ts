import { assertWritable } from "./public-readonly";
import { z } from "zod";
import type { Booking, Prisma } from "@prisma/client";
import { db } from "./db";
import { DEMO_BUSINESS_ID as businessId } from "./config";
import { getAvailability, bookingDatabaseError } from "./domain";
import { DomainError } from "./errors";
import { localDay, parseDay } from "./time";
import { workspaceWrite, type WorkspaceActor } from "./workspace-write";

const identity = {
  id: z.string().min(1).max(128),
  expectedVersion: z.number().int().min(1),
};
export const moveBookingSchema = z
  .object({
    ...identity,
    staffId: z.string().min(1).max(128),
    start: z.iso.datetime({ offset: true }),
  })
  .strict();
export const cancelBookingSchema = z.object(identity).strict();

export function bookingSummary(b: Booking) {
  return {
    id: b.id,
    serviceId: b.serviceId,
    staffId: b.staffId,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    version: b.version,
  };
}
export async function getBooking(id: string, includeCustomer = false) {
  const row = await db.booking.findFirst({
    where: { id: z.string().min(1).max(128).parse(id), businessId },
  });
  if (!row) throw new DomainError("Booking not found. Return to the calendar.");
  const events = await db.bookingEvent.findMany({
    where: { bookingId: row.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 20,
    select: {
      action: true,
      createdAt: true,
      previousStart: true,
      previousEnd: true,
      previousStaffId: true,
      nextStart: true,
      nextEnd: true,
      nextStaffId: true,
    },
  });
  return {
    ...bookingSummary(row),
    serviceName: row.serviceName,
    priceOre: row.priceOre,
    duration: row.duration,
    buffer: row.buffer,
    ...(includeCustomer && {
      customerId: row.customerId,
      customerName: row.customerName,
      customerEmail: "***@***",
    }),
    events,
  };
}

export async function getMoveAvailability(
  id: string,
  day: string,
  staffId: string,
) {
  const row = await db.booking.findFirst({
    where: { id: z.string().min(1).max(128).parse(id), businessId },
  });
  if (!row) throw new DomainError("Booking not found. Return to the calendar.");
  if (row.status !== "confirmed")
    throw new DomainError("This booking is cancelled and cannot be rescheduled.", 409);
  return getAvailability(row.serviceId, day, db, staffId, {
    ignoreBookingId: row.id,
    duration: row.duration,
    buffer: row.buffer,
  });
}

function resourceKeys(staffId: string, start: Date, end: Date) {
  const keys: string[] = [];
  const last = parseDay(localDay(new Date(end.getTime() - 1)));
  for (
    let day = parseDay(localDay(start));
    day <= last;
    day = day.plus({ days: 1 })
  ) {
    if (keys.length >= 31) throw new DomainError("That time is no longer available. Choose another time.");
    keys.push(`${businessId}:staff:${staffId}:${day.toISODate()}`);
  }
  return keys;
}
async function lockedBooking(
  tx: Prisma.TransactionClient,
  id: string,
  expectedVersion: number,
  next?: { staffId: string; start: Date; end: Date },
) {
  const before = await tx.booking.findFirst({ where: { id, businessId } });
  if (!before) throw new DomainError("Booking not found. Return to the calendar.");
  const keys = resourceKeys(before.staffId, before.startsAt, before.endsAt);
  if (next) keys.push(...resourceKeys(next.staffId, next.start, next.end));
  for (const key of [...new Set(keys)].sort())
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  const [current] = await tx.$queryRaw<
    Booking[]
  >`SELECT * FROM "Booking" WHERE "id"=${id} AND "businessId"=${businessId} FOR UPDATE`;
  if (!current) throw new DomainError("Booking not found. Return to the calendar.");
  if (current.version !== expectedVersion)
    throw new DomainError("The details have changed. Refresh and review them again.", 409);
  return current;
}

export async function moveBooking(
  input: unknown,
  requestId: string,
  actor: WorkspaceActor,
) {
  assertWritable();
  const v = moveBookingSchema.parse(input);
  return workspaceWrite(
    "move_booking",
    v,
    requestId,
    actor,
    false,
    async (tx) => {
      const existing = await tx.booking.findFirst({
        where: { id: v.id, businessId },
      });
      if (!existing) throw new DomainError("Booking not found. Return to the calendar.");
      const start = new Date(v.start);
      const end = new Date(
        start.getTime() + (existing.duration + existing.buffer) * 60000,
      );
      const current = await lockedBooking(tx, v.id, v.expectedVersion, {
        staffId: v.staffId,
        start,
        end,
      });
      if (current.status !== "confirmed")
        throw new DomainError(
          "This booking is cancelled and cannot be rescheduled.",
          409,
        );
      const slots = await getAvailability(
        current.serviceId,
        localDay(start),
        tx,
        v.staffId,
        {
          ignoreBookingId: current.id,
          duration: current.duration,
          buffer: current.buffer,
        },
      );
      if (!slots.includes(start.toISOString()))
        throw new DomainError("That time is no longer available. Choose another time.");
      let updated: Booking;
      try {
        [updated] = await tx.$queryRaw<
          Booking[]
        >`UPDATE "Booking" SET "staffId"=${v.staffId}, "startsAt"=${start}, "endsAt"=${end}, "version"="version"+1 WHERE "id"=${current.id} RETURNING *`;
      } catch (error) {
        bookingDatabaseError(error);
      }
      await tx.bookingEvent.create({
        data: {
          bookingId: current.id,
          action: "move",
          actorKind: actor.kind,
          actorId: actor.id,
          previousStart: current.startsAt,
          previousEnd: current.endsAt,
          previousStaffId: current.staffId,
          nextStart: start,
          nextEnd: end,
          nextStaffId: v.staffId,
        },
      });
      return bookingSummary(updated);
    },
  );
}

export async function cancelBooking(
  input: unknown,
  requestId: string,
  actor: WorkspaceActor,
) {
  assertWritable();
  const v = cancelBookingSchema.parse(input);
  return workspaceWrite(
    "cancel_booking",
    v,
    requestId,
    actor,
    false,
    async (tx) => {
      const current = await lockedBooking(tx, v.id, v.expectedVersion);
      if (current.status === "cancelled") return bookingSummary(current);
      const updated = await tx.booking.update({
        where: { id: current.id },
        data: { status: "cancelled", version: { increment: 1 } },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: current.id,
          action: "cancel",
          actorKind: actor.kind,
          actorId: actor.id,
          previousStart: current.startsAt,
          previousEnd: current.endsAt,
          previousStaffId: current.staffId,
        },
      });
      return bookingSummary(updated);
    },
  );
}
