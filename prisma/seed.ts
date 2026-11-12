import { createDatabaseClient } from "../scripts/database.mjs";
const db = createDatabaseClient();
async function main() {
  for (const service of [
    { id: "fotvard", name: "Fotvård", duration: 60, priceOre: 65000 },
    { id: "massage", name: "Massage", duration: 30, priceOre: 45000 },
  ])
    await db.service.upsert({
      where: { id: service.id },
      create: { ...service, businessId: "demo" },
      update: {},
    });
  for (const staff of [
    { id: "staff-demo", name: "Anna", start: "09:00", end: "17:00" },
    { id: "staff-erik", name: "Erik", start: "10:00", end: "16:00" },
  ]) {
    await db.staff.upsert({
      where: { id: staff.id },
      create: {
        id: staff.id,
        name: staff.name,
        businessId: "demo",
        serviceIds: ["fotvard", "massage"],
        weekly: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          periods: [{ start: staff.start, end: staff.end }],
          breaks: [],
        })),
        exceptions: [],
      },
      update: {},
    });
  }
}
main()
  .finally(() => db.$disconnect())
  .catch(() => {
    console.error("SEED_FAILED");
    process.exitCode = 1;
  });
