import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createDatabaseClient } from "../../scripts/database.mjs";

it("bevarar UTC-instanter vid rå SQL och ORM runt sommartid även med annan sessionsinställning i URL", async () => {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("options", "-c timezone=Europe/Stockholm");
  const db = createDatabaseClient(url.href);
  const marker = `database-${randomUUID()}`;
  const starts = [
    "2027-03-28T00:36:00.000Z",
    "2027-03-28T01:36:00.000Z",
    "2027-10-31T00:36:00.000Z",
    "2027-10-31T01:36:00.000Z",
  ];
  try {
    const zone = await db.$queryRaw<
      Array<{ TimeZone: string }>
    >`SHOW TIME ZONE`;
    expect(zone[0].TimeZone).toBe("UTC");
    await db.booking.createMany({
      data: starts.map((start, i) => ({
        id: `${marker}-${i}`,
        businessId: "demo",
        staffId: `${marker}-${i}`,
        serviceId: "massage",
        customerName: "Syntetisk tidszontest",
        customerEmail: `${marker}@example.test`,
        startsAt: new Date(start),
        endsAt: new Date(new Date(start).getTime() + 30 * 60000),
      })),
    });
    const rows = await db.booking.findMany({
      where: { customerEmail: `${marker}@example.test` },
      orderBy: { startsAt: "asc" },
    });
    expect(rows.map((row) => row.startsAt.toISOString())).toEqual(starts);
    expect(
      rows.every(
        (row) => row.endsAt.getTime() - row.startsAt.getTime() === 30 * 60000,
      ),
    ).toBe(true);
    const raw = await db.$queryRaw<
      Array<{ instant: Date }>
    >`SELECT ${new Date(starts[0])}::timestamptz AS instant`;
    expect(raw[0].instant.toISOString()).toBe(starts[0]);
  } finally {
    await db.booking.deleteMany({
      where: { customerEmail: `${marker}@example.test` },
    });
    await db.$disconnect();
  }
});
