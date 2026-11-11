import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import {
  createBooking,
  createCampaign,
  getAvailability,
  insertBooking,
  listBookings,
  publicCampaigns,
} from "../../src/lib/domain";
import { DomainError } from "../../src/lib/errors";

const marker = `qa-${randomUUID()}`;
function day(offset: number) {
  let d = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: offset })
    .startOf("day");
  while (d.weekday > 5) d = d.plus({ days: 1 });
  return d.toISODate()!;
}
function input(start: string, suffix: string, serviceId = "fotvard") {
  return {
    start,
    serviceId,
    customerName: "Syntetisk QA-kund",
    customerEmail: `${marker}-${suffix}@example.test`,
  };
}
afterAll(async () => {
  await db.booking.deleteMany({
    where: { customerEmail: { startsWith: marker } },
  });
  await db.campaign.deleteMany({ where: { title: { startsWith: marker } } });
  await db.$disconnect();
});

describe("Epic 01 QA-regression", () => {
  it("återger samma id vid sekventiell retry och 20 parallella idempotenta anrop", async () => {
    const slots = await getAvailability("fotvard", day(12));
    const payload = input(slots[0], "idempotent");
    const key = `${marker}-key`;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => createBooking(payload, key)),
    );
    expect(new Set(results.map((b) => b.id)).size).toBe(1);
    expect((await createBooking(payload, key)).id).toBe(results[0].id);
    expect(await db.booking.count({ where: { idempotencyKey: key } })).toBe(1);
    await expect(
      createBooking({ ...payload, customerName: "Annan syntetisk" }, key),
    ).rejects.toMatchObject({ status: 409 });
    await expect(createBooking(payload, "x".repeat(65))).rejects.toThrow();
  }, 60000);

  it("högst tre nya bokningar per normaliserad e-post och Stockholm-dygn även parallellt", async () => {
    const slots = await getAvailability("massage", day(16));
    const payloads = slots.slice(0, 4).map((s) => input(s, "cap", "massage"));
    const results = await Promise.allSettled(
      payloads.map((v) => createBooking(v)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected).toMatchObject({ reason: { status: 429 } });
    await expect(
      createBooking({
        ...payloads[3],
        customerEmail: payloads[3].customerEmail.toUpperCase(),
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("20 konkurrerande anrop och blandade 30/60-minutersintervall lämnar inga överlapp", async () => {
    for (const [offset, mixed] of [
      [20, false],
      [24, true],
    ] as const) {
      const slots = await getAvailability("fotvard", day(offset));
      const base = new Date(slots[0]);
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) => {
          const shorter = mixed && i % 2 === 1;
          const start = new Date(
            base.getTime() + (shorter ? 30 * 60000 : 0),
          ).toISOString();
          return createBooking(
            input(
              start,
              `concurrency-${offset}-${i}`,
              shorter ? "massage" : "fotvard",
            ),
          );
        }),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      for (const r of results)
        if (r.status === "rejected")
          expect(r.reason).toBeInstanceOf(DomainError);
    }
    const overlaps = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM "Booking" a JOIN "Booking" b
      ON a.id < b.id AND a."businessId" = b."businessId" AND a."staffId" = b."staffId"
      AND tstzrange(a."startsAt", a."endsAt", '[)') && tstzrange(b."startsAt", b."endsAt", '[)')
      WHERE a."customerEmail" LIKE ${`${marker}%`} AND b."customerEmail" LIKE ${`${marker}%`}`;
    expect(overlaps[0].count).toBe(0n);
  }, 60000);

  it("tvingat exclusion-fel mappas strukturerat till säkert domänfel", async () => {
    const data = {
      id: `${marker}-forced`,
      businessId: "demo",
      staffId: `${marker}-forced`,
      serviceId: "fotvard",
      startsAt: new Date("2027-02-01T09:00Z"),
      endsAt: new Date("2027-02-01T10:00Z"),
      customerName: "Syntetisk",
      customerEmail: `${marker}-forced@example.test`,
      idempotencyKey: null,
      requestHash: null,
    };
    await insertBooking(db, data);
    await expect(
      insertBooking(db, { ...data, id: `${marker}-forced-2` }),
    ).rejects.toMatchObject({
      message: "Tiden är inte tillgänglig",
      status: 400,
    });
  });

  it("admin avgränsar 150 bokningar, maskerar e-post och paginerar vid DST-dygn", async () => {
    const first = new Date("2027-10-30T22:00:00Z"); // Stockholm 00:00; 25-hour day.
    const last = new Date("2027-10-31T23:00:00Z");
    const data = Array.from({ length: 150 }, (_, i) => ({
      id: `${marker}-list-${String(i).padStart(3, "0")}`,
      businessId: "demo",
      staffId: `${marker}-list-${i}`,
      serviceId: "fotvard",
      startsAt: first,
      endsAt: new Date(first.getTime() + 60000),
      customerName: "Syntetisk",
      customerEmail: `${marker}-list@example.test`,
    }));
    await db.booking.createMany({
      data: [
        ...data,
        ...[new Date(first.getTime() - 1), last].map((start, i) => ({
          ...data[0],
          id: `${marker}-outside-${i}`,
          staffId: `${marker}-outside-${i}`,
          startsAt: start,
          endsAt: new Date(start.getTime() + 60000),
        })),
      ],
    });
    const range = { from: "2027-10-31", to: "2027-10-31", limit: 100 };
    const page1 = await listBookings(range);
    expect(page1.bookings).toHaveLength(100);
    expect(page1.bookings.every((b) => b.customerEmail === "***@***")).toBe(
      true,
    );
    expect(JSON.stringify(page1)).not.toContain("@example.test");
    const page2 = await listBookings({ ...range, cursor: page1.nextCursor! });
    expect(page2.bookings).toHaveLength(50);
    expect(page2.nextCursor).toBeNull();
    expect(
      new Set([...page1.bookings, ...page2.bookings].map((b) => b.id)),
    ).toEqual(new Set(data.map((b) => b.id)));
    await expect(listBookings({ ...range, limit: 101 })).rejects.toThrow();
    const defaults = await listBookings();
    expect(defaults.from).toBe(
      DateTime.now().setZone("Europe/Stockholm").toISODate(),
    );
    expect(defaults.bookings.length).toBeLessThanOrEqual(20);
  });

  it("kampanjer visas endast under giltigheten och ogiltiga intervall/fält avvisas", async () => {
    const today = DateTime.now().setZone("Europe/Stockholm").startOf("day");
    const v = {
      title: `${marker}-campaign`,
      serviceId: "fotvard",
      discountPercent: 20,
      validFrom: today.plus({ days: 1 }).toISODate()!,
      validUntil: today.plus({ days: 3 }).toISODate()!,
    };
    const c = await createCampaign(v);
    await db.campaign.update({
      where: { id: c.id },
      data: { published: true },
    });
    expect(
      (await publicCampaigns(today.toISODate()!)).some((x) => x.id === c.id),
    ).toBe(false);
    expect(
      (await publicCampaigns(v.validFrom)).some((x) => x.id === c.id),
    ).toBe(true);
    expect(
      (await publicCampaigns(today.plus({ days: 4 }).toISODate()!)).some(
        (x) => x.id === c.id,
      ),
    ).toBe(false);
    await expect(createCampaign({ ...v, unknown: true })).rejects.toThrow();
    await expect(
      createCampaign({
        ...v,
        validUntil: today.plus({ days: 91 }).toISODate()!,
      }),
    ).rejects.toThrow();
    await expect(
      db.campaign.create({
        data: {
          ...v,
          title: `${marker}-invalid`,
          businessId: "demo",
          validUntil: today.toISODate()!,
        },
      }),
    ).rejects.toThrow();
  });
});
