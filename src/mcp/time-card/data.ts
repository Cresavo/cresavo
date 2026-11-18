import { DateTime } from "luxon";
import { z } from "zod";
import { db } from "../../lib/db";
import { DEMO_BUSINESS_ID } from "../../lib/config";
import { getAvailability, listServices } from "../../lib/domain";
import { DomainError } from "../../lib/errors";
import { dateSchema } from "../../lib/validation";

export const timeCardSchema = z
  .object({
    serviceId: z.string().min(1).max(128).optional(),
    staffId: z.string().min(1).max(128).optional(),
    date: dateSchema.optional(),
  })
  .strict();

export async function timeCardServices() {
  return (await listServices()).map(
    ({ id, name, duration, priceOre, version }) => ({
      id,
      name,
      duration,
      priceOre,
      version,
    }),
  );
}

export async function timeCardData(input: unknown, bookingEnabled = false) {
  const args = timeCardSchema.parse(input);
  const today = DateTime.now().setZone("Europe/Stockholm").startOf("day");
  const date = args.date ?? today.toISODate()!;
  const day = DateTime.fromISO(date, { zone: "Europe/Stockholm" });
  if (day < today || day > today.plus({ days: 27 }))
    throw new DomainError("Choose a date within the next 28 days.");
  const services = await timeCardServices();
  const service = services.find(
    ({ id }) => id === (args.serviceId ?? services[0]?.id),
  );
  if (!service) throw new DomainError("Choose an available treatment.");
  const staff = await db.staff.findMany({
    where: {
      businessId: DEMO_BUSINESS_ID,
      active: true,
      serviceIds: { has: service.id },
    },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 50,
  });
  const selectedStaff = staff.find(
    ({ id }) => id === (args.staffId ?? staff[0]?.id),
  );
  if (!selectedStaff)
    throw new DomainError("No team member provides the selected treatment.");
  const starts = await getAvailability(service.id, date, db, selectedStaff.id);
  return {
    demo: true,
    timezone: "Europe/Stockholm",
    currency: "SEK",
    bookingCreated: false,
    bookingEnabled,
    services,
    service,
    staff,
    selectedStaff,
    date,
    firstDate: today.toISODate()!,
    lastDate: today.plus({ days: 27 }).toISODate()!,
    days: Array.from(
      {
        length: Math.min(
          7,
          Math.floor(today.plus({ days: 27 }).diff(day, "days").days) + 1,
        ),
      },
      (_, i) => day.plus({ days: i }).toISODate()!,
    ),
    slots: starts.map((start) => ({
      start,
      end: DateTime.fromISO(start)
        .plus({ minutes: service.duration })
        .toUTC()
        .toISO()!,
    })),
    checkedAt: DateTime.now().toUTC().toISO()!,
    notice: "Time selection only. Selecting a time does not reserve it or create a booking.",
  };
}
