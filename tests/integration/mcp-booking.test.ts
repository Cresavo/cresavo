import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { db } from "../../src/lib/db";
import {
  createBooking,
  getAvailability,
  listBookings,
} from "../../src/lib/domain";
import { DomainError } from "../../src/lib/errors";

const marker = `mcp-book-${randomUUID()}`;
const clients: Client[] = [];
let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 10 });
while (day.weekday > 5) day = day.plus({ days: 1 });
const date = day.toISODate()!;

async function connect(
  flags = ["--admin", "--allow-bookings"],
  env = mcpEnvironment({ booking: true }),
) {
  const client = new Client({ name: "synthetic-booking-test", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/mcp/server.ts", ...flags],
    env,
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (data) => {
    stderr += String(data);
  });
  clients.push(client);
  await client.connect(transport);
  return { client, stderr: () => stderr };
}
function payload(start: string, index = "one") {
  return {
    serviceId: "massage",
    start,
    customerName: "Syntetisk MCP-kund",
    customerEmail: `${marker}-${index}@example.test`,
    clientRequestId: randomUUID(),
    confirmed: true,
  };
}
function call(client: Client, input: Record<string, unknown>) {
  return client.callTool({ name: "create_booking", arguments: input });
}
function data(result: Awaited<ReturnType<typeof call>>) {
  expect(result.isError).not.toBeTruthy();
  const block = result.content[0];
  if (block.type !== "text") throw new Error("Expected text");
  return JSON.parse(block.text) as {
    id: string;
    serviceId: string;
    startsAt: string;
    endsAt: string;
  };
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await db.booking.deleteMany({
    where: { customerEmail: { startsWith: marker } },
  });
});
afterAll(async () => {
  await db.$disconnect();
});

