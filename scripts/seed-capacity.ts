// Additive synthetic scenarios; never reset or rewrite existing bookings.
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../src/lib/db";
import { createAdminUser } from "../src/lib/admin-accounts";
import { createBooking } from "../src/lib/domain";
import { cancelBooking } from "../src/lib/booking-mutations";
import { DomainError } from "../src/lib/errors";
import { listCapacity, decideCapacity } from "../src/lib/capacity";
import { DEMO_ADMIN_EMAIL, demoAccessEnabled } from "../src/lib/demo-access";
import { rateLimitDatabase } from "../src/lib/postgres-rate-limit";
import { assertTestDatabase } from "./test-db-guard.mjs";

async function main() {
  if (process.env.BOOKING_DEMO_SEED !== "1")
    throw Error("CAPACITY_SEED_OPT_IN_REQUIRED");
  if (process.argv.includes("--preview")) {
    if (!demoAccessEnabled()) throw Error("CAPACITY_PREVIEW_REFUSED");
  } else {
    assertTestDatabase();
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_demo"))
      throw Error("CAPACITY_DEMO_DATABASE_REQUIRED");
  }
  let owner = await db.adminUser.findUnique({
    where: { email: DEMO_ADMIN_EMAIL },
  });
  if (!owner) {
    const created = await createAdminUser(
      DEMO_ADMIN_EMAIL,
      randomBytes(32).toString("hex"),
    );
    owner = await db.adminUser.findUniqueOrThrow({ where: { id: created.id } });
  }
  if (!owner.active || owner.businessId !== "demo")
    throw Error("CAPACITY_DEMO_ACTOR_REFUSED");
  const actor = { kind: "admin" as const, id: owner.id };
  const serviceId = "demo-capacity-massage",
    staffId = "demo-capacity-staff";
  await db.service.upsert({
    where: { id: serviceId },
    update: {},
    create: {
      id: serviceId,
      businessId: "demo",
      name: "Massage – kapacitetsdemo",
      duration: 30,
      priceOre: 45000,
    },
  });
  await db.staff.upsert({
    where: { id: staffId },
    update: {},
    create: {
      id: staffId,
      businessId: "demo",
      name: "Sam Demo",
      serviceIds: [serviceId],
      weekly: [1, 2, 3, 4, 5].map((weekday) => ({
        weekday,
        periods: [{ start: "09:00", end: "17:00" }],
        breaks: [{ start: "12:00", end: "13:00" }],
      })),
      exceptions: [],
    },
  });
  let day = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 1 })
    .startOf("day");
  while (day.weekday > 5) day = day.plus({ days: 1 });
  let skipped = 0;
  for (const [hour, scenario] of [
    [9, "available"],
    [10, "rebooked"],
    [11, "dismissed"],
    [13, "draft"],
  ] as const) {
    try {
      const start = day.set({ hour }).toUTC().toISO()!;
      const key = `capacity-v1-${day.toISODate()}-${scenario}`;
      const row = await createBooking(
        {
          serviceId,
          staffId,
          start,
          customerName: "Påhittad demokund",
          customerEmail: `capacity-${scenario}@example.test`,
        },
        key,
        undefined,
        actor,
      );
      // An idempotent replay is not proof of seed ownership or unchanged state.
      const current = await db.booking.findFirst({
        where: {
          id: row.id,
          businessId: "demo",
          serviceId,
          staffId,
          startsAt: new Date(start),
          events: {
            some: { action: "create", actorKind: "admin", actorId: owner.id },
          },
        },
      });
      if (!current) {
        skipped++;
        continue;
      }
      if (current.status === "confirmed")
        await cancelBooking(
          { id: current.id, expectedVersion: current.version },
          key + "-cancel",
          actor,
        );
      if (scenario === "rebooked") {
        await createBooking(
          {
            serviceId,
            staffId,
            start,
            customerName: "Påhittad ny demokund",
            customerEmail: "capacity-replacement@example.test",
          },
          key + "-replacement",
          undefined,
          actor,
        );
      } else if (scenario === "dismissed" || scenario === "draft") {
        const s = (await listCapacity({ limit: 20 }, actor)).suggestions.find(
          (x) => x.bookingId === current.id,
        );
        if (!s || !s.available || s.status !== "new") continue;
        const source = {
          bookingId: s.bookingId,
          sourceVersion: s.sourceVersion,
          expectedToken: s.expectedToken,
        };
        if (scenario === "dismissed")
          await decideCapacity(source, key + "-decision", actor, "dismiss");
        else
          await decideCapacity(
            {
              ...source,
              campaign: {
                serviceId,
                title: "Syntetiskt massageerbjudande",
                discountPercent: 10,
                validFrom: day.toISODate()!,
                validUntil: day.toISODate()!,
              },
            },
            key + "-decision",
            actor,
            "draft",
          );
      }
    } catch (error) {
      // Manual changes or occupied seed slots are preserved, never reset.
      if (error instanceof DomainError) skipped++;
      else throw error;
    }
  }
  console.log(
    JSON.stringify({
      synthetic: true,
      day: day.toISODate(),
      scenarios: 4,
      skipped,
      note: "Additivt; datum ändras endast vid uttrycklig körning. Inga utskick.",
    }),
  );
}
main()
  .catch(() => {
    console.error("CAPACITY_SEED_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
    await rateLimitDatabase.$disconnect();
  });
