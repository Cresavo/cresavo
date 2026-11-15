import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { listCalendar } from "../../src/lib/calendar";

const marker = `calendar-${randomUUID()}`;
afterAll(async () => {
  await db.booking.deleteMany({
    where: { customerEmail: `${marker}@example.test` },
  });
  await db.$disconnect();
});

it("avgränsar kalendern till företag, datum, status och högst 100 rader per sida", async () => {
  const start = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 2 })
    .startOf("day");
  const from = start.toISODate()!,
    to = start.plus({ days: 9 }).toISODate()!;
  const rows = Array.from({ length: 150 }, (_, index) => {
    const time = start.plus({
      days: Math.floor(index / 15),
      hours: 9,
      minutes: (index % 15) * 30,
    });
    return {
      id: randomUUID(),
      businessId: "demo",
      staffId: marker,
      serviceId: "massage",
      startsAt: time.toJSDate(),
      endsAt: time.plus({ minutes: 30 }).toJSDate(),
      customerName: "Syntetisk kalenderkund",
      customerEmail: `${marker}@example.test`,
    };
  });
  await db.booking.createMany({ data: rows });
  await db.booking.createMany({
    data: [
      { ...rows[0], id: randomUUID(), businessId: "other" },
      {
        ...rows[0],
        id: randomUUID(),
        startsAt: start.minus({ minutes: 30 }).toJSDate(),
        endsAt: start.toJSDate(),
      },
      {
        ...rows[0],
        id: randomUUID(),
        startsAt: start.plus({ days: 10 }).toJSDate(),
        endsAt: start.plus({ days: 10, minutes: 30 }).toJSDate(),
      },
      { ...rows[0], id: randomUUID(), status: "cancelled" },
    ],
  });
  const first = await listCalendar({ from, to, staffId: marker, limit: 100 });
  expect(first.bookings).toHaveLength(100);
  const second = await listCalendar({
    from,
    to,
    staffId: marker,
    limit: 100,
    cursor: first.nextCursor,
  });
  expect(second.bookings).toHaveLength(50);
  expect(second.nextCursor).toBeNull();
  expect(
    new Set([...first.bookings, ...second.bookings].map((b) => b.id)).size,
  ).toBe(150);
  expect(
    first.bookings.every(
      (b) => b.status === "confirmed" && !("customerEmail" in b),
    ),
  ).toBe(true);
  expect(
    (
      await listCalendar({
        from,
        to: from,
        staffId: marker,
        status: "all",
        limit: 100,
      })
    ).bookings,
  ).toHaveLength(16);
  await expect(listCalendar({ from, to, limit: 101 })).rejects.toThrow();
  await expect(
    listCalendar({ from: to, to, staffId: marker, cursor: rows[0].id }),
  ).rejects.toThrow("Ogiltig sidmarkör");
});
