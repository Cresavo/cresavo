import { test } from "./fixtures";
import { PrismaClient } from "@prisma/client";
test("forced timeout exercises fixture teardown", async ({ synthetic }) => {
  const db = new PrismaClient();
  await db.booking.create({
    data: {
      businessId: "demo",
      staffId: synthetic.marker,
      serviceId: "massage",
      startsAt: new Date("2030-01-01T09:00:00Z"),
      endsAt: new Date("2030-01-01T09:30:00Z"),
      customerName: "Syntetisk timeout",
      customerEmail: `${synthetic.marker}@example.test`,
    },
  });
  await db.campaign.create({
    data: {
      businessId: "demo",
      serviceId: "massage",
      title: synthetic.title,
      discountPercent: 20,
      validFrom: "2030-01-01",
      validUntil: "2030-01-01",
    },
  });
  await db.$disconnect();
  test.setTimeout(1000);
  await new Promise(() => {});
});
