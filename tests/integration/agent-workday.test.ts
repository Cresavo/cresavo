import { beforeAll, afterEach, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHmac } from "node:crypto";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { db } from "../../src/lib/db";
import { getAvailability } from "../../src/lib/domain";
import { mcpEnvironment } from "../../src/mcp/environment";
const serviceId = `workday-${randomUUID()}`,
  staffId = `workday-${randomUUID()}`;
const date = DateTime.now()
  .setZone("Europe/Stockholm")
  .startOf("week")
  .plus({ weeks: 1 })
  .toISODate()!;
let starts: string[],
  clients: Client[] = [];
async function connect(owner = false, secret = process.env.SESSION_SECRET!) {
  const c = new Client({ name: "workday-integration", version: "1" });
  await c.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        owner ? "src/mcp/server.ts" : "src/mcp/time-card/server.ts",
        "--admin",
        owner ? "--workday-card" : "--allow-bookings",
      ],
      env: {
        ...mcpEnvironment({ booking: true }),
        SESSION_SECRET: secret,
        ...(owner
          ? { BOOKING_OWNER_CARD_DEMO: "1" }
          : { BOOKING_TIME_CARD_DEMO: "1", BOOKING_TIME_CARD_BOOKINGS: "1" }),
      },
    }),
  );
  clients.push(c);
  return c;
}
const call = (c: Client, name: string, args: Record<string, unknown> = {}) =>
  c.callTool({ name, arguments: args });
