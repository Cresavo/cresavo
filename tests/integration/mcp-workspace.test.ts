import { afterAll, afterEach, expect, it } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { db } from "../../src/lib/db";
import { moveBooking } from "../../src/lib/booking-mutations";
import { LOCAL_WORKSPACE_ACTOR as actor } from "../../src/lib/workspace-write";

const marker = `mcp-workspace-${randomUUID()}`;
const services: string[] = [],
  people: string[] = [],
  keys: string[] = [];
const clients: Client[] = [];
const day = DateTime.now()
  .setZone("Europe/Stockholm")
  .plus({ days: 3 })
  .startOf("day");
const date = day.toISODate()!,
  nextDate = day.plus({ days: 1 }).toISODate()!;
const at = (hour: number, next = false) =>
  day
    .plus({ days: next ? 1 : 0 })
    .set({ hour })
    .toUTC()
    .toISO()!;
const weekly = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  periods: [{ start: "09:00", end: "17:00" }],
  breaks: [],
}));
type Identity = { id: string; version: number };
type Reply = Awaited<ReturnType<Client["callTool"]>>;
function read<T = Record<string, unknown>>(result: Reply): T {
  expect(result.isError).not.toBeTruthy();
  const block = result.content[0];
  if (block.type !== "text") throw new Error("Expected text");
  return JSON.parse(block.text) as T;
}
function key() {
  const value = randomUUID();
  keys.push(
    createHash("sha256")
      .update(`${actor.kind}:${actor.id}:${value}`)
      .digest("hex"),
  );
  return value;
}
function call(client: Client, name: string, input: Record<string, unknown>) {
  return client.callTool({ name, arguments: input });
}
function write(
  client: Client,
  name: string,
  input: Record<string, unknown>,
  clientRequestId = key(),
) {
  return call(client, name, { ...input, clientRequestId, confirmed: true });
}
async function connect(flags = ["--admin", "--allow-workspace"]) {
  const client = new Client({
    name: "synthetic-workspace-integration",
    version: "1",
  });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/mcp/server.ts", ...flags],
    env: { ...mcpEnvironment({ workspace: true }), NODE_ENV: "test" },
    stderr: "pipe",
  });
  let errors = "";
  transport.stderr?.on("data", (value) => {
    errors += String(value);
  });
  clients.push(client);
  await client.connect(transport);
  return { client, stderr: () => errors };
}
async function resources(client: Client) {
  const service = read<Identity>(
    await write(client, "save_service", {
      name: marker,
      priceOre: 50000,
      duration: 30,
      buffer: 0,
    }),
  );
  services.push(service.id);
  const staff = [];
  for (const name of ["Syntetisk Anna", "Syntetisk Erik"]) {
    const person = read<Identity>(
      await write(client, "save_staff", {
        name,
        serviceIds: [service.id],
        weekly,
        exceptions: [
          { date: day.plus({ days: 10 }).toISODate(), periods: [], breaks: [] },
        ],
      }),
    );
    people.push(person.id);
    staff.push(person);
  }
  return { service, staff };
}
async function booking(
  client: Client,
  serviceId: string,
  staffId: string,
  start = at(9),
) {
  return read<{ id: string }>(
    await write(client, "create_booking", {
      serviceId,
      staffId,
      start,
      customerName: "Syntetisk hemlig kund",
      customerEmail: `${marker}-${randomUUID()}@example.test`,
    }),
  );
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  await db.booking.deleteMany({
    where: { customerEmail: { startsWith: marker } },
  });
  await db.workspaceRequest.deleteMany({
    where: { businessId: "demo", key: { in: keys.splice(0) } },
  });
  await db.staff.deleteMany({ where: { id: { in: people.splice(0) } } });
  await db.service.deleteMany({ where: { id: { in: services.splice(0) } } });
});
afterAll(async () => {
  await db.$disconnect();
});

