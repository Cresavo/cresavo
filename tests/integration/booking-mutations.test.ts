import { afterAll, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createBooking, getAvailability } from "../../src/lib/domain";
import { saveService, saveStaff } from "../../src/lib/workspace-config";
import {
  moveBooking,
  cancelBooking,
  getBooking,
} from "../../src/lib/booking-mutations";
import { LOCAL_WORKSPACE_ACTOR as actor } from "../../src/lib/workspace-write";
import { ZONE } from "../../src/lib/time";

const marker = `mutations-${randomUUID()}`;
const keys: string[] = [];
const services: string[] = [],
  staff: string[] = [];
const request = () => {
  const key = randomUUID();
  keys.push(
    createHash("sha256")
      .update(`${actor.kind}:${actor.id}:${key}`)
      .digest("hex"),
  );
  return key;
};
const day = DateTime.now().setZone(ZONE).startOf("day").plus({ days: 4 });
const at = (time: string, offset = 0) =>
  DateTime.fromISO(`${day.plus({ days: offset }).toISODate()}T${time}`, {
    zone: ZONE,
  })
    .toUTC()
    .toISO()!;
async function setup(duration = 30) {
  const service = await saveService(
    { name: marker, priceOre: 50000, duration, buffer: 0 },
    request(),
    actor,
  );
  services.push(service.id);
  const people = [];
  for (const name of [`${marker} A`, `${marker} B`]) {
    const person = await saveStaff(
      {
        name,
        serviceIds: [service.id],
        weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          weekday,
          periods: [{ start: "09:00", end: "17:00" }],
          breaks: [],
        })),
      },
      request(),
      actor,
    );
    staff.push(person.id);
    people.push(person.id);
  }
  return { serviceId: service.id, a: people[0], b: people[1] };
}
function input(
  serviceId: string,
  staffId: string,
  start = at("09:00"),
  email = `${marker}-${randomUUID()}@example.test`,
) {
  return {
    serviceId,
    staffId,
    start,
    customerName: "Syntetisk kund",
    customerEmail: email,
  };
}
afterAll(async () => {
  await db.booking.deleteMany({ where: { serviceId: { in: services } } });
  await db.workspaceRequest.deleteMany({
    where: { businessId: "demo", key: { in: keys } },
  });
  await db.staff.deleteMany({ where: { id: { in: staff } } });
  await db.service.deleteMany({ where: { id: { in: services } } });
  await db.$disconnect();
});

it("flyttar över personal/dygn med bokad snapshot och bevarar originalet vid konflikt", async () => {
  const c = await setup(60);
  const booking = await createBooking(input(c.serviceId, c.a), randomUUID());
  const blocker = await createBooking(
    input(c.serviceId, c.b, at("10:00", 1)),
    randomUUID(),
  );
  await expect(
    moveBooking(
      {
        id: booking.id,
        expectedVersion: 1,
        staffId: c.b,
        start: blocker.startsAt.toISOString(),
      },
      request(),
      actor,
    ),
  ).rejects.toThrow("Tiden är inte tillgänglig");
  const unchanged = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
  });
  expect(unchanged.startsAt).toEqual(booking.startsAt);
  expect(unchanged.version).toBe(1);
  await saveService(
    {
      id: c.serviceId,
      expectedVersion: 1,
      name: "Ändrad tjänst",
      priceOre: 60000,
      duration: 30,
      buffer: 15,
    },
    request(),
    actor,
  );
  const moved = await moveBooking(
    { id: booking.id, expectedVersion: 1, staffId: c.b, start: at("14:00", 1) },
    request(),
    actor,
  );
  expect(moved).toMatchObject({
    staffId: c.b,
    version: 2,
    status: "confirmed",
  });
  expect(
    new Date(moved.endsAt).getTime() - new Date(moved.startsAt).getTime(),
  ).toBe(60 * 60000);
  const stored = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
  });
  expect(stored).toMatchObject({
    serviceName: marker,
    priceOre: 50000,
    duration: 60,
    buffer: 0,
  });
  expect(stored.initialStartsAt).toEqual(booking.startsAt);
  await expect(
    moveBooking(
      { id: booking.id, expectedVersion: 1, staffId: c.a, start: at("15:00") },
      request(),
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  const detail = await getBooking(booking.id);
  expect(Object.keys(detail)).not.toContain("customerName");
  expect(Object.keys(detail)).not.toContain("customerEmail");
  expect(detail.events.map((e) => e.action)).toContain("move");
});

