import { afterAll, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createBooking, getAvailability } from "../../src/lib/domain";
import { saveService, saveStaff } from "../../src/lib/workspace-config";
import { LOCAL_WORKSPACE_ACTOR as actor } from "../../src/lib/workspace-write";
import { ZONE } from "../../src/lib/time";

const marker = `e05-${randomUUID()}`;
const requestKeys: string[] = [];
const ids = {
  services: [] as string[],
  staff: [] as string[],
  users: [] as string[],
};
const key = () => {
  const id = randomUUID();
  requestKeys.push(
    createHash("sha256")
      .update(`${actor.kind}:${actor.id}:${id}`)
      .digest("hex"),
  );
  return id;
};
const weekly = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  periods: [{ start: "09:00", end: "17:00" }],
  breaks: [{ start: "12:00", end: "13:00" }],
}));
const day = DateTime.now().setZone(ZONE).plus({ days: 3 }).toISODate()!;
const at = (time: string) =>
  DateTime.fromISO(`${day}T${time}`, { zone: ZONE }).toUTC().toISO()!;
async function service() {
  const result = await saveService(
    { name: marker, priceOre: 65000, duration: 60, buffer: 0, active: true },
    key(),
    actor,
  );
  ids.services.push(result.id);
  return result;
}
async function staff(serviceId: string, name = marker) {
  const result = await saveStaff(
    { name, active: true, serviceIds: [serviceId], weekly, exceptions: [] },
    key(),
    actor,
  );
  ids.staff.push(result.id);
  return result;
}
function input(serviceId: string, staffId: string, time = "09:00") {
  return {
    serviceId,
    staffId,
    start: at(time),
    customerName: "Syntetisk provkund",
    customerEmail: `${marker}-${randomUUID()}@example.test`,
  };
}
afterAll(async () => {
  await db.booking.deleteMany({ where: { serviceId: { in: ids.services } } });
  await db.workspaceRequest.deleteMany({
    where: { businessId: "demo", key: { in: requestKeys } },
  });
  await db.staff.deleteMany({ where: { id: { in: ids.staff } } });
  await db.service.deleteMany({ where: { id: { in: ids.services } } });
  await db.adminUser.deleteMany({ where: { id: { in: ids.users } } });
  await db.$disconnect();
});

it("lagrar bokad tjänst/pris/längd och ändrar bara nya bokningar", async () => {
  const s = await service(),
    p = await staff(s.id);
  const request = input(s.id, p.id);
  const booking = await createBooking(request, randomUUID());
  await saveService(
    {
      id: s.id,
      expectedVersion: 1,
      name: "Ny behandling",
      priceOre: 70000,
      duration: 30,
      buffer: 15,
      active: true,
    },
    key(),
    actor,
  );
  const old = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
  expect(old).toMatchObject({
    serviceName: marker,
    priceOre: 65000,
    duration: 60,
    buffer: 0,
  });
  expect(old.endsAt.toISOString()).toBe(booking.endsAt.toISOString());
  const next = await createBooking(input(s.id, p.id, "14:00"), randomUUID());
  expect(next).toMatchObject({
    serviceName: "Ny behandling",
    priceOre: 70000,
    duration: 30,
    buffer: 15,
  });
  expect(next.endsAt.getTime() - next.startsAt.getTime()).toBe(45 * 60000);
  expect(
    await db.bookingEvent.count({
      where: { bookingId: booking.id, action: "create" },
    }),
  ).toBe(1);
  await saveService(
    {
      id: s.id,
      expectedVersion: 2,
      name: "Ny behandling",
      priceOre: 70000,
      duration: 30,
      active: false,
    },
    key(),
    actor,
  );
  await expect(
    createBooking(input(s.id, p.id, "15:00"), randomUUID()),
  ).rejects.toThrow("Tjänsten finns inte");
  expect(await db.booking.count({ where: { id: booking.id } })).toBe(1);
});

it("håller isär två personaler, pauser och ledighet utan hårdkodad vardagsstängning", async () => {
  const s = await service(),
    a = await staff(s.id),
    b = await staff(s.id, `${marker} B`);
  await createBooking(input(s.id, a.id), randomUUID());
  expect(await getAvailability(s.id, day, db, a.id)).not.toContain(at("09:00"));
  expect(await getAvailability(s.id, day, db, b.id)).toContain(at("09:00"));
  expect(await getAvailability(s.id, day, db, b.id)).not.toContain(at("12:00"));
  await saveStaff(
    {
      id: b.id,
      expectedVersion: 1,
      name: `${marker} B`,
      active: true,
      serviceIds: [s.id],
      weekly,
      exceptions: [{ date: day, periods: [] }],
    },
    key(),
    actor,
  );
  expect(await getAvailability(s.id, day, db, b.id)).toEqual([]);
});

it("nekar schemaändring som gömmer en bokning och nekar gammal resursversion", async () => {
  const s = await service(),
    p = await staff(s.id);
  const booking = await createBooking(input(s.id, p.id), randomUUID());
  await expect(
    saveStaff(
      {
        id: p.id,
        expectedVersion: 1,
        name: marker,
        active: true,
        serviceIds: [s.id],
        weekly: [],
        exceptions: [],
      },
      key(),
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await db.staff.findUniqueOrThrow({ where: { id: p.id } })).version,
  ).toBe(1);
  expect(
    (await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).status,
  ).toBe("confirmed");
  await expect(
    saveService(
      { id: s.id, expectedVersion: 3, name: marker, priceOre: 5, duration: 30 },
      key(),
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
});

it("gör konfigurationsretries idempotenta men nekar ändrad payload och obehörig replay", async () => {
  const requestId = key(),
    value = { name: marker, priceOre: 45000, duration: 30 };
  const first = await saveService(value, requestId, actor);
  ids.services.push(first.id);
  expect(await saveService(value, requestId, actor)).toEqual(first);
  await expect(
    saveService({ ...value, duration: 60 }, requestId, actor),
  ).rejects.toMatchObject({ status: 409 });
  const user = await db.adminUser.create({
    data: {
      email: `${marker}@example.test`,
      passwordHash: "not-a-credential",
      businessId: "demo",
      active: false,
    },
  });
  ids.users.push(user.id);
  await expect(
    saveService(value, requestId, { kind: "admin", id: user.id }),
  ).rejects.toMatchObject({ status: 403 });
});

it("nekar främmande tjänst och direkt DB-överlapp; avbokad rad kan ligga kvar utan att blockera", async () => {
  const s = await service(),
    p = await staff(s.id);
  const foreign = await db.service.create({
    data: {
      id: randomUUID(),
      businessId: "other",
      name: marker,
      duration: 30,
      priceOre: 1,
    },
  });
  ids.services.push(foreign.id);
  await expect(
    saveStaff({ name: marker, serviceIds: [foreign.id], weekly }, key(), actor),
  ).rejects.toThrow("Tjänsten finns inte");
  const booking = await createBooking(input(s.id, p.id), randomUUID());
  const duplicate = {
    businessId: "demo",
    staffId: p.id,
    serviceId: s.id,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    customerName: "Syntetisk",
    customerEmail: `${marker}@example.test`,
  };
  await expect(db.booking.create({ data: duplicate })).rejects.toThrow();
  await db.booking.update({
    where: { id: booking.id },
    data: { status: "cancelled" },
  });
  const inserted = await db.booking.create({ data: duplicate });
  expect(inserted).toMatchObject({
    serviceName: marker,
    priceOre: 65000,
    status: "confirmed",
  });
  expect(await db.booking.count({ where: { serviceId: s.id } })).toBe(2);
});