it("publicerar inte nya skrivverktyg utan separat opt-in och avvisar fel startkonfiguration", async () => {
  for (const flags of [[], ["--admin"], ["--admin", "--allow-bookings"]]) {
    const { client } = await connect(flags);
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    for (const name of [
      "move_booking",
      "cancel_booking",
      "save_service",
      "save_staff",
    ]) {
      expect(names).not.toContain(name);
      await expect(call(client, name, {})).rejects.toThrow();
    }
    expect(names.includes("get_booking")).toBe(flags.includes("--admin"));
  }
  const invalid = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/mcp/server.ts", "--allow-workspace"],
    {
      env: { ...mcpEnvironment({ workspace: true }), NODE_ENV: "test" },
      encoding: "utf8",
    },
  );
  expect(invalid.status).toBe(1);
  expect(invalid.stderr).toContain("MCP_WORKSPACE_CONFIG_INVALID");
}, 30000);

it("MCP konfigurerar samma kalender, flyttar med snapshotlängd och avbokar idempotent utan kundläckage", async () => {
  const { client } = await connect();
  const { service, staff } = await resources(client);
  const original = await booking(client, service.id, staff[0].id);
  read(
    await write(client, "save_service", {
      id: service.id,
      expectedVersion: 1,
      name: "Syntetisk ny behandling",
      priceOre: 70000,
      duration: 60,
      buffer: 15,
    }),
  );
  const schedule = read<{ exceptions: unknown[] }>(
    await call(client, "get_staff_schedule", {
      staffId: staff[1].id,
      from: date,
      to: nextDate,
    }),
  );
  expect(schedule.exceptions).toEqual([]);
  const configuration = read<{ exceptions: unknown[] }>(
    await call(client, "get_staff_configuration", { staffId: staff[1].id }),
  );
  expect(configuration.exceptions).toHaveLength(1);
  expect(
    read(
      await call(client, "get_availability", {
        serviceId: service.id,
        staffId: staff[1].id,
        date: day.plus({ days: 10 }).toISODate(),
      }),
    ),
  ).toEqual([]);
  const target = at(10, true);
  expect(
    read<string[]>(
      await call(client, "get_move_availability", {
        id: original.id,
        staffId: staff[1].id,
        date: nextDate,
      }),
    ),
  ).toContain(target);
  const move = {
      id: original.id,
      expectedVersion: 1,
      staffId: staff[1].id,
      start: target,
    },
    moveKey = key();
  const moved = await Promise.all(
    Array.from({ length: 20 }, () =>
      write(client, "move_booking", move, moveKey),
    ),
  );
  const result = read(moved[0]);
  for (const response of moved) expect(read(response)).toEqual(result);
  expect(result).toMatchObject({
    id: original.id,
    version: 2,
    status: "confirmed",
    startsAt: target,
  });
  expect(
    await db.bookingEvent.count({
      where: { bookingId: original.id, action: "move" },
    }),
  ).toBe(1);
  const row = await db.booking.findUniqueOrThrow({
    where: { id: original.id },
  });
  expect(row).toMatchObject({ priceOre: 50000, duration: 30, buffer: 0 });
  expect(row.endsAt.getTime() - row.startsAt.getTime()).toBe(30 * 60000);
  const legacy = read<{ bookings: { service: { name: string } }[] }>(
    await call(client, "list_bookings", { from: date, to: nextDate }),
  );
  expect(legacy.bookings).toHaveLength(1);
  expect(legacy.bookings[0].service.name).toBe(marker);
  expect(
    (
      await write(
        client,
        "move_booking",
        { ...move, start: at(11, true) },
        moveKey,
      )
    ).isError,
  ).toBe(true);
  expect((await write(client, "move_booking", move)).isError).toBe(true);
  const cancelKey = key(),
    cancel = { id: original.id, expectedVersion: 2 };
  const cancellations = await Promise.all(
    Array.from({ length: 20 }, () =>
      write(client, "cancel_booking", cancel, cancelKey),
    ),
  );
  const cancelled = read(cancellations[0]);
  for (const response of cancellations) expect(read(response)).toEqual(cancelled);
  expect(cancelled).toMatchObject({ status: "cancelled", version: 3 });
  expect(
    await db.bookingEvent.count({
      where: { bookingId: original.id, action: "cancel" },
    }),
  ).toBe(1);
  expect(
    (
      await write(
        client,
        "cancel_booking",
        { ...cancel, expectedVersion: 3 },
        cancelKey,
      )
    ).isError,
  ).toBe(true);
  expect(
    read(await write(client, "cancel_booking", cancel, cancelKey)),
  ).toEqual(cancelled);
  expect(
    (await write(client, "move_booking", { ...move, expectedVersion: 3 }))
      .isError,
  ).toBe(true);
  const available = read<string[]>(
    await call(client, "get_availability", {
      serviceId: service.id,
      staffId: staff[1].id,
      date: nextDate,
    }),
  );
  expect(available).toContain(target);
  const listing = await call(client, "list_workspace_bookings", {
    from: date,
    to: nextDate,
    status: "all",
  });
  const details = await call(client, "get_booking", { id: original.id });
  for (const response of [listing, details, ...moved]) {
    expect(JSON.stringify(response)).not.toMatch(
      /Syntetisk hemlig kund|customerName|customerEmail|@example.test/,
    );
    expect(response.isError).not.toBeTruthy();
  }
  expect(read<{ bookings: Identity[] }>(listing).bookings).toHaveLength(1);
  expect(read<{ events: unknown[] }>(details).events).toHaveLength(3);
  expect(
    read<{ bookings: unknown[] }>(
      await call(client, "list_bookings", { from: date, to: nextDate }),
    ).bookings,
  ).toEqual([]);
}, 30000);

