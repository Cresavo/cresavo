import { afterAll, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import {
  createCustomer,
  editCustomer,
  getCustomer,
  listCustomers,
  customerBookings,
} from "../../src/lib/customers";
import { createBooking } from "../../src/lib/domain";
import {
  moveBooking,
  cancelBooking,
  getBooking,
} from "../../src/lib/booking-mutations";
import * as demo from "../../src/lib/demo-access";
import { LOCAL_WORKSPACE_ACTOR } from "../../src/lib/workspace-write";

const marker = `customers-${randomUUID()}`;
const userId = marker + "-owner",
  serviceId = marker + "-service",
  staffId = marker + "-staff";
const actor = { kind: "admin", id: userId } as const;
const customerIds: string[] = [],
  ledgerKeys: string[] = [];
function key() {
  const key = randomUUID();
  ledgerKeys.push(
    createHash("sha256").update(`admin:${actor.id}:${key}`).digest("hex"),
  );
  return key;
}
let prepared = false;
async function setup() {
  if (prepared) return;
  await db.adminUser.create({
    data: {
      id: userId,
      email: marker + "@example.test",
      passwordHash: "unused-synthetic",
      businessId: "demo",
    },
  });
  await db.service.create({
    data: {
      id: serviceId,
      businessId: "demo",
      name: "Ursprunglig behandling",
      duration: 30,
      priceOre: 45000,
    },
  });
  await db.staff.create({
    data: {
      id: staffId,
      businessId: "demo",
      name: marker,
      serviceIds: [serviceId],
      weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        weekday,
        periods: [{ start: "09:00", end: "17:00" }],
        breaks: [],
      })),
    },
  });
  prepared = true;
}
async function customer(name = marker) {
  await setup();
  const row = await createCustomer(
    { name, email: `${randomUUID()}@example.test` },
    key(),
    actor,
  );
  customerIds.push(row.id);
  return row;
}
const start = (hour: number, offset = 10) =>
  DateTime.now()
    .setZone("Europe/Stockholm")
    .startOf("day")
    .plus({ days: offset, hours: hour })
    .toUTC()
    .toISO()!;