describe("Local MCP booking", () => {
  it("rejects writes in default mode and in admin-only mode", async () => {
    const before = await db.booking.count();
    for (const flags of [[], ["--admin"]]) {
      const { client } = await connect(flags);
      expect((await client.listTools()).tools.map((t) => t.name)).not.toContain(
        "create_booking",
      );
      await expect(
        call(client, payload("2026-11-16T09:00:00+01:00")),
      ).rejects.toThrow();
    }
    expect(await db.booking.count()).toBe(before);
  }, 30000);

  it("rejects invalid startup configuration with a fixed error before exposing tools", () => {
    for (const [flags, secret] of [
      [["--allow-bookings"], "synthetic-secret-at-least-32-characters"],
      [["--admin", "--allow-bookings"], ""],
    ] as const) {
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "src/mcp/server.ts", ...flags],
        {
          env: {
            ...mcpEnvironment(),
            NODE_ENV: "test",
            SESSION_SECRET: secret,
          },
          encoding: "utf8",
          timeout: 10000,
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr.trim()).toBe("MCP_BOOKING_CONFIG_INVALID");
      expect(result.stdout).toBe("");
    }
  }, 30000);

  it("creates a booking visible in the admin query, minimizes the response, and reuses the key", async () => {
    const { client } = await connect();
    const input = payload((await getAvailability("massage", date))[0]);
    const original = data(await call(client, input));
    expect(Object.keys(original).sort()).toEqual([
      "endsAt",
      "id",
      "serviceId",
      "startsAt",
    ]);
    expect(original.startsAt).toBe(input.start);
    expect(data(await call(client, input))).toEqual(original);
    const conflict = await call(client, {
      ...input,
      customerName: "Annan syntetisk kund",
    });
    expect(conflict.isError).toBe(true);
    expect(conflict.content).toEqual([
      {
        type: "text",
        text: "This booking attempt was already used with different details.",
      },
    ]);
    const admin = await listBookings({ from: date, to: date });
    expect(
      admin.bookings.find((b) => b.id === original.id)?.customerEmail,
    ).toBe("***@***");
    expect(
      await db.booking.count({ where: { customerEmail: input.customerEmail } }),
    ).toBe(1);
  }, 30000);

  it("rejects unconfirmed, forged, or unauthorized input without writing", async () => {
    const { client, stderr } = await connect();
    const tool = (await client.listTools()).tools.find(
      (t) => t.name === "create_booking",
    )!;
    expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(tool.inputSchema.required).toEqual(
      expect.arrayContaining(["confirmed", "clientRequestId", "customerEmail"]),
    );
    const input = payload((await getAvailability("massage", date))[0]);
    const before = await db.booking.count();
    for (const bad of [
      { ...input, confirmed: false },
      { ...input, customerName: 42 },
      { ...input, clientRequestId: "x".repeat(65) },
      { ...input, customerEmail: "syntetisk@example.com" },
      { ...input, clientAddress: "spoof" },
      { ...input, start: "2026-02-30T09:00:00Z" },
    ]) {
      const result = await call(client, bad);
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: "Check the details and try again." },
      ]);
    }
    for (const bad of [
      { ...input, serviceId: "missing" },
      { ...input, start: "2020-01-01T09:00:00Z" },
      {
        ...input,
        start: day
          .set({ hour: 2, minute: 0, second: 0, millisecond: 0 })
          .toUTC()
          .toISO()!,
      },
    ])
      expect((await call(client, bad)).isError).toBe(true);
    expect(await db.booking.count()).toBe(before);
    expect(stderr()).not.toMatch(
      /clientAddress|Unrecognized|Input validation|syntetisk@example.com/,
    );
  }, 30000);

  it("20 concurrent MCP retries create one row and return the same ID", async () => {
    const { client } = await connect();
    const input = payload((await getAvailability("massage", date))[0]);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => call(client, input)),
    );
    expect(new Set(results.map((r) => data(r).id)).size).toBe(1);
    expect(
      await db.booking.count({ where: { customerEmail: input.customerEmail } }),
    ).toBe(1);
  }, 30000);

  it("mixed 30- and 60-minute MCP and domain calls produce exactly one winner with no overlaps", async () => {
    const { client } = await connect();
    const starts = await getAvailability("massage", date);
    const input = payload(starts[0]);
    const results = await Promise.all(
      Array.from({ length: 20 }, async (_, i) => {
        const v = {
          ...input,
          customerEmail: `${marker}-mixed-${i}@example.test`,
          clientRequestId: randomUUID(),
          serviceId: i % 2 ? "fotvard" : "massage",
          start: i % 2 ? starts[0] : starts[1],
        };
        if (i % 3) {
          const result = await call(client, v);
          if (result.isError)
            expect(result.content).toEqual([
              { type: "text", text: "That time is no longer available. Choose another time." },
            ]);
          return !result.isError;
        }
        try {
          await createBooking(v, v.clientRequestId);
          return true;
        } catch (error) {
          expect(error).toBeInstanceOf(DomainError);
          return false;
        }
      }),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const overlap = await db.$queryRaw<
      { count: bigint }[]
    >`SELECT count(*) FROM "Booking" a JOIN "Booking" b ON a.id < b.id AND a."businessId"=b."businessId" AND a."staffId"=b."staffId" AND tstzrange(a."startsAt",a."endsAt",'[)') && tstzrange(b."startsAt",b."endsAt",'[)')`;
    expect(Number(overlap[0].count)).toBe(0);
  }, 30000);

  it("enforces email and channel quotas across processes and permits replay at the cap", async () => {
    const { client } = await connect();
    const starts = await getAvailability("massage", date);
    const input = payload(starts[0]);
    const original = data(await call(client, input));
    for (let i = 1; i < 3; i++)
      data(
        await call(client, {
          ...input,
          start: starts[i],
          clientRequestId: randomUUID(),
        }),
      );
    expect(
      (
        await call(client, {
          ...input,
          start: starts[3],
          clientRequestId: randomUUID(),
        })
      ).isError,
    ).toBe(true);
    for (let i = 3; i < 5; i++)
      data(await call(client, payload(starts[i], String(i))));
    const rejected = await call(client, payload(starts[5], "six"));
    expect(rejected.content).toEqual([
      { type: "text", text: "Too many attempts. Please try again later." },
    ]);
    expect(rejected.isError).toBe(true);
    await client.close();
    const restarted = (await connect()).client;
    expect((await call(restarted, payload(starts[5], "restart"))).isError).toBe(
      true,
    );
    expect(data(await call(restarted, input))).toEqual(original);
    expect(
      await db.booking.count({
        where: { customerEmail: { startsWith: marker } },
      }),
    ).toBe(5);
  }, 30000);

  it("sanitizes database errors from the write tool and logs no secrets", async () => {
    const { client, stderr } = await connect(undefined, {
      ...mcpEnvironment({ booking: true }),
      DATABASE_URL:
        "postgresql://canary:CANARY_SECRET@127.0.0.1:1/unreachable_test?connect_timeout=1",
    });
    const result = await call(
      client,
      payload(day.set({ hour: 9, minute: 0 }).toUTC().toISO()!),
    );
    expect(result.content).toEqual([
      { type: "text", text: "Something went wrong. Try again." },
    ]);
    expect(result.isError).toBe(true);
    expect(stderr()).toContain("BOOKING_INTERNAL_ERROR");
    expect(stderr()).not.toMatch(/CANARY|postgresql:|PrismaClient/);
  }, 30000);
});
