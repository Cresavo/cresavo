import { afterAll, expect, it } from "vitest";
import { randomBytes, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { DateTime } from "luxon";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { assertTestDatabase } from "../../scripts/test-db-guard.mjs";
import { mcpEnvironment } from "../../src/mcp/environment";

// The seed is an operator CLI, so test its real entry point on a newly created
// disposable database, never the suite's database or an existing demo.
const name = `booking_seed_${randomBytes(10).toString("hex")}_demo`;
const target = new URL(process.env.DATABASE_URL!);
target.pathname = `/${name}`;
assertTestDatabase(target.href);
const ownerUrl = new URL(target);
ownerUrl.pathname = "/postgres";
const owner = createDatabaseClient(ownerUrl.href, 1);
let created = false;
let fixture: ReturnType<typeof createDatabaseClient> | undefined;
const env = {
  ...mcpEnvironment({ workspace: true }),
  NODE_ENV: "test" as const,
  DATABASE_URL: target.href,
  BOOKING_DEMO_SEED: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  CHECKPOINT_DISABLE: "1",
};
function command(args: string[]) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    maxBuffer: 4000000,
    timeout: 30000,
  });
  if (result.status !== 0) throw Error("SYNTHETIC_SEED_SUBPROCESS_FAILED");
  return result.stdout;
}
const seedKey = (day: DateTime, hour: number) =>
  "demo-v1-" +
  createHash("sha256")
    .update(`${day.toISODate()}:${hour}:0:demo-ui-sofia`)
    .digest("hex")
    .slice(0, 36);

