// Synthetic demonstration data only. Additive and rerunnable; never reset a database.
import { randomBytes, createHash } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../src/lib/db";
import { createAdminUser } from "../src/lib/admin-accounts";
import { createBooking, getAvailability } from "../src/lib/domain";
import { cancelBooking, moveBooking } from "../src/lib/booking-mutations";
import {
  scheduleContains,
  weeklySchema,
  exceptionsSchema,
} from "../src/lib/schedule";
import { DEMO_ADMIN_EMAIL, demoAccessEnabled } from "../src/lib/demo-access";
import { rateLimitDatabase } from "../src/lib/postgres-rate-limit";
import { assertTestDatabase } from "./test-db-guard.mjs";

async function main() {
  if (process.env.BOOKING_DEMO_SEED !== "1")
    throw Error("DEMO_SEED_EXPLICIT_OPT_IN_REQUIRED");
  if (process.argv.includes("--preview")) {
    if (!demoAccessEnabled()) throw Error("DEMO_SEED_PREVIEW_REFUSED");
  } else {
    assertTestDatabase();
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_demo"))
      throw Error("DEMO_SEED_REQUIRES_DEMO_DATABASE");
  }
  const today = DateTime.now().setZone("Europe/Stockholm").startOf("day");
  const weekday = (offset: number) => {
    let d = today.plus({ days: offset });
    while (d.weekday > 5) d = d.plus({ days: 1 });
    return d;
  };
  const full = weekday(1),
    leave = weekday(5),
    partial = weekday(3);
  const services = [
    {
      id: "demo-ui-massage",
      name: "Avslappnande massage",
      duration: 30,
      priceOre: 45000,
    },
    {
      id: "demo-ui-foot",
      name: "Fotvård – demo",
      duration: 60,
      priceOre: 65000,
    },
    {
      id: "demo-ui-hair",
      name: "Klippning – demo",
      duration: 45,
      priceOre: 55000,
    },
  ];
  for (const s of services)
    await db.service.upsert({
      where: { id: s.id },
      create: { ...s, businessId: "demo" },
      update: {},
    });
  const weekly = Array.from({ length: 5 }, (_, i) => ({
    weekday: i + 1,
    periods: [{ start: "09:00", end: "17:00" }],
    breaks: [{ start: "12:00", end: "13:00" }],
  }));
  for (const [id, name] of [
    ["demo-ui-sofia", "Sofia (demo)"],
    ["demo-ui-elias", "Elias (demo)"],
  ])
    await db.staff.upsert({
      where: { id },
      create: {
        id,
        name,
        businessId: "demo",
        active: true,
        serviceIds: services.map((s) => s.id),
        weekly,
        exceptions: id.endsWith("sofia")
          ? [{ date: leave.toISODate()!, periods: [], breaks: [] }]
          : [],
      },
      update: {},
    });
  let admin = await db.adminUser.findUnique({
    where: { email: DEMO_ADMIN_EMAIL },
  });
  if (!admin) {
    await createAdminUser(
      DEMO_ADMIN_EMAIL,
      randomBytes(32).toString("base64url"),
    );
    admin = await db.adminUser.findUniqueOrThrow({
      where: { email: DEMO_ADMIN_EMAIL },
    });
  }
  if (!admin.active || admin.businessId !== "demo")
    throw Error("DEMO_SEED_ACTOR_REFUSED");
  const actor = { kind: "admin", id: admin.id } as const;
  const names = [
    "Mira Demo",
    "Alex Demo",
    "Kim Demo",
    "Robin Demo",
    "Noor Demo",
    "Sam Demo",
    "Lo Demo",
    "Charlie Demo",
    "Lee Demo",
    "Charlie B Demo",
    "Liv Demo",
    "Elli Demo",
    "Nico Demo",
    "Sasha Demo",
    "Mio Demo",
    "Rio Demo",
    "Juno Demo",
    "Lykke Demo",
    "Eden Demo",
    "Billie Demo",
    "Taylor Demo",
    "Frankie Demo",
    "Ariel Demo",
    "Lou Demo",
    "Dani Demo",
    "Remi Demo",
    "Toni Demo",
    "Signe Demo",
    "Malte Demo",
    "Iris Demo",
    "Alva Demo",
    "Otto Demo",
  ];
  for (const [index, name] of names.entries())
    await db.customer.upsert({
      where: { id: `demo-customer-${index}` },
      create: {
        id: `demo-customer-${index}`,
        businessId: "demo",
        name,
        email: `demo-customer-${index}@example.test`,
      },
      update: {},
    });
  let added = 0,
    skipped = 0,
    existing = 0;
  async function add(
    day: DateTime,
    hour: number,
    minute: number,
    staffId: string,
    serviceId: string,
    index: number,
    cancelled = false,
    moved = false,
  ) {
    const start = day.set({ hour, minute }),
      key =
        "demo-v1-" +
        createHash("sha256")
          .update(`${day.toISODate()}:${hour}:${minute}:${staffId}`)
          .digest("hex")
          .slice(0, 36);
    // Admin creation namespaces idempotency keys; this tag also identifies past rows.
    const email = `demo-customer-${index % names.length}@example.test`;
    const adminKey = createHash("sha256")
      .update(`admin:${actor.id}:${key}`)
      .digest("hex");
    const previous = await db.booking.findFirst({
      where: {
        businessId: "demo",
        OR: [{ idempotencyKey: key }, { idempotencyKey: adminKey }],
      },
      include: {
        events: {
          where: { action: "create", actorKind: "admin", actorId: actor.id },
          select: { nextStaffId: true },
          take: 1,
        },
      },
    });
    if (previous) {
      // A client-chosen key is not proof of ownership. Only our persisted
      // admin create event can authorize a backfill or an existing-seed count.
      const ownedKey =
        previous.idempotencyKey === adminKey ||
        (previous.idempotencyKey === key && previous.id === key);
      if (
        !ownedKey ||
        !previous.events.length ||
        previous.serviceId !== serviceId ||
        (previous.initialStartsAt ?? previous.startsAt).getTime() !==
          start.toMillis() ||
        (previous.events[0].nextStaffId &&
          previous.events[0].nextStaffId !== staffId)
      ) {
        skipped++;
        return; // Preserve colliding public/manual rows without adopting them.
      }
      // Explicit backfill only for this exact seed-owned row and matching
      // synthetic snapshot, never a customer-email identity heuristic.
      const profile = await db.customer.findFirst({
        where: {
          businessId: "demo",
          id: { startsWith: "demo-customer-" },
          name: previous.customerName,
          email: previous.customerEmail,
        },
      });
      if (!previous.customerId && profile)
        await db.booking.updateMany({
          where: { id: previous.id, businessId: "demo", customerId: null },
          data: { customerId: profile.id },
        });
      existing++;
      return;
    }
    const service = await db.service.findUniqueOrThrow({
        where: { id: serviceId },
      }),
      person = await db.staff.findUniqueOrThrow({ where: { id: staffId } });
    const end = start.plus({ minutes: service.duration + service.buffer });
    if (
      !scheduleContains(
        weeklySchema.parse(person.weekly),
        exceptionsSchema.parse(person.exceptions),
        start.toJSDate(),
        end.toJSDate(),
      )
    ) {
      skipped++;
      return;
    }
    if (start > DateTime.now()) {
      const slots = await getAvailability(
        serviceId,
        day.toISODate()!,
        undefined,
        staffId,
      );
      if (!slots.some((v) => new Date(v).getTime() === start.toMillis())) {
        skipped++;
        return;
      }
      const b = await createBooking(
        {
          serviceId,
          staffId,
          start: start.toUTC().toISO()!,
          customerName: names[index % names.length],
          customerEmail: email,
          customerId: `demo-customer-${index % names.length}`,
        },
        key,
        undefined,
        actor,
      );
      if (cancelled)
        await cancelBooking(
          { id: b.id, expectedVersion: b.version },
          key + "-cancel",
          actor,
        );
      else if (moved) {
        const nextStart = start.plus({ minutes: 30 }).toUTC().toISO()!;
        if (
          (
            await getAvailability(
              serviceId,
              day.toISODate()!,
              undefined,
              staffId,
              { ignoreBookingId: b.id, duration: b.duration, buffer: b.buffer },
            )
          ).includes(nextStart)
        )
          await moveBooking(
            { id: b.id, expectedVersion: b.version, staffId, start: nextStart },
            key + "-move",
            actor,
          );
      }
    } else {
      // Past demonstrations cannot pass today's booking clock. Validate their
      // schedule explicitly, keep the DB exclusion constraint, and mark history
      // with the dedicated demo actor rather than a verified personal identity.
      if (
        await db.booking.count({
          where: {
            businessId: "demo",
            staffId,
            status: "confirmed",
            startsAt: { lt: end.toJSDate() },
            endsAt: { gt: start.toJSDate() },
          },
        })
      ) {
        skipped++;
        return;
      }
      await db.booking.create({
        data: {
          id: key,
          businessId: "demo",
          staffId,
          serviceId,
          serviceName: service.name,
          duration: service.duration,
          buffer: service.buffer,
          priceOre: service.priceOre,
          customerName: names[index % names.length],
          customerEmail: email,
          customerId: `demo-customer-${index % names.length}`,
          startsAt: start.toJSDate(),
          endsAt: end.toJSDate(),
          initialStartsAt: start.toJSDate(),
          initialEndsAt: end.toJSDate(),
          status: cancelled ? "cancelled" : "confirmed",
          idempotencyKey: key,
          createdAt: start.minus({ days: 2 }).toJSDate(),
          events: {
            create: [
              {
                action: "create",
                actorKind: "admin",
                actorId: actor.id,
                createdAt: start.minus({ days: 2 }).toJSDate(),
              },
              ...(cancelled
                ? [
                    {
                      action: "cancel",
                      actorKind: "admin",
                      actorId: actor.id,
                      createdAt: start.minus({ hours: 2 }).toJSDate(),
                    },
                  ]
                : []),
            ],
          },
        },
      });
    }
    added++;
  }
  const sofia = "demo-ui-sofia",
    elias = "demo-ui-elias";
  for (const [h, m, p, s, i] of [
    [9, 0, sofia, "demo-ui-foot", 0],
    [10, 0, elias, "demo-ui-massage", 1],
    [10, 30, sofia, "demo-ui-hair", 2],
    [13, 0, elias, "demo-ui-massage", 3],
    [14, 0, sofia, "demo-ui-foot", 4],
    [15, 0, elias, "demo-ui-hair", 5],
  ] as const)
    await add(today, h, m, p, s, i);
  let n = 10;
  for (let h = 9; h < 17; h++) {
    if (h === 12) continue;
    for (const m of [0, 30])
      await add(full, h, m, sofia, "demo-ui-massage", n++);
  }
  await add(full, 10, 0, elias, "demo-ui-hair", 30);
  await add(full, 14, 0, elias, "demo-ui-foot", 31);
  for (const offset of [3, 7, 14]) {
    const day = weekday(offset);
    await add(day, 9, 0, elias, "demo-ui-foot", 40 + offset);
    await add(day, 13, 0, elias, "demo-ui-massage", 50 + offset);
    await add(day, 15, 0, sofia, "demo-ui-hair", 60 + offset, offset === 7);
  }
  let past = today.minus({ days: 1 });
  while (past.weekday > 5) past = past.minus({ days: 1 });
  await add(past, 9, 0, sofia, "demo-ui-foot", 80);
  await add(past, 11, 0, elias, "demo-ui-hair", 81, true);
  for (const [index, offset] of [10, 17, 24, 31].entries()) {
    const day = weekday(offset);
    await add(
      day,
      9,
      0,
      sofia,
      "demo-ui-massage",
      index * 4,
      false,
      index === 0,
    );
    await add(day, 10, 0, elias, "demo-ui-hair", index * 4 + 1);
    await add(day, 13, 0, sofia, "demo-ui-foot", index * 4 + 2);
    await add(day, 15, 0, elias, "demo-ui-massage", index * 4 + 3, index === 2);
  }
  let history = today.minus({ days: 2 });
  for (let index = 0; index < 10; index++) {
    while (history.weekday > 5) history = history.minus({ days: 1 });
    await add(history, 9, 0, sofia, "demo-ui-foot", 20 + index);
    await add(history, 10, 30, elias, "demo-ui-hair", 24 + index, index === 3);
    await add(history, 14, 0, sofia, "demo-ui-massage", index);
    history = history.minus({ days: 1 });
  }
  for (const [id, title, published, from] of [
    [
      "demo-ui-campaign-current",
      "En lugn stund – 20 % på massage",
      true,
      today,
    ],
    [
      "demo-ui-campaign-draft",
      "Nästa veckas fotvårdserbjudande",
      false,
      weekday(7),
    ],
  ] as const)
    await db.campaign.upsert({
      where: { id },
      create: {
        id,
        businessId: "demo",
        serviceId: published ? "demo-ui-massage" : "demo-ui-foot",
        title,
        discountPercent: 20,
        validFrom: from.toISODate()!,
        validUntil: from.plus({ days: 14 }).toISODate()!,
        published,
      },
      update: {},
    });
  console.log(
    JSON.stringify({
      added,
      existing,
      skipped,
      today: today.toISODate(),
      fullDay: full.toISODate(),
      partialDay: partial.toISODate(),
      sofiaLeave: leave.toISODate(),
      noDeletion: true,
      syntheticOnly: true,
      customers: names.length,
    }),
  );
}
main()
  .catch(() => {
    console.error("DEMO_SEED_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([
      db.$disconnect(),
      rateLimitDatabase.$disconnect(),
    ]);
  });