it("20 parallella flyttretries ger ett resultat, en versionshöjning och en händelse", async () => {
  const c = await setup();
  const booking = await createBooking(input(c.serviceId, c.a), randomUUID());
  const v = {
      id: booking.id,
      expectedVersion: 1,
      staffId: c.b,
      start: at("10:00", 1),
    },
    key = request();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => moveBooking(v, key, actor)),
  );
  for (const result of results) expect(result).toEqual(results[0]);
  expect(results[0].version).toBe(2);
  expect(
    await db.bookingEvent.count({
      where: { bookingId: booking.id, action: "move" },
    }),
  ).toBe(1);
  await expect(
    moveBooking({ ...v, start: at("11:00", 1) }, key, actor),
  ).rejects.toMatchObject({ status: 409 });
});

it("avbokar spårbart, frigör tid och bevarar skapandedagens e-posttak", async () => {
  const c = await setup();
  const email = `${marker}-daily@example.test`;
  for (let i = 0; i < 3; i++) {
    const booking = await createBooking(
      input(c.serviceId, c.a, at("09:00"), email),
      randomUUID(),
    );
    const key = request(),
      value = { id: booking.id, expectedVersion: 1 };
    const cancelled = await cancelBooking(value, key, actor);
    expect(cancelled).toMatchObject({ status: "cancelled", version: 2 });
    expect(await cancelBooking(value, key, actor)).toEqual(cancelled);
    expect(
      await cancelBooking(
        { id: booking.id, expectedVersion: 2 },
        request(),
        actor,
      ),
    ).toEqual(cancelled);
    expect(
      await db.bookingEvent.count({
        where: { bookingId: booking.id, action: "cancel" },
      }),
    ).toBe(1);
    expect(
      await getAvailability(c.serviceId, day.toISODate()!, db, c.a),
    ).toContain(at("09:00"));
    await expect(
      moveBooking(
        {
          id: booking.id,
          expectedVersion: 2,
          staffId: c.b,
          start: at("10:00"),
        },
        request(),
        actor,
      ),
    ).rejects.toThrow("Bokningen är avbokad");
  }
  expect(
    await db.booking.count({
      where: { serviceId: c.serviceId, status: "cancelled" },
    }),
  ).toBe(3);
  await expect(
    createBooking(input(c.serviceId, c.a, at("09:00"), email), randomUUID()),
  ).rejects.toMatchObject({ status: 429 });
});

it("samtidig flytt/avbokning av samma version ger exakt en vinnare", async () => {
  const c = await setup();
  const booking = await createBooking(input(c.serviceId, c.a), randomUUID());
  const results = await Promise.allSettled([
    moveBooking(
      {
        id: booking.id,
        expectedVersion: 1,
        staffId: c.b,
        start: at("14:00", 1),
      },
      request(),
      actor,
    ),
    cancelBooking({ id: booking.id, expectedVersion: 1 }, request(), actor),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find((r) => r.status === "rejected");
  expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
    status: 409,
  });
  expect(
    (await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).version,
  ).toBe(2);
});

it("20 konkurrerande flyttar till samma tid ger en vinnare och noll aktiva överlapp", async () => {
  const c = await setup();
  const bookings = [];
  for (let i = 0; i < 20; i++) {
    const minute = 9 * 60 + (i % 10) * 30;
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    bookings.push(
      await createBooking(
        input(c.serviceId, c.a, at(time, Math.floor(i / 10))),
        randomUUID(),
      ),
    );
  }
  const results = await Promise.allSettled(
    bookings.map((b) =>
      moveBooking(
        { id: b.id, expectedVersion: 1, staffId: c.b, start: at("14:00", 2) },
        request(),
        actor,
      ),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  for (const result of results)
    if (result.status === "rejected")
      expect(result.reason.message).toBe("Tiden är inte tillgänglig");
  const overlap = await db.$queryRaw<
    Array<{ n: bigint }>
  >`SELECT count(*) AS n FROM "Booking" a JOIN "Booking" b ON a.id<b.id AND a."businessId"=b."businessId" AND a."staffId"=b."staffId" AND tstzrange(a."startsAt",a."endsAt",'[)') && tstzrange(b."startsAt",b."endsAt",'[)') WHERE a."serviceId"=${c.serviceId} AND a."status"='confirmed' AND b."status"='confirmed'`;
  expect(Number(overlap[0].n)).toBe(0);
});
