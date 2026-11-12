import { afterEach, expect, it } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createBooking, getAvailability } from "../../src/lib/domain";
import { createAdminUser } from "../../src/lib/admin-accounts";
import type { WorkspaceActor } from "../../src/lib/workspace-write";

const marker = `admin-caps-${randomUUID()}`;
const admins: string[] = [];
const day = (offset: number) => {
  let d = DateTime.now().setZone("Europe/Stockholm").plus({ days: offset });
  while (d.weekday > 5) d = d.plus({ days: 1 });
  return d.toISODate()!;
};
const input = (start: string, email = `${marker}@example.test`) => ({
  serviceId: "massage",
  start,
  customerName: "Syntetisk telefonkund",
  customerEmail: email,
});
async function account(suffix: string): Promise<WorkspaceActor> {
  const user = await createAdminUser(
    `${marker}-${suffix}@example.test`,
    "synthetic-admin-cap-password-2026",
  );
  admins.push(user.id);
  return { kind: "admin", id: user.id };
}
afterEach(async () => {
  await db.booking.deleteMany({
    where: { customerEmail: { startsWith: marker } },
  });
  await db.adminUser.deleteMany({ where: { id: { in: admins } } });
  admins.length = 0;
  await db.$disconnect();
});

it("sex adminbokningar delar varken IP- eller e-postbudget med publika kunder", async () => {
  const actor = await account("separate");
  const slots = await getAvailability("massage", day(21));
  const address = `synthetic-admin-caps-${randomUUID()}`;
  for (let i = 0; i < 6; i++) {
    const booking = await createBooking(
      input(slots[i]),
      randomUUID(),
      address,
      actor,
    );
    expect(booking.emailCapKey).toBeNull();
  }
  for (let i = 0; i < 3; i++)
    await createBooking(input(slots[i + 6]), randomUUID(), address);
  await expect(
    createBooking(input(slots[9]), randomUUID(), address),
  ).rejects.toMatchObject({ status: 429 });
  for (let i = 0; i < 2; i++)
    await createBooking(
      input(slots[i + 9], `${marker}-public-${i}@example.test`),
      randomUUID(),
      address,
    );
  await expect(
    createBooking(
      input(slots[11], `${marker}-sixth@example.test`),
      randomUUID(),
      address,
    ),
  ).rejects.toMatchObject({ status: 429 });
  // Exhausted public budgets do not prevent the next legitimate admin booking.
  await expect(
    createBooking(input(slots[11]), randomUUID(), address, actor),
  ).resolves.toMatchObject({ status: "confirmed" });
});

it("admintaket är 100 per konto/skapandedag och retry/auth gäller även vid taket", async () => {
  const actor = await account("bounded");
  const other = await account("other");
  const first = DateTime.now()
    .setZone("Europe/Stockholm")
    .plus({ days: 7 })
    .startOf("day");
  const clientKey = createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`admin:${actor.id}`)
    .digest("hex");
  // Only synthetic quota fixtures: separate days, valid snapshots, no overlaps.
  await db.booking.createMany({
    data: Array.from({ length: 99 }, (_, i) => {
      const start = first.plus({ days: i }).toUTC().toJSDate();
      return {
        id: randomUUID(),
        businessId: "demo",
        staffId: "staff-demo",
        serviceId: "massage",
        startsAt: start,
        endsAt: new Date(start.getTime() + 30 * 60000),
        customerName: "Syntetisk kvotfixture",
        customerEmail: `${marker}-quota@example.test`,
        clientKey,
        emailCapKey: null,
        serviceName: "Massage",
        priceOre: 45000,
        duration: 30,
        buffer: 0,
      };
    }),
  });
  const slots = await getAvailability("massage", day(24));
  const key = randomUUID(),
    value = input(slots[0]);
  const winner = await createBooking(value, key, "192.0.2.233", actor);
  await expect(
    createBooking(input(slots[1]), randomUUID(), "192.0.2.234", actor),
  ).rejects.toMatchObject({ status: 429 });
  const retries = await Promise.all(
    Array.from({ length: 20 }, () =>
      createBooking(value, key, "192.0.2.235", actor),
    ),
  );
  expect(retries.every((row) => row.id === winner.id)).toBe(true);
  expect(await db.booking.count({ where: { clientKey } })).toBe(100);
  await expect(
    createBooking(input(slots[1]), randomUUID(), "192.0.2.233", other),
  ).resolves.toMatchObject({ status: "confirmed" });
  await db.adminUser.update({
    where: { id: actor.id },
    data: { active: false },
  });
  await expect(
    createBooking(value, key, undefined, actor),
  ).rejects.toMatchObject({ status: 403 });
});
