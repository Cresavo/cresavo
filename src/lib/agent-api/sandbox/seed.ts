import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { weeklySchema } from "../../schedule";

export const SANDBOX_SEED = Object.freeze({
  version: 1,
  service: { name: "Demo massage", duration: 30, priceOre: 45000 },
  staff: { name: "Demo therapist" },
  weekly: weeklySchema.parse([1, 2, 3, 4, 5].map(weekday => ({
    weekday, periods: [{ start: "09:00", end: "16:00" }], breaks: [],
  }))),
});

export async function seedSandboxSalon(tx: Prisma.TransactionClient, businessId: string) {
  const serviceId = randomUUID();
  await tx.service.create({ data: { id: serviceId, businessId, ...SANDBOX_SEED.service } });
  await tx.staff.create({ data: {
    id: randomUUID(), businessId, ...SANDBOX_SEED.staff, serviceIds: [serviceId], weekly: SANDBOX_SEED.weekly,
  } });
}
