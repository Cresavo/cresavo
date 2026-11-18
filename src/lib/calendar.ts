import { z } from "zod";
import { db } from "./db";
import { DEMO_BUSINESS_ID as businessId } from "./config";
import { bookingListSchema } from "./domain";
import { parseDay } from "./time";
import { DomainError } from "./errors";

export const calendarSchema = bookingListSchema.safeExtend({
  staffId: z.string().min(1).max(128).optional(),
  status: z.enum(["confirmed", "all"]).default("confirmed"),
});
export async function listCalendar(input: unknown) {
  const v = calendarSchema.parse(input);
  const where = {
    businessId,
    startsAt: {
      gte: parseDay(v.from).toJSDate(),
      lt: parseDay(v.to).plus({ days: 1 }).toJSDate(),
    },
    ...(v.staffId && { staffId: v.staffId }),
    ...(v.status === "confirmed" && { status: "confirmed" }),
  };
  if (
    v.cursor &&
    !(await db.booking.findFirst({
      where: { ...where, id: v.cursor },
      select: { id: true },
    }))
  )
    throw new DomainError("This page does not match the date range. Showing the first page.");
  const rows = await db.booking.findMany({
    where,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: v.limit + 1,
    ...(v.cursor && { cursor: { id: v.cursor }, skip: 1 }),
    select: {
      id: true,
      staffId: true,
      serviceId: true,
      serviceName: true,
      startsAt: true,
      endsAt: true,
      customerName: true,
      status: true,
      version: true,
      priceOre: true,
      duration: true,
      buffer: true,
    },
  });
  return {
    bookings: rows.slice(0, v.limit),
    nextCursor: rows.length > v.limit ? rows[v.limit - 1].id : null,
  };
}
