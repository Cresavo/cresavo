import { checkRateLimit } from "./rate-limit";
import { z } from "zod";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { Prisma, type Booking } from "@prisma/client";
import { db } from "./db";
import { DEMO_BUSINESS_ID } from "./config";
import { DomainError } from "./errors";
import { localDay, parseDay } from "./time";
import { dateSchema as date, idempotencyKeySchema } from "./validation";
export { idempotencyKeySchema } from "./validation";
import { weeklySchema, exceptionsSchema, scheduledSlots } from "./schedule";
import {
  lockConfiguration,
  assertWorkspaceActor,
  type WorkspaceActor,
} from "./workspace-write";

// Server-owned agent API channel prefix; the suffix is the AgentApiKey id.
export const AGENT_API_CHANNEL = "agent-api:key:";

const businessId = DEMO_BUSINESS_ID,
  staffId = "staff-demo";

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
  staffId: z.string().min(1).max(128).optional(),
  serviceVersion: z.number().int().min(1).optional(),
  start: z.iso.datetime({ offset: true }),
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
});
// Only authenticated admin callers can select a customer card. Public and
// existing local-agent bookings remain snapshots without an inferred identity.
export const adminBookingSchema = bookingSchema
  .extend({
    customerId: z.string().min(1).max(128).optional(),
    customerName: bookingSchema.shape.customerName.optional(),
    customerEmail: bookingSchema.shape.customerEmail.optional(),
  })
  .refine((v) => !!v.customerId || (!!v.customerName && !!v.customerEmail), {
    message: "Välj en kund eller fyll i namn och e-post.",
  });

export async function listServices(includeInactive = false) {
  return db.service.findMany({
    where: { businessId, ...(!includeInactive && { active: true }) },
    orderBy: { name: "asc" },
    take: 50,
  });
}

async function serviceById(
  id: string,
  client: Prisma.TransactionClient = db,
  includeInactive = false,
) {
  const service = await client.service.findFirst({
    where: { id, businessId, ...(!includeInactive && { active: true }) },
  });
  if (!service) throw new DomainError("Tjänsten finns inte");
  return service;
}

export async function getAvailability(
  serviceId: string,
  day: string,
  client: Prisma.TransactionClient = db,
  selectedStaff = "staff-demo",
  internal?: { ignoreBookingId: string; duration: number; buffer: number },
) {
  date.parse(day);
  const service = await serviceById(serviceId, client, !!internal);
  const staff = await client.staff.findFirst({
    where: { id: selectedStaff, businessId, active: true },
  });
  if (!staff || !staff.serviceIds.includes(serviceId))
    throw new DomainError("Medarbetaren kan inte utföra behandlingen");
  const minutes = internal
    ? internal.duration + internal.buffer
    : service.duration + service.buffer;
  const candidates = scheduledSlots(
    weeklySchema.parse(staff.weekly),
    exceptionsSchema.parse(staff.exceptions),
    day,
    minutes,
  );
  if (!candidates.length) return [];
  const start = parseDay(day).toUTC().toJSDate(),
    end = parseDay(day).plus({ days: 1 }).toUTC().toJSDate();
  const bookings = await client.booking.findMany({
    where: {
      businessId,
      staffId: selectedStaff,
      status: "confirmed",
      startsAt: { lt: end },
      endsAt: { gt: start },
      ...(internal && { id: { not: internal.ignoreBookingId } }),
    },
    select: { startsAt: true, endsAt: true },
  });
  return candidates.filter((value) => {
    const start = new Date(value).getTime();
    return !bookings.some(
      (b) =>
        start < b.endsAt.getTime() &&
        start + minutes * 60000 > b.startsAt.getTime(),
    );
  });
}

// Keep structured SQLSTATE detection for the raw INSERT: Prisma 7 wraps the
// driver cause; historical Prisma 6 errors used meta.code.
export async function insertBooking(
  client: Prisma.TransactionClient,
  data: Pick<
    Booking,
    | "id"
    | "businessId"
    | "staffId"
    | "serviceId"
    | "startsAt"
    | "endsAt"
    | "customerName"
    | "customerEmail"
    | "idempotencyKey"
    | "requestHash"
  > &
    Partial<
      Pick<
        Booking,
        | "clientKey"
        | "emailCapKey"
        | "serviceName"
        | "priceOre"
        | "duration"
        | "buffer"
        | "customerId"
      >
    >,
) {
  try {
    const rows = await client.$queryRaw<Booking[]>`INSERT INTO "Booking"
      ("id", "businessId", "staffId", "serviceId", "startsAt", "endsAt", "customerName", "customerEmail", "idempotencyKey", "requestHash", "clientKey", "emailCapKey", "serviceName", "priceOre", "duration", "buffer", "customerId")
      VALUES (${data.id}, ${data.businessId}, ${data.staffId}, ${data.serviceId}, ${data.startsAt}, ${data.endsAt},
        ${data.customerName}, ${data.customerEmail}, ${data.idempotencyKey}, ${data.requestHash}, ${data.clientKey ?? null}, ${data.emailCapKey ?? null}, ${data.serviceName ?? ""}, ${data.priceOre ?? 0}, ${data.duration ?? 0}, ${data.buffer ?? 0}, ${data.customerId ?? null}) RETURNING *`;
    return rows[0];
  } catch (e) {
    bookingDatabaseError(e);
  }
}

