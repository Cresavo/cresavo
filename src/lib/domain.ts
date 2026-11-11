import { checkRateLimit } from "./rate-limit";
import { z } from "zod";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { Prisma, type Booking } from "@prisma/client";
import { db } from "./db";
import { DomainError } from "./errors";
import { localDay, parseDay, slotsForDay } from "./time";

const businessId = "demo",
  staffId = "staff-demo";
const date = z.string().refine((v) => {
  try {
    parseDay(v);
    return true;
  } catch {
    return false;
  }
}, "Ogiltigt datum");

export const campaignSchema = z
  .object({
    serviceId: z.string().min(1),
    title: z.string().trim().min(1).max(100),
    discountPercent: z.number().int().min(1).max(100),
    validFrom: date,
    validUntil: date,
  })
  .strict()
  .superRefine((v, ctx) => {
    try {
      const from = parseDay(v.validFrom),
        to = parseDay(v.validUntil);
      if (to < from)
        ctx.addIssue({
          code: "custom",
          message: "Slutdatum får inte vara före startdatum.",
        });
      else if (to > from.plus({ days: 89 }))
        ctx.addIssue({
          code: "custom",
          message: "Kampanjen får gälla högst 90 kalenderdagar.",
        });
    } catch {
      /* The field validators report invalid dates. */
    }
  });

export const bookingSchema = z.object({
  serviceId: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
});

export const idempotencyKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export async function listServices() {
  return db.service.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
  });
}

async function serviceById(id: string, client: Prisma.TransactionClient = db) {
  const service = await client.service.findFirst({ where: { id, businessId } });
  if (!service) throw new DomainError("Tjänsten finns inte");
  return service;
}

export async function getAvailability(
  serviceId: string,
  day: string,
  client: Prisma.TransactionClient = db,
) {
  date.parse(day);
  const service = await serviceById(serviceId, client);
  const candidates = slotsForDay(day, service.duration);
  if (!candidates.length) return [];

  const start = parseDay(day).toUTC().toJSDate(),
    end = parseDay(day).plus({ days: 1 }).toUTC().toJSDate();
  const bookings = await client.booking.findMany({
    where: {
      businessId,
      staffId,
      startsAt: { lt: end },
      endsAt: { gt: start },
    },
    select: { startsAt: true, endsAt: true },
  });
  return candidates
    .filter(
      (s) =>
        !bookings.some(
          (b) =>
            s.getTime() < b.endsAt.getTime() &&
            s.getTime() + service.duration * 60000 > b.startsAt.getTime(),
        ),
    )
    .map((s) => s.toISOString());
}

// Prisma 6's ORM create exposes exclusion failures as UnknownRequestError.
// A parameterized INSERT exposes PostgreSQL SQLSTATE in P2010.meta.code instead.
export async function insertBooking(
  client: Prisma.TransactionClient,
  data: Omit<Booking, "createdAt" | "clientKey" | "emailCapKey"> &
    Partial<Pick<Booking, "clientKey" | "emailCapKey">>,
) {
  try {
    const rows = await client.$queryRaw<Booking[]>`INSERT INTO "Booking"
      ("id", "businessId", "staffId", "serviceId", "startsAt", "endsAt", "customerName", "customerEmail", "idempotencyKey", "requestHash", "clientKey", "emailCapKey")
      VALUES (${data.id}, ${data.businessId}, ${data.staffId}, ${data.serviceId}, ${data.startsAt}, ${data.endsAt},
        ${data.customerName}, ${data.customerEmail}, ${data.idempotencyKey}, ${data.requestHash}, ${data.clientKey ?? null}, ${data.emailCapKey ?? null}) RETURNING *`;
    return rows[0];
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2010" &&
      ["23P01", "40P01", "40001"].includes(String(e.meta?.code))
    )
      throw new DomainError("Tiden är inte tillgänglig");
    throw e;
  }
}

export function emailCapKey(email: string) {
  const [local, domain] = email.toLowerCase().split("@");
  return `${local.split("+")[0]}@${domain}`;
}

export async function createBooking(
  input: unknown,
  key?: string,
  clientAddress?: string,
) {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    if (clientAddress) checkRateLimit("bookings", clientAddress);
    throw parsed.error;
  }
  const v = parsed.data;
  const emailKey = emailCapKey(v.customerEmail);
  const secret = process.env.SESSION_SECRET;
  if (clientAddress && (!secret || secret.length < 32))
    throw new Error("CLIENT_KEY_CONFIG_INVALID");
  const clientKey = clientAddress
    ? createHmac("sha256", secret!).update(clientAddress).digest("hex")
    : null;
  const parsedKey = idempotencyKeySchema.optional().safeParse(key);
  if (!parsedKey.success) {
    if (clientAddress) checkRateLimit("bookings", clientAddress);
    throw parsedKey.error;
  }
  const idempotencyKey = parsedKey.data;
  const start = new Date(v.start);
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ ...v, start: start.toISOString() }))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      if (idempotencyKey) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:key:${idempotencyKey}`}))`;
        const existing = await tx.booking.findUnique({
          where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            if (clientAddress) checkRateLimit("bookings", clientAddress);
            throw new DomainError(
              "Bokningsnyckeln har redan använts med andra uppgifter.",
              409,
            );
          }
          return existing;
        }
      }
      if (clientAddress) checkRateLimit("bookings", clientAddress);
      const today = parseDay(localDay(new Date()));
      const tomorrow = today.plus({ days: 1 });
      const dayRange = { gte: today.toJSDate(), lt: tomorrow.toJSDate() };
      const retryAfter = Math.max(
        1,
        Math.ceil((tomorrow.toMillis() - Date.now()) / 1000),
      );
      if (clientKey) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:client:${clientKey}:${today.toISODate()}`}))`;
        if (
          (await tx.booking.count({
            where: { businessId, clientKey, createdAt: dayRange },
          })) >= 5
        )
          throw new DomainError(
            "För många försök. Försök igen senare.",
            429,
            retryAfter,
          );
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:email:${emailKey}:${today.toISODate()}`}))`;
      const count = await tx.booking.count({
        where: {
          businessId,
          emailCapKey: emailKey,
          createdAt: dayRange,
        },
      });
      if (count >= 3)
        throw new DomainError(
          "För många försök. Försök igen senare.",
          429,
          Math.max(1, Math.ceil((tomorrow.toMillis() - Date.now()) / 1000)),
        );
      const service = await serviceById(v.serviceId, tx);
      // Lock order: idempotency, client/day, email/day, staff/booking day.
      // Serialise competing inserts before reading availability; exclusion remains the final guard.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:staff:${staffId}:${localDay(start)}`}))`;
      if (
        !(await getAvailability(service.id, localDay(start), tx)).includes(
          start.toISOString(),
        )
      )
        throw new DomainError("Tiden är inte tillgänglig");
      return insertBooking(tx, {
        id: randomUUID(),
        businessId,
        staffId,
        serviceId: service.id,
        startsAt: start,
        endsAt: new Date(start.getTime() + service.duration * 60000),
        customerName: v.customerName,
        customerEmail: v.customerEmail,
        idempotencyKey: idempotencyKey ?? null,
        requestHash: idempotencyKey ? requestHash : null,
        clientKey,
        emailCapKey: emailKey,
      });
    },
    { maxWait: 30000, timeout: 30000 },
  );
}

