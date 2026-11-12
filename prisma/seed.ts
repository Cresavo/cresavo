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
      update: { ...service, businessId: "demo" },
    });
}
main()
  .finally(() => db.$disconnect())
  .catch(() => {
    console.error("SEED_FAILED");
    process.exitCode = 1;
  });