export function bookingDatabaseError(e: unknown): never {
  const driver =
    e instanceof Prisma.PrismaClientKnownRequestError
      ? e.meta?.driverAdapterError
      : undefined;
  const cause =
    typeof driver === "object" && driver !== null && "cause" in driver
      ? driver.cause
      : undefined;
  const sqlState =
    typeof cause === "object" && cause !== null && "originalCode" in cause
      ? cause.originalCode
      : e instanceof Prisma.PrismaClientKnownRequestError
        ? e.meta?.code
        : undefined;
  if (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2010" &&
    ["23P01", "40P01", "40001"].includes(String(sqlState))
  )
    throw new DomainError("Tiden är inte tillgänglig");
  throw e;
}

export function emailCapKey(email: string) {
  const [local, domain] = email.toLowerCase().split("@");
  return `${local.split("+")[0]}@${domain}`;
}

export function hashedEmailCapKey(key: string) {
  if (/^email-hmac-v1:[a-f0-9]{64}$/.test(key)) return key;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("EMAIL_CAP_CONFIG_INVALID");
  return `email-hmac-v1:${createHmac("sha256", secret)
    .update(`${businessId}:email:${key}`)
    .digest("hex")}`;
}

export async function createBooking(
  input: unknown,
  key?: string,
  clientAddress?: string,
  actor?: WorkspaceActor,
) {
  // Only the server supplies actors; assertWorkspaceActor rechecks the account
  // inside the transaction before replay or any privileged write.
  const admin = actor?.kind === "admin";
  const budgetAddress = admin ? `admin:${actor.id}` : clientAddress;
  const rateRoute = admin ? "admin-bookings" : "bookings";
  const mayLinkCustomer = !!actor;
  const parsed = (
    mayLinkCustomer ? adminBookingSchema : bookingSchema
  ).safeParse(input);
  if (!parsed.success) {
    if (budgetAddress) await checkRateLimit(rateRoute, budgetAddress);
    throw parsed.error;
  }
  const v = parsed.data;
  const selectedCustomerId =
    mayLinkCustomer && "customerId" in v ? v.customerId : undefined;
  const secret = process.env.SESSION_SECRET;
  if (budgetAddress && (!secret || secret.length < 32))
    throw new Error("CLIENT_KEY_CONFIG_INVALID");
  const clientKey = budgetAddress
    ? createHmac("sha256", secret!).update(budgetAddress).digest("hex")
    : null;
  const parsedKey = idempotencyKeySchema.optional().safeParse(key);
  if (!parsedKey.success) {
    if (budgetAddress) await checkRateLimit(rateRoute, budgetAddress);
    throw parsedKey.error;
  }
  const idempotencyKey =
    actor?.kind === "admin" && parsedKey.data
      ? createHash("sha256")
          .update(`admin:${actor.id}:${parsedKey.data}`)
          .digest("hex")
      : parsedKey.data;
  const start = new Date(v.start);
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ ...v, start: start.toISOString() }))
    .digest("hex");
  return db.$transaction(
    async (tx) => {
      await lockConfiguration(tx);
      if (actor) await assertWorkspaceActor(tx, actor);
      if (idempotencyKey) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:key:${idempotencyKey}`}))`;
        const existing = await tx.booking.findUnique({
          where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            if (budgetAddress) await checkRateLimit(rateRoute, budgetAddress);
            throw new DomainError(
              "Bokningsnyckeln har redan använts med andra uppgifter.",
              409,
            );
          }
          return {
            ...existing,
            startsAt: existing.initialStartsAt ?? existing.startsAt,
            endsAt: existing.initialEndsAt ?? existing.endsAt,
          };
        }
      }
      const customer = selectedCustomerId
        ? (
            await tx.$queryRaw<
              { id: string; name: string; email: string; archived: boolean }[]
            >`SELECT "id", "name", "email", "archived" FROM "Customer" WHERE "businessId"=${businessId} AND "id"=${selectedCustomerId} FOR SHARE`
          )[0]
        : undefined;
      if (selectedCustomerId && (!customer || customer.archived))
        throw new DomainError("Välj ett aktivt kundkort.", 409);
      if (
        actor?.kind === "local-mcp" &&
        customer &&
        !customer.email.endsWith("@example.test")
      )
        throw new DomainError("Välj ett aktivt kundkort.", 409);
      const customerName = customer?.name ?? v.customerName!;
      const customerEmail = customer?.email ?? v.customerEmail!;
      const emailKey = emailCapKey(customerEmail);
      const storedEmailKey = admin ? null : hashedEmailCapKey(emailKey);
      if (budgetAddress) await checkRateLimit(rateRoute, budgetAddress);
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
          })) >= (admin ? 100 : 5)
        )
          throw new DomainError(
            "För många försök. Försök igen senare.",
            429,
            retryAfter,
          );
      }
      if (!admin) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:email:${emailKey}:${today.toISODate()}`}))`;
        const count = await tx.booking.count({
          where: {
            businessId,
            // Count legacy plaintext rows as well as minimised/new rows. Keep
            // the same normalised email/day lock and the same daily budget.
            emailCapKey: { in: [emailKey, storedEmailKey!] },
            createdAt: dayRange,
          },
        });
        if (count >= 3)
          throw new DomainError(
            "För många försök. Försök igen senare.",
            429,
            retryAfter,
          );
      }
      const service = await serviceById(v.serviceId, tx);
      if (
        v.serviceVersion !== undefined &&
        v.serviceVersion !== service.version
      )
        throw new DomainError("Uppgifterna har ändrats. Läs in på nytt.", 409);
      const selectedStaff = v.staffId ?? staffId;
      // Lock order: idempotency, client/day, email/day, staff/booking day.
      // Serialise competing inserts before reading availability; exclusion remains the final guard.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:staff:${selectedStaff}:${localDay(start)}`}))`;
      if (
        !(
          await getAvailability(service.id, localDay(start), tx, selectedStaff)
        ).includes(start.toISOString())
      )
        throw new DomainError("Tiden är inte tillgänglig");
      const booking = await insertBooking(tx, {
        id: randomUUID(),
        businessId,
        staffId: selectedStaff,
        serviceName: service.name,
        priceOre: service.priceOre,
        duration: service.duration,
        buffer: service.buffer,
        serviceId: service.id,
        startsAt: start,
        endsAt: new Date(
          start.getTime() + (service.duration + service.buffer) * 60000,
        ),
        customerName,
        customerEmail,
        customerId: customer?.id ?? null,
        idempotencyKey: idempotencyKey ?? null,
        requestHash: idempotencyKey ? requestHash : null,
        clientKey,
        emailCapKey: storedEmailKey,
      });
      await tx.bookingEvent.create({
        data: {
          bookingId: booking.id,
          action: "create",
          actorKind:
            // These channel names come from server adapters, never booking input.
            actor?.kind ??
            (clientAddress === "mcp:local-booking-channel:v1"
              ? "local-mcp"
              : clientAddress?.startsWith(AGENT_API_CHANNEL)
                ? "agent-api"
                : "public"),
          actorId:
            actor?.id ??
            (clientAddress === "a2a:local-customer-demo:v1"
              ? "local-a2a-demo-channel:v1"
              : clientAddress?.startsWith(AGENT_API_CHANNEL)
                ? clientAddress.slice(AGENT_API_CHANNEL.length)
                : "booking-channel"),
          nextStart: booking.startsAt,
          nextEnd: booking.endsAt,
          nextStaffId: booking.staffId,
        },
      });
      return booking;
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
      where: { id: cursor, businessId, startsAt, status: "confirmed" },
      select: { id: true },
    });
    if (!previous)
      throw new DomainError("Ogiltig sidmarkör för datumintervallet");
  }

  return {
    where: { businessId, startsAt, status: "confirmed" },
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
      serviceId: true,
      serviceName: true,
    },
  });
  const limit = query.take - 1;
  const bookings = rows
    .slice(0, limit)
    .map(({ id, startsAt, endsAt, serviceId, serviceName }) => ({
      id,
      startsAt,
      endsAt,
      service: { id: serviceId, name: serviceName },
    }));
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
      serviceId: true,
      serviceName: true,
    },
  });
  const limit = query.take - 1;
  const bookings = rows
    .slice(0, limit)
    .map(({ serviceId, serviceName, ...booking }) => ({
      ...booking,
      customerEmail: "***@***",
      service: { id: serviceId, name: serviceName },
    }));
  return {
    ...range,
    bookings,
    nextCursor: rows.length > limit ? bookings[bookings.length - 1].id : null,
  };
}

export async function createCampaign(
  input: unknown,
  client: Prisma.TransactionClient = db,
) {
  const v = campaignSchema.parse(input);
  await serviceById(v.serviceId, client);
  return client.campaign.create({ data: { ...v, businessId } });
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