it("CLI seed rejects spoofed public ownership, links legitimate history, preserves snapshots and reruns", async () => {
  const exists = await owner.$queryRawUnsafe<{ datname: string }[]>(
    `SELECT datname FROM pg_database WHERE datname='${name}'`,
  );
  if (exists.length) throw Error("DISPOSABLE_DATABASE_ALREADY_EXISTS");
  await owner.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  created = true;
  command(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  fixture = createDatabaseClient(target.href, 1);
  const demoActor = "synthetic-seed-owner";
  await fixture.adminUser.create({
    data: {
      id: demoActor,
      email: "demo-owner@example.test",
      businessId: "demo",
      passwordHash: "unusable-synthetic",
    },
  });
  await fixture.service.createMany({
    data: [
      {
        id: "demo-ui-massage",
        businessId: "demo",
        name: "Avslappnande massage",
        duration: 30,
        priceOre: 45000,
      },
      {
        id: "demo-ui-foot",
        businessId: "demo",
        name: "Fotvård – demo",
        duration: 60,
        priceOre: 65000,
      },
    ],
  });
  await fixture.staff.create({
    data: {
      id: "demo-ui-sofia",
      businessId: "demo",
      name: "Sofia (demo)",
      serviceIds: ["demo-ui-massage", "demo-ui-foot", "demo-ui-hair"],
      weekly: [1, 2, 3, 4, 5].map((weekday) => ({
        weekday,
        periods: [{ start: "09:00", end: "17:00" }],
        breaks: [{ start: "12:00", end: "13:00" }],
      })),
    },
  });
  const today = DateTime.now().setZone("Europe/Stockholm").startOf("day");
  let future = today.plus({ days: 1 }),
    past = today.minus({ days: 2 });
  while (future.weekday > 5) future = future.plus({ days: 1 });
  while (past.weekday > 5) past = past.minus({ days: 1 });
  const historicalKey = seedKey(past, 9),
    spoofedKey = seedKey(future, 9);
  await fixture.booking.create({
    data: {
      id: "public-fixture",
      businessId: "demo",
      staffId: "demo-ui-sofia",
      serviceId: "demo-ui-massage",
      startsAt: future.plus({ hours: 9 }).toJSDate(),
      endsAt: future.plus({ hours: 9, minutes: 30 }).toJSDate(),
      customerName: "Liv Demo",
      customerEmail: "demo-customer-10@example.test",
      idempotencyKey: spoofedKey,
      events: {
        create: {
          action: "create",
          actorKind: "public",
          actorId: "booking-channel",
        },
      },
    },
  });
  await fixture.booking.create({
    data: {
      id: historicalKey,
      businessId: "demo",
      staffId: "demo-ui-sofia",
      serviceId: "demo-ui-foot",
      startsAt: past.plus({ hours: 9 }).toJSDate(),
      endsAt: past.plus({ hours: 10 }).toJSDate(),
      customerName: "Lee Demo",
      customerEmail: "demo-customer-8@example.test",
      serviceName: "Äldre behandlingsnamn",
      priceOre: 61000,
      duration: 60,
      idempotencyKey: historicalKey,
      events: {
        create: { action: "create", actorKind: "admin", actorId: demoActor },
      },
    },
  });
  const snapshots = async () =>
    fixture!.$queryRawUnsafe<{ id: string; snapshot: unknown }[]>(
      `SELECT id,to_jsonb(b)-'customerId' AS snapshot FROM "Booking" b WHERE id IN ('public-fixture','${historicalKey}') ORDER BY id`,
    );
  const before = await snapshots();
  const first = JSON.parse(
    command(["--import", "tsx", "scripts/seed-demo.ts"]).trim(),
  );
  expect(first.skipped).toBeGreaterThanOrEqual(1);
  expect(
    (
      await fixture.booking.findUniqueOrThrow({
        where: { id: "public-fixture" },
      })
    ).customerId,
  ).toBeNull();
  expect(
    (await fixture.booking.findUniqueOrThrow({ where: { id: historicalKey } }))
      .customerId,
  ).toBe("demo-customer-8");
  expect(await snapshots()).toEqual(before);
  const fingerprint = async () => {
    const hashes: unknown[] = [];
    for (const table of [
      "Booking",
      "BookingEvent",
      "Customer",
      "Campaign",
      "Staff",
      "Service",
      "WorkspaceRequest",
      "CapacityDecision",
    ])
      hashes.push(
        await fixture!.$queryRawUnsafe(
          `SELECT count(*)::int AS count,md5(COALESCE(string_agg(row_to_json(t)::text,E'\n' ORDER BY row_to_json(t)::text),'')) AS hash FROM "${table}" t`,
        ),
      );
    return hashes;
  };
  const after = await fingerprint();
  for (let i = 0; i < 2; i++) {
    expect(
      JSON.parse(command(["--import", "tsx", "scripts/seed-demo.ts"]).trim())
        .added,
    ).toBe(0);
    expect(await fingerprint()).toEqual(after);
  }
  const existingIds = (
    await fixture.booking.findMany({ select: { id: true } })
  ).map((b) => b.id);
  const previousRows = await fixture.booking.findMany({
    where: { id: { in: existingIds } },
    orderBy: { id: "asc" },
  });
  const capacity = JSON.parse(
    command(["--import", "tsx", "scripts/seed-capacity.ts"]).trim(),
  );
  expect(capacity).toMatchObject({ synthetic: true, scenarios: 4, skipped: 0 });
  expect(
    await fixture.booking.findMany({
      where: { id: { in: existingIds } },
      orderBy: { id: "asc" },
    }),
  ).toEqual(previousRows);
  expect(
    await fixture.capacityDecision.count({ where: { outcome: "draft" } }),
  ).toBe(1);
  expect(
    await fixture.capacityDecision.count({ where: { outcome: "dismissed" } }),
  ).toBe(1);
  expect(
    await fixture.booking.count({
      where: { staffId: "demo-capacity-staff", status: "cancelled" },
    }),
  ).toBe(4);
  expect(
    await fixture.booking.count({
      where: { staffId: "demo-capacity-staff", status: "confirmed" },
    }),
  ).toBe(1);
  const withCapacity = await fingerprint();
  command(["--import", "tsx", "scripts/seed-capacity.ts"]);
  expect(await fingerprint()).toEqual(withCapacity);
}, 60000);

afterAll(async () => {
  await fixture?.$disconnect();
  // Only this newly created random fixture can be dropped; never use FORCE.
  if (created && /^booking_seed_[a-f0-9]{20}_demo$/.test(name)) {
    assertTestDatabase(target.href);
    await owner.$executeRawUnsafe(`DROP DATABASE "${name}"`);
  }
  await owner.$disconnect();
}, 30000);
