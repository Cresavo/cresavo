import { afterAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import {
  createBooking,
  getAvailability,
  createCampaign,
} from "../../src/lib/domain";
const email = `integration-${Date.now()}@example.test`;
afterAll(async () => {
  await db.booking.deleteMany({ where: { customerEmail: email } });
  await db.$disconnect();
});
describe("PostgreSQL and the booking domain", () => {
  it("the database rejects overlapping direct writes even without an availability check", async () => {
    const data = {
      businessId: "demo",
      staffId: email,
      serviceId: "fotvard",
      startsAt: new Date("2027-01-04T09:00:00Z"),
      endsAt: new Date("2027-01-04T10:00:00Z"),
      customerName: "Syntetisk",
      customerEmail: email,
    };
    const results = await Promise.allSettled([
      db.booking.create({ data }),
      db.booking.create({ data }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    await expect(
      db.booking.create({
        data: {
          ...data,
          startsAt: data.endsAt,
          endsAt: new Date("2027-01-04T11:00:00Z"),
        },
      }),
    ).resolves.toBeDefined();
  });
  it("rejects invalid input", async () => {
    await expect(
      createBooking({
        serviceId: "fotvard",
        start: "invalid",
        customerName: "A",
        customerEmail: "bad",
      }),
    ).rejects.toThrow();
    await expect(
      createCampaign({
        serviceId: "fotvard",
        title: "Test",
        discountPercent: 101,
        validFrom: "2026-02-30",
        validUntil: "2026-01-01",
      }),
    ).rejects.toThrow();
  });
  it("accepts only one of two concurrent bookings and blocks overlaps", async () => {
    let day = DateTime.now()
      .setZone("Europe/Stockholm")
      .plus({ days: 3 })
      .startOf("day");
    while (day.weekday > 5) day = day.plus({ days: 1 });
    const slots = await getAvailability("fotvard", day.toISODate()!);
    expect(slots.length).toBeGreaterThan(1);
    const input = {
      serviceId: "fotvard",
      start: slots[0],
      customerName: "Testkund",
      customerEmail: email,
    };
    const results = await Promise.allSettled([
      createBooking(input),
      createBooking(input),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const after = await getAvailability("massage", day.toISODate()!);
    expect(after).not.toContain(slots[0]);
    expect(after).not.toContain(slots[1]);
    const start = new Date(slots[0]);
    await expect(
      db.booking.create({
        data: {
          businessId: "demo",
          staffId: "staff-demo",
          serviceId: "massage",
          startsAt: new Date(start.getTime() + 30 * 60000),
          endsAt: new Date(start.getTime() + 60 * 60000),
          customerName: "Test",
          customerEmail: email,
        },
      }),
    ).rejects.toThrow();
  });
});
