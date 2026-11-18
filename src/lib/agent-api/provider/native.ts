import type { Prisma } from "@prisma/client";
import { db } from "../../db";
import { isPublicReadonly } from "../../public-readonly";
import { fixtureStaff } from "../../public-fixtures";
import { DEMO_BUSINESS_ID } from "../../config";
import { listServices, getAvailability, createBooking, type BookingTransactionHooks } from "../../domain";
import { DomainError } from "../../errors";
import { ZONE } from "../../time";
import { lockConfiguration } from "../../workspace-write";
import { AgentApiError } from "../errors";
import { ProviderUnsupportedError, type BookingProvider, type BookingInput, type ProviderBooking } from "./types";

// Transaction callbacks are a native-only capability supplied by the gateway.
export const nativeBookingProvider = {
  id: "native",
  capabilities: Object.freeze({ holdSlot: false, cancelBooking: true, staffSelection: true, idempotency: true, timeZone: ZONE }),
  async listServices() {
    const [services, resources] = await Promise.all([
      listServices(),
      isPublicReadonly()
        ? Promise.resolve(fixtureStaff())
        : db.staff.findMany({
            where: { businessId: DEMO_BUSINESS_ID, active: true },
            select: { id: true, name: true, serviceIds: true },
            orderBy: [{ name: "asc" }, { id: "asc" }], take: 100,
          }),
    ]);
    return { services, resources };
  },
  async getAvailability(serviceId: string, day: string, resourceId?: string) {
    return { starts: await getAvailability(serviceId, day, db, resourceId), timeZone: ZONE };
  },
  async holdSlot(_input: { serviceId: string; start: string; resourceId?: string }): Promise<{ id: string }> {
    void _input;
    throw new ProviderUnsupportedError("native", "holdSlot");
  },
  createBooking(input: BookingInput, idempotencyKey: string, channel: string, hooks?: BookingTransactionHooks) {
    return createBooking(input, idempotencyKey, channel, undefined, hooks);
  },
  async getBooking(id: string) {
    const row = await db.booking.findFirst({ where: { id, businessId: DEMO_BUSINESS_ID } });
    if (!row) throw new AgentApiError("booking_not_found");
    return row;
  },
  async cancelBooking(id: string, actorId: string, authorize?: (tx: Prisma.TransactionClient) => Promise<void>) {
    return await db.$transaction(async (tx) => {
      await lockConfiguration(tx);
      await authorize?.(tx);
      const [current] = await tx.$queryRaw<ProviderBooking[]>`
        SELECT * FROM "Booking" WHERE "id" = ${id} AND "businessId" = ${DEMO_BUSINESS_ID} FOR UPDATE`;
      if (!current) throw new DomainError("Booking not found. Return to the calendar.");
      if (current.status === "cancelled") return { row: current, already: true };
      const row = await tx.booking.update({
        where: { id: current.id },
        data: { status: "cancelled", version: { increment: 1 } },
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: current.id, action: "cancel", actorKind: "agent-api", actorId: actorId,
          previousStart: current.startsAt, previousEnd: current.endsAt, previousStaffId: current.staffId,
        },
      });
      return { row, already: false };
    }, { maxWait: 30000, timeout: 30000 });
  },
} satisfies BookingProvider;
