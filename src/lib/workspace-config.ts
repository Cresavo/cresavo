import { isPublicReadonly, assertWritable } from "./public-readonly";
import { fixtureStaff } from "./public-fixtures";
import { randomUUID } from "node:crypto";
import type { Staff } from "@prisma/client";
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
    buffer: z.number().int().min(0).max(120).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine(identityValid);
export const staffEditSchema = z
  .object({
    ...identity,
    name: z.string().trim().min(2).max(80),
    active: z.boolean().optional(),
    serviceIds: z
      .array(z.string().min(1).max(128))
      .max(50)
      .refine((v) => new Set(v).size === v.length),
    weekly: weeklySchema,
    exceptions: exceptionsSchema.optional(),
  })
  .strict()
  .refine(identityValid);

function parsedStaff(row: Staff) {
  return {
    ...row,
    weekly: weeklySchema.parse(row.weekly),
    exceptions: exceptionsSchema.parse(row.exceptions),
  };
}
export async function getStaff(id: string) {
  const row = await db.staff.findFirst({
    where: { id: z.string().min(1).max(128).parse(id), businessId },
  });
  if (!row) throw new DomainError("Medarbetaren kan inte utföra behandlingen");
  return parsedStaff(row);
}
export async function listStaff(serviceId?: string, includeInactive = false) {
  if (isPublicReadonly()) return fixtureStaff().filter((s) => !serviceId || s.serviceIds.includes(serviceId));
  const rows = await db.staff.findMany({
    where: {
      businessId,
      ...(!includeInactive && { active: true }),
      ...(serviceId && { serviceIds: { has: serviceId } }),
    },
    orderBy: { name: "asc" },
    take: 20,
  });
  return rows.map(parsedStaff);
}
export async function saveService(
  input: unknown,
  requestId: string,
  actor: WorkspaceActor,
) {
  assertWritable();
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
  assertWritable();
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
          !(data.active ?? existing.active) ||
          !data.serviceIds.includes(b.serviceId) ||
          !scheduleContains(
            data.weekly,
            data.exceptions ?? exceptionsSchema.parse(existing.exceptions),
            b.startsAt,
            b.endsAt,
          ),
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