const request = (patch = {}) => ({
  serviceId,
  staffId,
  serviceVersion: 1,
  start: starts[0],
  clientRequestId: randomUUID(),
  confirmed: true,
  ...patch,
});
beforeAll(async () => {
  await db.service.create({
    data: {
      id: serviceId,
      businessId: "demo",
      name: "Demo återhämtning",
      duration: 30,
      priceOre: 45050,
      buffer: 15,
    },
  });
  const staff = await db.staff.findUniqueOrThrow({
    where: { id: "staff-demo" },
  });
  await db.staff.create({
    data: {
      id: staffId,
      businessId: "demo",
      name: "Demo arbetsdag",
      weekly: staff.weekly!,
      serviceIds: [serviceId],
    },
  });
  starts = await getAvailability(serviceId, date, db, staffId);
});
afterEach(async () => {
  await Promise.all(clients.map((c) => c.close()));
  clients = [];
  await db.cardBookingAttempt.deleteMany({
    where: { payload: { path: ["serviceId"], equals: serviceId } },
  });
  await db.booking.deleteMany({ where: { serviceId } });
});
afterAll(async () => {
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.$disconnect();
});
describe("Beständig lokal demobokning och arbetsdag", () => {
  it("begränsar historiken men tappar aldrig ett äldre oklart försök", async () => {
    const c = await connect();
    const scope = createHmac("sha256", process.env.SESSION_SECRET!)
      .update("demo:time-card-recovery:v1")
      .digest("hex");
    const old = request();
    await db.cardBookingAttempt.create({
      data: {
        businessId: "demo",
        scope,
        requestId: old.clientRequestId,
        payload: old,
        createdAt: new Date("2020-01-01T00:00:00Z"),
      },
    });
    const attempts = Array.from({ length: 25 }, () => request());
    await db.cardBookingAttempt.createMany({
      data: attempts.map((payload) => ({
        businessId: "demo",
        scope,
        requestId: payload.clientRequestId,
        payload,
        outcome: "saved",
      })),
    });
    const result = (await call(c, "read_demo_bookings")).structuredContent as {
      items: { requestId: string; outcome: string }[];
    };
    expect(result.items).toHaveLength(21);
    expect(result.items[0]).toMatchObject({
      requestId: old.clientRequestId,
      outcome: "pending",
    });
    await expect(
      db.cardBookingAttempt.create({
        data: {
          businessId: "demo",
          scope,
          requestId: randomUUID(),
          payload: request(),
        },
      }),
    ).rejects.toThrow();
  });
  it("återläser efter MCP-processomstart, utan id- eller e-postuppslag", async () => {
    let c = await connect();
    const args = request();
    const first = await call(c, "book_demo_time", args);
    expect(first.isError, JSON.stringify(first)).not.toBeTruthy();
    await c.close();
    c = await connect();
    const result = await call(c, "read_demo_bookings");
    expect(result.structuredContent).toMatchObject({
      items: [
        {
          requestId: args.clientRequestId,
          outcome: "saved",
          receipt: { id: (first.structuredContent as { id: string }).id },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /customerName|customerEmail|requestHash|clientKey|emailCapKey|SESSION_SECRET/,
    );
    expect(
      (
        await call(c, "read_demo_bookings", {
          id: (first.structuredContent as { id: string }).id,
        })
      ).isError,
    ).toBe(true);
  });
  it("annan profil kan inte läsa eller återspela känd nyckel", async () => {
    const c = await connect(),
      args = request();
    await call(c, "book_demo_time", args);
    const other = await connect(false, "other-synthetic-secret".repeat(3));
    expect(
      (
        await call(other, "read_demo_bookings", {
          requestId: args.clientRequestId,
        })
      ).isError,
    ).toBe(true);
    expect((await call(other, "book_demo_time", args)).isError).toBe(true);
    expect(
      (await call(other, "read_demo_bookings")).structuredContent,
    ).toMatchObject({ items: [] });
    expect(await db.booking.count({ where: { serviceId } })).toBe(1);
  });
  it("återhämtar beständigt försök före write och blockerar annan tid tills retry", async () => {
    const c = await connect(),
      args = request();
    await call(c, "book_demo_time", args);
    const attempt = await db.cardBookingAttempt.findFirstOrThrow({
      where: { requestId: args.clientRequestId },
    });
    await db.booking.deleteMany({ where: { serviceId } });
    await db.cardBookingAttempt.update({
      where: {
        businessId_scope_requestId: {
          businessId: "demo",
          scope: attempt.scope,
          requestId: args.clientRequestId,
        },
      },
      data: { outcome: "pending" },
    });
    await c.close();
    const restarted = await connect();
    expect(
      (await call(restarted, "read_demo_bookings")).structuredContent,
    ).toMatchObject({ items: [{ outcome: "pending", retry: args }] });
    expect(
      (await call(restarted, "book_demo_time", request({ start: starts[2] })))
        .isError,
    ).toBe(true);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => call(restarted, "book_demo_time", args)),
    );
    expect(results.every((r) => !r.isError)).toBe(true);
    expect(await db.booking.count({ where: { serviceId } })).toBe(1);
  });
  it("visar aktuellt flyttat/avbokat kvitto och nekar kalenderfil efter avbokning", async () => {
    const c = await connect(),
      args = request();
    const result = await call(c, "book_demo_time", args),
      id = (result.structuredContent as { id: string }).id;
    const moved = new Date(starts[2]);
    await db.booking.update({
      where: { id },
      data: {
        startsAt: moved,
        endsAt: new Date(+moved + 45 * 60000),
        version: { increment: 1 },
      },
    });
    expect(
      (await call(c, "read_demo_bookings", { requestId: args.clientRequestId }))
        .structuredContent,
    ).toMatchObject({
      items: [
        {
          receipt: {
            startsAt: moved.toISOString(),
            changedSinceCreation: true,
          },
        },
      ],
    });
    const file = await call(c, "get_demo_calendar_file", {
      requestId: args.clientRequestId,
    });
    expect(file.isError).not.toBeTruthy();
    const ics = (file.structuredContent as { content: string }).content;
    expect(ics).toContain(
      "DTEND:" +
        new Date(+moved + 30 * 60000)
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(".000Z", "Z"),
    );
    await db.booking.update({
      where: { id },
      data: { status: "cancelled", version: { increment: 1 } },
    });
    expect(
      (await call(c, "read_demo_bookings", { requestId: args.clientRequestId }))
        .structuredContent,
    ).toMatchObject({ items: [{ receipt: { status: "cancelled" } }] });
    expect(
      (
        await call(c, "get_demo_calendar_file", {
          requestId: args.clientRequestId,
        })
      ).isError,
    ).toBe(true);
  });
  it("ägarkortet är enbart läsande, korrekt avgränsat och kontaktfritt", async () => {
    const c = await connect(),
      args = request();
    await call(c, "book_demo_time", args);
    const owner = await connect(true);
    expect((await owner.listTools()).tools.map((t) => t.name)).toEqual([
      "show_workday",
    ]);
    const result = await call(owner, "show_workday", {
      date,
      staffId,
      serviceId,
    });
    expect(result.isError, JSON.stringify(result)).not.toBeTruthy();
    expect(result.structuredContent).toMatchObject({
      date,
      bookings: [{ serviceName: "Demo återhämtning" }],
      nextVisit: { serviceName: "Demo återhämtning" },
    });
    expect(JSON.stringify(result)).not.toMatch(
      /customer|email|Tidkort Demo|requestHash|clientKey/i,
    );
    expect(
      (await call(owner, "show_workday", { date: "invalid" })).isError,
    ).toBe(true);
    await expect(call(c, "show_workday", {})).rejects.toThrow();
    expect(await db.booking.count({ where: { serviceId } })).toBe(1);
  });
  it("paginering över 20 bokningar och främmande markör", async () => {
    const owner = await connect(true);
    const base = DateTime.fromISO(date, { zone: "Europe/Stockholm" });
    await db.booking.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        businessId: "demo",
        staffId,
        serviceId,
        serviceName: "Demo listbesök",
        startsAt: base.plus({ hours: 8, minutes: i * 15 }).toJSDate(),
        endsAt: base.plus({ hours: 8, minutes: i * 15 + 10 }).toJSDate(),
        duration: 10,
        customerName: "Canary customer",
        customerEmail: "canary@example.test",
      })),
    });
    const first = (
      await call(owner, "show_workday", { date, staffId, serviceId })
    ).structuredContent as { bookings: unknown[]; nextCursor: string };
    expect(first.bookings).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    const next = (
      await call(owner, "show_workday", {
        date,
        staffId,
        serviceId,
        cursor: first.nextCursor,
      })
    ).structuredContent as { bookings: unknown[]; nextCursor: string | null };
    expect(next.bookings).toHaveLength(5);
    expect(next.nextCursor).toBeNull();
    expect(
      (
        await call(owner, "show_workday", {
          date,
          staffId,
          serviceId,
          cursor: randomUUID(),
        })
      ).isError,
    ).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/Canary|canary/);
  });
});