it("nekar okända/främmande resurser, breda läsningar och förfalskade fält utan skrivning", async () => {
  const { client, stderr } = await connect();
  const { service, staff } = await resources(client);
  const foreign = await db.service.create({
    data: {
      id: randomUUID(),
      businessId: "other",
      name: "Syntetisk annan salong",
      priceOre: 1,
      duration: 30,
    },
  });
  services.push(foreign.id);
  const foreignStaff = await db.staff.create({
    data: {
      id: randomUUID(),
      businessId: "other",
      name: "Syntetisk främmande utförare",
      serviceIds: [foreign.id],
      weekly,
      exceptions: [],
    },
  });
  people.push(foreignStaff.id);
  const foreignBooking = await db.booking.create({
    data: {
      businessId: "other",
      staffId: staff[0].id,
      serviceId: foreign.id,
      startsAt: new Date(at(9)),
      endsAt: new Date(at(10)),
      customerName: "Syntetisk främmande",
      customerEmail: `${marker}-foreign@example.test`,
    },
  });
  const before = await db.booking.count();
  for (const [name, value] of [
    ["get_booking", { id: foreignBooking.id }],
    ["get_booking", { id: "missing" }],
    [
      "get_move_availability",
      { id: foreignBooking.id, staffId: staff[0].id, date },
    ],
    ["get_staff_schedule", { staffId: "missing", from: date, to: nextDate }],
    ["get_staff_configuration", { staffId: "missing" }],
    ["get_staff_configuration", { staffId: foreignStaff.id }],
    [
      "get_staff_schedule",
      { staffId: foreignStaff.id, from: date, to: nextDate },
    ],
    ["list_workspace_bookings", { from: date, to: nextDate, limit: 101 }],
    [
      "list_workspace_bookings",
      { from: date, to: day.plus({ days: 32 }).toISODate() },
    ],
    [
      "move_booking",
      {
        id: foreignBooking.id,
        expectedVersion: 1,
        staffId: staff[0].id,
        start: at(11),
        clientRequestId: key(),
        confirmed: true,
      },
    ],
    [
      "cancel_booking",
      {
        id: foreignBooking.id,
        expectedVersion: 1,
        clientRequestId: key(),
        confirmed: true,
      },
    ],
    [
      "save_service",
      {
        id: foreign.id,
        expectedVersion: 1,
        name: marker,
        priceOre: 1,
        duration: 30,
        clientRequestId: key(),
        confirmed: true,
      },
    ],
    [
      "save_staff",
      {
        name: marker,
        serviceIds: [foreign.id],
        weekly,
        clientRequestId: key(),
        confirmed: true,
      },
    ],
    [
      "save_service",
      {
        name: marker,
        priceOre: 1,
        duration: 30,
        clientRequestId: key(),
        confirmed: true,
        actor: "CANARY_SECRET",
      },
    ],
  ] as [string, Record<string, unknown>][]) {
    const response = await call(client, name, value);
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response)).not.toMatch(
      /CANARY_SECRET|Prisma|stack|Syntetisk främmande/,
    );
  }
  expect(await db.booking.count()).toBe(before);
  expect(
    (await db.service.findUniqueOrThrow({ where: { id: service.id } })).version,
  ).toBe(1);
  expect(
    (await db.booking.findUniqueOrThrow({ where: { id: foreignBooking.id } }))
      .status,
  ).toBe("confirmed");
  expect(stderr()).not.toMatch(/CANARY_SECRET|customerEmail|customerName/);
}, 30000);