// End dates are inclusive Stockholm calendar dates; the database range is half-open.
export const bookingListSchema = z
  .object({
    from: date.describe(
      "Första datum YYYY-MM-DD i Europe/Stockholm, inklusive",
    ),
    to: date.describe(
      "Sista datum YYYY-MM-DD i Europe/Stockholm, inklusive; högst 31 dagar",
    ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Antal per sida, 1–100; standard 20"),
    cursor: z
      .string()
      .min(1)
      .max(128)
      .optional()
      .describe("nextCursor från föregående sida för samma datumintervall"),
  })
  .strict()
  .refine((v) => {
    try {
      const from = parseDay(v.from),
        to = parseDay(v.to);
      return to >= from && to <= from.plus({ days: 30 });
    } catch {
      return false;
    }
  }, "Ogiltigt datumintervall; ange högst 31 dagar");

async function bookingListQuery(input: unknown) {
  const { from, to, limit, cursor } = bookingListSchema.parse(input);
  const startsAt = {
    gte: parseDay(from).toUTC().toJSDate(),
    lt: parseDay(to).plus({ days: 1 }).toUTC().toJSDate(),
  };

  if (cursor) {
    const previous = await db.booking.findFirst({
      where: { id: cursor, businessId, startsAt },
      select: { id: true },
    });
    if (!previous)
      throw new DomainError("Ogiltig sidmarkör för datumintervallet");
  }

  return {
    where: { businessId, startsAt },
    orderBy: [{ startsAt: "asc" as const }, { id: "asc" as const }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  };
}

export async function listBookingsForMcp(input: unknown) {
  const query = await bookingListQuery(input);
  const rows = await db.booking.findMany({
    ...query,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      service: { select: { id: true, name: true } },
    },
  });
  const limit = query.take - 1;
  const bookings = rows.slice(0, limit);
  return {
    bookings,
    nextCursor: rows.length > limit ? bookings[bookings.length - 1].id : null,
  };
}

export function defaultBookingRange() {
  const today = parseDay(localDay(new Date()));
  return {
    from: today.toISODate()!,
    to: today.plus({ days: 14 }).toISODate()!,
  };
}

export async function listBookings(
  input: { from?: string; to?: string; limit?: number; cursor?: string } = {},
) {
  const range = { ...defaultBookingRange(), ...input };
  const query = await bookingListQuery(range);
  const rows = await db.booking.findMany({
    ...query,
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      customerName: true,
      customerEmail: true,
      service: { select: { id: true, name: true } },
    },
  });
  const limit = query.take - 1;
  const bookings = rows
    .slice(0, limit)
    .map((b) => ({ ...b, customerEmail: "***@***" }));
  return {
    ...range,
    bookings,
    nextCursor: rows.length > limit ? bookings[bookings.length - 1].id : null,
  };
}

export async function createCampaign(input: unknown) {
  const v = campaignSchema.parse(input);
  await serviceById(v.serviceId);
  return db.campaign.create({ data: { ...v, businessId } });
}

export async function listCampaigns() {
  return db.campaign.findMany({
    where: { businessId },
    include: { service: true },
    orderBy: { validFrom: "desc" },
  });
}

export async function publicCampaigns(day: string) {
  date.parse(day);
  return db.campaign.findMany({
    where: {
      businessId,
      published: true,
      validFrom: { lte: day },
      validUntil: { gte: day },
    },
    include: { service: true },
  });
}

export async function publishCampaign(id: string) {
  const result = await db.campaign.updateMany({
    where: { id, businessId },
    data: { published: true },
  });
  if (!result.count) throw new DomainError("Utkastet finns inte");
}

export function adminBookingFilter(input: {
  from?: unknown;
  to?: unknown;
  cursor?: unknown;
}) {
  const parsed = bookingListSchema.safeParse({
    ...defaultBookingRange(),
    ...input,
    limit: 100,
  });
  return parsed.success
    ? { filter: parsed.data, error: null }
    : {
        filter: { ...defaultBookingRange(), limit: 100 },
        error:
          "Ogiltigt datumfilter. Visar standardintervallet; ange högst 31 dagar i rätt ordning.",
      };
}
