import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db";
import { DEMO_BUSINESS_ID as businessId } from "./config";
import { DomainError } from "./errors";
import { weeklySchema, exceptionsSchema, scheduleContains } from "./schedule";
import { workspaceWrite, type WorkspaceActor } from "./workspace-write";

const identity = {
  id: z.string().min(1).max(128).optional(),
  expectedVersion: z.number().int().min(1).optional(),
};
const identityValid = (v: { id?: string; expectedVersion?: number }) =>
  !!v.id === !!v.expectedVersion;
export const serviceEditSchema = z
  .object({
    ...identity,
    name: z.string().trim().min(2).max(80),
    priceOre: z.number().int().min(0).max(10000000),
    duration: z.number().int().min(5).max(480),
    buffer: z.number().int().min(0).max(120).default(0),
    active: z.boolean().default(true),
  })
  .strict()
  .refine(identityValid);
export const staffEditSchema = z
  .object({
    ...identity,
    name: z.string().trim().min(2).max(80),
    active: z.boolean().default(true),
    serviceIds: z
      .array(z.string().min(1).max(128))
      .max(50)
      .refine((v) => new Set(v).size === v.length),
    weekly: weeklySchema,
    exceptions: exceptionsSchema.default([]),
  })
  .strict()
  .refine(identityValid);

export async function listStaff(serviceId?: string, includeInactive = false) {
  return db.staff.findMany({
    where: {
      businessId,
      ...(!includeInactive && { active: true }),
      ...(serviceId && { serviceIds: { has: serviceId } }),
    },
    orderBy: { name: "asc" },
    take: 20,
  });
}
export async function saveService(
  input: unknown,
  requestId: string,
  actor: WorkspaceActor,
) {
  const v = serviceEditSchema.parse(input);
  return workspaceWrite(
    "save_service",
    v,
    requestId,
    actor,
    true,
    async (tx) => {
      const { id, expectedVersion, ...data } = v;
      if (!id) {
        if ((await tx.service.count({ where: { businessId } })) >= 50)
          throw new DomainError("För många resurser");
        const row = await tx.service.create({
          data: { ...data, id: randomUUID(), businessId },
        });
        return { id: row.id, version: row.version };
      }
      const result = await tx.service.updateMany({
        where: { id, businessId, version: expectedVersion },
        data: { ...data, version: { increment: 1 } },
      });
      if (!result.count)
        throw new DomainError("Uppgifterna har ändrats. Läs in på nytt.", 409);
      return { id, version: expectedVersion! + 1 };
    },
  );
}

export async function saveStaff(
  input: unknown,
  requestId: string,
  actor: WorkspaceActor,
) {
  const v = staffEditSchema.parse(input);
  return workspaceWrite("save_staff", v, requestId, actor, true, async (tx) => {
    if (
      (await tx.service.count({
        where: { businessId, id: { in: v.serviceIds } },
      })) !== v.serviceIds.length
    )
      throw new DomainError("Tjänsten finns inte");
    const { id, expectedVersion, ...data } = v;
    if (!id) {
      if ((await tx.staff.count({ where: { businessId } })) >= 20)
        throw new DomainError("För många resurser");
      const row = await tx.staff.create({
        data: { ...data, id: randomUUID(), businessId },
      });
      return { id: row.id, version: row.version };
    }
    const existing = await tx.staff.findFirst({
      where: { id, businessId, version: expectedVersion },
      select: { id: true },
    });
    if (!existing)
      throw new DomainError("Uppgifterna har ändrats. Läs in på nytt.", 409);
    const upcoming = await tx.booking.findMany({
      where: {
        businessId,
        staffId: id,
        status: "confirmed",
        endsAt: { gt: new Date() },
      },
    });
    if (
      upcoming.some(
        (b) =>
          !data.active ||
          !data.serviceIds.includes(b.serviceId) ||
          !scheduleContains(data.weekly, data.exceptions, b.startsAt, b.endsAt),
      )
    )
      throw new DomainError(
        "Ändringen berör bokade tider. Flytta eller avboka dem först.",
        409,
      );
    await tx.staff.update({
      where: { id },
      data: { ...data, version: { increment: 1 } },
    });
    return { id, version: expectedVersion! + 1 };
  });
}