it("20 blandade domän/MCP-flyttar ger en vinnare för ett mål och inga aktiva överlapp", async () => {
  const { client } = await connect(),
    { service, staff } = await resources(client);
  const a = await booking(client, service.id, staff[0].id, at(9)),
    b = await booking(client, service.id, staff[1].id, at(9));
  const outcomes = await Promise.all(
    Array.from({ length: 20 }, async (_, index) => {
      const input = {
        id: index % 2 ? a.id : b.id,
        expectedVersion: 1,
        staffId: staff[0].id,
        start: at(11),
      };
      if (index % 3)
        return !(await write(client, "move_booking", input)).isError;
      try {
        await moveBooking(input, key(), actor);
        return true;
      } catch (error) {
        expect(error).toHaveProperty("status");
        return false;
      }
    }),
  );
  expect(outcomes.filter(Boolean)).toHaveLength(1);
  const overlap = await db.$queryRaw<
    { count: bigint }[]
  >`SELECT count(*) FROM "Booking" a JOIN "Booking" b ON a.id < b.id AND a."businessId"=b."businessId" AND a."staffId"=b."staffId" AND a.status='confirmed' AND b.status='confirmed' AND tstzrange(a."startsAt",a."endsAt",'[)') && tstzrange(b."startsAt",b."endsAt",'[)')`;
  expect(Number(overlap[0].count)).toBe(0);
  expect(
    await db.booking.count({
      where: { serviceId: service.id, status: "confirmed" },
    }),
  ).toBe(2);
}, 30000);

it("alla nya skrivverktyg kräver strikt bekräftelse och request-id över verklig stdio", async () => {
  const { client, stderr } = await connect(),
    { service, staff } = await resources(client);
  const existing = await booking(client, service.id, staff[0].id);
  const before = {
    booking: await db.booking.findUniqueOrThrow({ where: { id: existing.id } }),
    ledgers: await db.workspaceRequest.count(),
  };
  const tools = (await client.listTools()).tools;
  for (const [name, input] of [
    [
      "move_booking",
      {
        id: existing.id,
        expectedVersion: 1,
        staffId: staff[0].id,
        start: at(11),
      },
    ],
    ["cancel_booking", { id: existing.id, expectedVersion: 1 }],
    [
      "save_service",
      {
        id: service.id,
        expectedVersion: 1,
        name: marker,
        priceOre: 10000,
        duration: 30,
      },
    ],
    [
      "save_staff",
      {
        id: staff[0].id,
        expectedVersion: 1,
        name: "Syntetisk ändrad",
        serviceIds: [service.id],
        weekly,
      },
    ],
  ] as [string, Record<string, unknown>][]) {
    const schema = tools.find((tool) => tool.name === name)!.inputSchema;
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(
      expect.arrayContaining(["clientRequestId", "confirmed"]),
    );
    for (const patch of [
      { confirmed: false },
      { confirmed: undefined },
      { clientRequestId: undefined },
      { unknownField: "CANARY_SECRET" },
    ]) {
      const response = await call(client, name, {
        ...input,
        clientRequestId: key(),
        confirmed: true,
        ...patch,
      });
      expect(response.isError).toBe(true);
      expect(response.content).toEqual([
        { type: "text", text: "Kontrollera uppgifterna" },
      ]);
    }
  }
  expect(
    await db.booking.findUniqueOrThrow({ where: { id: existing.id } }),
  ).toEqual(before.booking);
  expect(await db.workspaceRequest.count()).toBe(before.ledgers);
  expect(
    (await db.service.findUniqueOrThrow({ where: { id: service.id } })).version,
  ).toBe(1);
  expect(
    (await db.staff.findUniqueOrThrow({ where: { id: staff[0].id } })).version,
  ).toBe(1);
  expect(stderr()).not.toContain("CANARY_SECRET");
}, 30000);
