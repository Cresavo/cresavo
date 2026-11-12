import { z } from "zod";
import type { Customer, Prisma } from "@prisma/client";
import { db } from "./db";
import { DEMO_BUSINESS_ID as businessId } from "./config";
import { DomainError } from "./errors";
import { demoAccessEnabled } from "./demo-access";
import {
  assertWorkspaceActor,
  workspaceWrite,
  type WorkspaceActor,
} from "./workspace-write";

const id = z.string().min(1).max(128);
const fields = {
  name: z.string().trim().min(2).max(80),
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/)
    .nullable()
    .optional(),
};
export const customerCreateSchema = z.object(fields).strict();
export const customerEditSchema = z
  .object({
    id,
    expectedVersion: z.number().int().positive(),
    name: fields.name,
    email: fields.email.optional(),
    phone: fields.phone,
    archived: z.boolean(),
  })
  .strict();
export const customerListSchema = z
  .object({
    q: z.string().trim().max(80).default(""),
    archived: z.enum(["active", "all"]).default("active"),
    cursor: id.optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();
export const customerHistorySchema = z
  .object({
    view: z.enum(["upcoming", "history"]).default("upcoming"),
    cursor: id.optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

// No auto-merging by name or unverified email. No contact in mutation ledger.
export async function createCustomer(
  input: unknown,
  key: string,
  actor: WorkspaceActor,
) {
  const value = customerCreateSchema.parse(input);
  return workspaceWrite(
    "create_customer",
    value,
    key,
    actor,
    false,
    async (tx) => {
      const row = await tx.customer.create({
        data: { ...value, phone: value.phone || null, businessId },
      });
      return { id: row.id, version: row.version };
    },
  );
}
export async function editCustomer(
  input: unknown,
  key: string,
  actor: WorkspaceActor,
) {
  const value = customerEditSchema.parse(input);
  return workspaceWrite(
    "edit_customer",
    value,
    key,
    actor,
    false,
    async (tx) => {
      const [row] = await tx.$queryRaw<
        Customer[]
      >`SELECT * FROM "Customer" WHERE "businessId"=${businessId} AND "id"=${value.id} FOR UPDATE`;
      if (!row) throw new DomainError("Kunden finns inte", 404);
      if (row.version !== value.expectedVersion)
        throw new DomainError("Uppgifterna har ändrats. Läs in på nytt.", 409);
      const updated = await tx.customer.update({
        where: { id: row.id },
        data: {
          name: value.name,
          ...(value.email !== undefined && { email: value.email }),
          ...(value.phone !== undefined && { phone: value.phone || null }),
          archived: value.archived,
          version: { increment: 1 },
        },
      });
      return { id: updated.id, version: updated.version };
    },
  );
}
async function customerById(tx: Prisma.TransactionClient, value: string) {
  if (!id.safeParse(value).success)
    throw new DomainError("Kunden finns inte", 404);
  const row = await tx.customer.findFirst({
    where: { id: id.parse(value), businessId },
  });
  if (!row) throw new DomainError("Kunden finns inte", 404);
  return row;
}
export async function getCustomer(value: string, actor: WorkspaceActor) {
  return db.$transaction(async (tx) => {
    await assertWorkspaceActor(tx, actor);
    const row = await customerById(tx, value);
    // Web demo exception never extends to local MCP or non-demo deployments.
    const contactVisible =
      actor.kind === "admin" &&
      demoAccessEnabled() &&
      row.email.endsWith("@example.test");
    return {
      id: row.id,
      name: row.name,
      archived: row.archived,
      version: row.version,
      email: contactVisible ? row.email : "***@***",
      phone: contactVisible ? row.phone : null,
      contactVisible,
    };
  });
}
export async function listCustomers(input: unknown, actor: WorkspaceActor) {
  const value = customerListSchema.parse(input);
  return db.$transaction(async (tx) => {
    await assertWorkspaceActor(tx, actor);
    const where: Prisma.CustomerWhereInput = {
      businessId,
      ...(value.archived === "active" && { archived: false }),
      ...(value.q && {
        OR: ["name", "email", "phone"].map((field) => ({
          [field]: { contains: value.q, mode: "insensitive" },
        })),
      }),
    };
    if (
      value.cursor &&
      !(await tx.customer.findFirst({
        where: { ...where, id: value.cursor },
        select: { id: true },
      }))
    )
      throw new DomainError("Sökningen har ändrats. Börja från första sidan.");
    const rows = await tx.customer.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: value.limit + 1,
      ...(value.cursor && { cursor: { id: value.cursor }, skip: 1 }),
      select: { id: true, name: true, archived: true },
    });
    const customers = rows.slice(0, value.limit);
    const ids = customers.map((c) => c.id),
      now = new Date();
    const [next, previous] = await Promise.all([
      tx.booking.groupBy({
        by: ["customerId"],
        where: {
          businessId,
          customerId: { in: ids },
          status: "confirmed",
          startsAt: { gte: now },
        },
        _min: { startsAt: true },
      }),
      tx.booking.groupBy({
        by: ["customerId"],
        where: {
          businessId,
          customerId: { in: ids },
          status: "confirmed",
          endsAt: { lt: now },
        },
        _max: { startsAt: true },
      }),
    ]);
    return {
      customers: customers.map((c) => ({
        ...c,
        nextVisit:
          next
            .find((b) => b.customerId === c.id)
            ?._min.startsAt?.toISOString() ?? null,
        lastVisit:
          previous
            .find((b) => b.customerId === c.id)
            ?._max.startsAt?.toISOString() ?? null,
      })),
      nextCursor: rows.length > value.limit ? customers.at(-1)!.id : null,
    };
  });
}
export async function customerBookings(
  customerId: string,
  input: unknown,
  actor: WorkspaceActor,
) {
  const value = customerHistorySchema.parse(input);
  return db.$transaction(async (tx) => {
    await assertWorkspaceActor(tx, actor);
    await customerById(tx, customerId);
    const now = new Date();
    const where: Prisma.BookingWhereInput = {
      businessId,
      customerId,
      ...(value.view === "upcoming"
        ? { status: "confirmed", startsAt: { gte: now } }
        : { OR: [{ startsAt: { lt: now } }, { status: "cancelled" }] }),
    };
    if (
      value.cursor &&
      !(await tx.booking.findFirst({
        where: { ...where, id: value.cursor },
        select: { id: true },
      }))
    )
      throw new DomainError("Historiken har ändrats. Börja från första sidan.");
    const direction = value.view === "upcoming" ? "asc" : "desc";
    const rows = await tx.booking.findMany({
      where,
      orderBy: [{ startsAt: direction }, { id: direction }],
      take: value.limit + 1,
      ...(value.cursor && { cursor: { id: value.cursor }, skip: 1 }),
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        serviceName: true,
        customerName: true,
        status: true,
        serviceId: true,
        staffId: true,
        priceOre: true,
      },
    });
    return {
      bookings: rows.slice(0, value.limit),
      nextCursor: rows.length > value.limit ? rows[value.limit - 1].id : null,
    };
  });
}