it("creates one card on 20 retries, rejects changed payload and never merges names or emails", async () => {
  await setup();
  const input = { name: marker, email: marker + "@example.test" },
    request = key();
  const results = await Promise.all(
    Array.from({ length: 20 }, () => createCustomer(input, request, actor)),
  );
  customerIds.push(results[0].id);
  expect(new Set(results.map((r) => r.id)).size).toBe(1);
  await expect(
    createCustomer({ ...input, name: "En annan person" }, request, actor),
  ).rejects.toMatchObject({ status: 409 });
  const other = await createCustomer(input, key(), actor);
  customerIds.push(other.id);
  expect(other.id).not.toBe(results[0].id);
});
it("keeps snapshots and customer link through edit, move, cancel and idempotent replay", async () => {
  const c = await customer("Ursprungligt namn"),
    request = randomUUID();
  const payload = { customerId: c.id, serviceId, staffId, start: start(9) };
  const booking = await createBooking(payload, request, undefined, actor);
  const before = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
  });
  await editCustomer(
    {
      id: c.id,
      expectedVersion: 1,
      name: "Nytt namn",
      email: "new@example.test",
      archived: false,
    },
    key(),
    actor,
  );
  const retry = await createBooking(payload, request, undefined, actor);
  expect(retry.id).toBe(booking.id);
  const moved = await moveBooking(
    { id: booking.id, expectedVersion: 1, staffId, start: start(10) },
    key(),
    actor,
  );
  await cancelBooking(
    { id: booking.id, expectedVersion: moved.version },
    key(),
    actor,
  );
  const after = await db.booking.findUniqueOrThrow({
    where: { id: booking.id },
  });
  expect(after.customerName).toBe(before.customerName);
  expect(after.customerEmail).toBe(before.customerEmail);
  expect(after.serviceName).toBe(before.serviceName);
  expect(after.priceOre).toBe(before.priceOre);
  expect(after.customerId).toBe(c.id);
  expect(
    (await customerBookings(c.id, { view: "upcoming" }, actor)).bookings,
  ).toHaveLength(0);
  expect(
    (await customerBookings(c.id, { view: "history" }, actor)).bookings[0]
      .status,
  ).toBe("cancelled");
  expect(await getBooking(booking.id)).not.toHaveProperty("customerId");
  expect(await getBooking(booking.id, true)).toHaveProperty("customerId", c.id);
});
it("does not link public or local-agent snapshots by email or injected customerId", async () => {
  const c = await customer(),
    row = await db.customer.findUniqueOrThrow({ where: { id: c.id } });
  const booking = await createBooking(
    {
      customerId: c.id,
      serviceId,
      staffId,
      start: start(11),
      customerName: "Publikt angivet namn",
      customerEmail: row.email,
    },
    randomUUID(),
  );
  expect(booking.customerId).toBeNull();
  expect(booking.customerName).toBe("Publikt angivet namn");
  expect(
    (await db.customer.findUniqueOrThrow({ where: { id: c.id } })).name,
  ).toBe(row.name);
});
it("rejects foreign/inactive actors and cross-business customer links", async () => {
  const c = await customer(),
    foreignId = marker + "-foreign";
  customerIds.push(foreignId);
  await db.customer.create({
    data: {
      id: foreignId,
      businessId: "other-business",
      name: marker,
      email: "foreign@example.test",
    },
  });
  await expect(
    getCustomer(c.id, { kind: "admin", id: "guessed-user" }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(getCustomer(foreignId, actor)).rejects.toMatchObject({
    status: 404,
  });
  await expect(
    createBooking(
      { customerId: foreignId, serviceId, staffId, start: start(12) },
      randomUUID(),
      undefined,
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    db.booking.create({
      data: {
        businessId: "demo",
        customerId: foreignId,
        serviceId,
        staffId,
        startsAt: start(12),
        endsAt: start(13),
        customerName: "Fel verksamhet",
        customerEmail: "foreign@example.test",
      },
    }),
  ).rejects.toThrow();
});
it("masks list and non-demo card contacts, including MCP even when web demo is enabled", async () => {
  const c = await customer();
  expect(await getCustomer(c.id, actor)).toMatchObject({
    email: "***@***",
    phone: null,
    contactVisible: false,
  });
  const spy = vi.spyOn(demo, "demoAccessEnabled").mockReturnValue(true);
  try {
    expect((await getCustomer(c.id, actor)).email).toMatch(/@example\.test$/);
    expect((await getCustomer(c.id, LOCAL_WORKSPACE_ACTOR)).email).toBe(
      "***@***",
    );
    const list = await listCustomers({ q: marker }, actor);
    expect(JSON.stringify(list)).not.toContain("@example.test");
  } finally {
    spy.mockRestore();
  }
});
it("bounds pagination, rejects invalid input and prevents stale edits and archived bookings", async () => {
  const c = await customer();
  for (let i = 0; i < 6; i++) await customer();
  const first = await listCustomers({ q: marker, limit: 3 }, actor);
  expect(first.customers).toHaveLength(3);
  expect(first.nextCursor).toBeTruthy();
  const second = await listCustomers(
    { q: marker, limit: 3, cursor: first.nextCursor! },
    actor,
  );
  expect(
    second.customers.every((c) => !first.customers.some((a) => a.id === c.id)),
  ).toBe(true);
  await expect(listCustomers({ limit: 51 }, actor)).rejects.toThrow();
  await expect(listCustomers({ q: "x".repeat(81) }, actor)).rejects.toThrow();
  await editCustomer(
    { id: c.id, expectedVersion: 1, name: marker, archived: true },
    key(),
    actor,
  );
  await expect(
    editCustomer(
      { id: c.id, expectedVersion: 1, name: marker, archived: false },
      key(),
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    createBooking(
      { customerId: c.id, serviceId, staffId, start: start(14) },
      randomUUID(),
      undefined,
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
});
it("existing local workspace tools preserve a known customer link without returning contacts", async () => {
  const c = await customer(),
    client = new Client({ name: "customer-link-test", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      "--import",
      "tsx",
      "src/mcp/server.ts",
      "--admin",
      "--allow-workspace",
    ],
    env: mcpEnvironment({ workspace: true }),
  });
  try {
    await client.connect(transport);
    const result = await client.callTool({
      name: "create_booking",
      arguments: {
        serviceId,
        staffId,
        start: start(15),
        customerId: c.id,
        confirmed: true,
        clientRequestId: randomUUID(),
      },
    });
    expect(result.isError).not.toBeTruthy();
    const block = result.content[0];
    if (block.type !== "text") throw Error("Expected text");
    expect(block.text).not.toContain("customerEmail");
    expect(block.text).not.toContain("customerName");
    const booking = JSON.parse(block.text) as { id: string };
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .customerId,
    ).toBe(c.id);
    const request = randomUUID();
    ledgerKeys.push(
      createHash("sha256")
        .update(`local-mcp:${LOCAL_WORKSPACE_ACTOR.id}:${request}`)
        .digest("hex"),
    );
    const cancelled = await client.callTool({
      name: "cancel_booking",
      arguments: {
        id: booking.id,
        expectedVersion: 1,
        confirmed: true,
        clientRequestId: request,
      },
    });
    expect(cancelled.isError).not.toBeTruthy();
    expect(
      (await db.booking.findUniqueOrThrow({ where: { id: booking.id } }))
        .customerId,
    ).toBe(c.id);
  } finally {
    await client.close();
  }
}, 30000);
afterAll(async () => {
  await db.booking.deleteMany({ where: { staffId } });
  await db.customer.deleteMany({ where: { id: { in: customerIds } } });
  await db.workspaceRequest.deleteMany({ where: { key: { in: ledgerKeys } } });
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.adminUser.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});
