import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { db } from "../../src/lib/db";
import { getAvailability } from "../../src/lib/domain";
import { listCalendar } from "../../src/lib/calendar";

const serviceId = `card-${randomUUID()}`;
const staffId = `card-${randomUUID()}`;
const date = DateTime.now()
  .setZone("Europe/Stockholm")
  .startOf("week")
  .plus({ weeks: 1 })
  .toISODate()!;
let client: Client;
let reader: Client;
let starts: string[];
const request = (patch = {}) => ({
  serviceId,
  staffId,
  serviceVersion: 1,
  start: starts[0],
  clientRequestId: randomUUID(),
  confirmed: true,
  ...patch,
});
const call = (arguments_: ReturnType<typeof request>) =>
  client.callTool({ name: "book_demo_time", arguments: arguments_ });

beforeAll(async () => {
  await db.service.create({
    data: {
      id: serviceId,
      businessId: "demo",
      name: "Syntetisk kortbehandling",
      duration: 30,
      priceOre: 45050,
    },
  });
  const base = await db.staff.findUniqueOrThrow({
    where: { id: "staff-demo" },
  });
  await db.staff.create({
    data: {
      id: staffId,
      businessId: "demo",
      name: "Korttest",
      serviceIds: [serviceId],
      weekly: base.weekly!,
    },
  });
  starts = await getAvailability(serviceId, date, db, staffId);
  const connect = async (write: boolean) => {
    const c = new Client({ name: "card-booking-test", version: "1" });
    await c.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "--import",
          "tsx",
          "src/mcp/time-card/server.ts",
          ...(write ? ["--admin", "--allow-bookings"] : []),
        ],
        env: {
          ...mcpEnvironment({ booking: write }),
          BOOKING_TIME_CARD_DEMO: "1",
          ...(write ? { BOOKING_TIME_CARD_BOOKINGS: "1" } : {}),
        },
      }),
    );
    return c;
  };
  client = await connect(true);
  reader = await connect(false);
});
afterEach(async () => {
  await db.cardBookingAttempt.deleteMany({
    where: { payload: { path: ["serviceId"], equals: serviceId } },
  });
  await db.booking.deleteMany({ where: { serviceId } });
});
afterAll(async () => {
  await client?.close();
  await reader?.close();
  await db.booking.deleteMany({ where: { serviceId } });
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.$disconnect();
});

describe("Restricted booking from the MCP card", () => {
  it("read mode cannot write and write mode exposes no admin tools", async () => {
    expect((await reader.listTools()).tools.map((t) => t.name).sort()).toEqual([
      "list_services",
      "show_time_picker",
    ]);
    await expect(
      reader.callTool({ name: "book_demo_time", arguments: request() }),
    ).rejects.toThrow();
    const tools = (await client.listTools()).tools;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "book_demo_time",
      "get_demo_calendar_file",
      "list_services",
      "read_demo_bookings",
      "show_time_picker",
    ]);
    expect(tools.find((t) => t.name === "book_demo_time")?._meta).toMatchObject(
      { ui: { visibility: ["app"] } },
    );
    expect(await db.booking.count({ where: { serviceId } })).toBe(0);
  });
  it("requires confirmation and rejects customer fields without writing", async () => {
    for (const patch of [
      { confirmed: false },
      { customerEmail: "canary@example.test" },
      { serviceVersion: undefined },
    ]) {
      const result = await call(request(patch));
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).not.toContain("canary");
    }
    expect(await db.booking.count({ where: { serviceId } })).toBe(0);
  });
  it("returns the same ID on retry and shows the booking in the same calendar", async () => {
    const args = request();
    const first = await call(args),
      retry = await call(args);
    expect(first.isError, JSON.stringify(first)).not.toBeTruthy();
    expect(retry.structuredContent).toEqual(first.structuredContent);
    expect(first.structuredContent).toMatchObject({
      demo: true,
      bookingCreated: true,
      priceOre: 45050,
      status: "confirmed",
      changedSinceCreation: false,
      serviceId,
      staffId,
    });
    expect(JSON.stringify(first)).not.toMatch(
      /customer|email|clientKey|requestHash|idempotency/i,
    );
    const calendar = await listCalendar({
      from: date,
      to: date,
      staffId,
      limit: 100,
    });
    expect(calendar.bookings).toHaveLength(1);
    expect(calendar.bookings[0].id).toBe(
      (first.structuredContent as Record<string, unknown>)?.id,
    );
    expect(calendar.bookings[0].customerName).toBe("Tidkort Demo");
    const conflict = await call({ ...args, start: starts[2] });
    expect(conflict.isError).toBe(true);
    expect(conflict.structuredContent).toMatchObject({
      error: { status: 409 },
    });
  });
  it("20 simultaneous retries produce exactly one booking and one creation event", async () => {
    const args = request();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => call(args)),
    );
    expect(results.every((r) => !r.isError)).toBe(true);
    expect(
      new Set(
        results.map(
          (r) => (r.structuredContent as Record<string, unknown>)?.id,
        ),
      ).size,
    ).toBe(1);
    expect(await db.booking.count({ where: { serviceId } })).toBe(1);
    expect(
      await db.bookingEvent.count({
        where: {
          booking: { serviceId },
          action: "create",
          actorKind: "local-mcp",
        },
      }),
    ).toBe(1);
  });
  it("20 different keys for one slot yield one winner without overlaps", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => call(request())),
    );
    expect(results.filter((r) => !r.isError)).toHaveLength(1);
    expect(
      results
        .filter((r) => r.isError)
        .every(
          (r) =>
            r.structuredContent &&
            (
              (r.structuredContent as Record<string, unknown>).error as {
                code: string;
              }
            ).code === "slot_unavailable",
        ),
    ).toBe(true);
    const overlaps = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM "Booking" a JOIN "Booking" b ON a.id < b.id AND a."staffId" = b."staffId" AND tstzrange(a."startsAt",a."endsAt",'[)') && tstzrange(b."startsAt",b."endsAt",'[)') WHERE a."serviceId"=${serviceId}`;
    expect(Number(overlaps[0].count)).toBe(0);
  });
  it("preserves the email quota and stays outside the admin quota", async () => {
    for (let i = 0; i < 3; i++)
      expect(
        (await call(request({ start: starts[i] }))).isError,
      ).not.toBeTruthy();
    const limited = await call(request({ start: starts[3] }));
    expect(limited.structuredContent).toMatchObject({ error: { status: 429 } });
    expect(await db.booking.count({ where: { serviceId } })).toBe(3);
  });
  it("requires a new selection before booking when the service version changes", async () => {
    const result = await call(request({ serviceVersion: 2 }));
    expect(result.structuredContent).toMatchObject({ error: { status: 409 } });
    expect(await db.booking.count({ where: { serviceId } })).toBe(0);
  });
  it("retrying after cancellation returns the current status without creating a booking", async () => {
    const args = request();
    const first = await call(args);
    const id = (first.structuredContent as Record<string, unknown>)
      .id as string;
    await db.booking.update({ where: { id }, data: { status: "cancelled" } });
    const retry = await call(args);
    expect(retry.structuredContent).toMatchObject({
      id,
      bookingCreated: true,
      status: "cancelled",
    });
    expect(await db.booking.count({ where: { serviceId } })).toBe(1);
  });
});
