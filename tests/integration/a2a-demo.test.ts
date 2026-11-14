import { afterAll, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { SendMessageRequest } from "@a2a-js/sdk";
import {
  DefaultAgentCardResolver,
  ClientFactory,
  ClientFactoryOptions,
  JsonRpcTransportFactory,
} from "@a2a-js/sdk/client";
import { assertA2aDemo, startA2aDemo } from "../../src/a2a/demo";
import { db } from "../../src/lib/db";

const created: string[] = [];
const requestKeys: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  await db.booking.deleteMany({
    where: {
      OR: [
        { id: { in: created.splice(0) } },
        { idempotencyKey: { in: requestKeys.splice(0) } },
      ],
    },
  });
});
afterAll(async () => {
  await db.$disconnect();
});

it("local A2A refuses default, production, cloud and a non-test database", () => {
  vi.stubEnv("BOOKING_A2A_DEMO", "0");
  expect(assertA2aDemo).toThrow();
  vi.stubEnv("BOOKING_A2A_DEMO", "1");
  vi.stubEnv("NODE_ENV", "production");
  expect(assertA2aDemo).toThrow();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL", "1");
  expect(assertA2aDemo).toThrow();
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("DATABASE_URL", "postgresql://synthetic@remote.invalid/customers");
  expect(assertA2aDemo).toThrow();
});

it("official A2A client discovers, requests times and confirms exactly one booking", async () => {
  vi.stubEnv("BOOKING_A2A_DEMO", "1");
  const demo = await startA2aDemo();
  try {
    expect(
      (await fetch(demo.url + "/.well-known/agent-card.json")).status,
    ).toBe(403);
    const authenticated: typeof fetch = (url, init) =>
      fetch(url, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          authorization: `Bearer ${demo.token}`,
        },
      });
    const cardResponse = await authenticated(
      demo.url + "/.well-known/agent-card.json",
    );
    expect(cardResponse.status).toBe(200);
    expect(await cardResponse.json()).toMatchObject({
      supportedInterfaces: [{ protocolVersion: "1.0" }],
    });
    const client = new ClientFactory({
      ...ClientFactoryOptions.default,
      cardResolver: new DefaultAgentCardResolver({ fetchImpl: authenticated }),
      transports: [new JsonRpcTransportFactory({ fetchImpl: authenticated })],
    });
    const transport = await client.createFromUrl(demo.url);
    const send = async (input: unknown) => {
      if (
        input &&
        typeof input === "object" &&
        "action" in input &&
        input.action === "book" &&
        "clientRequestId" in input &&
        typeof input.clientRequestId === "string"
      )
        requestKeys.push(`a2a_${input.clientRequestId}`);
      const result = await transport.sendMessage(
        SendMessageRequest.fromJSON({
          message: {
            messageId: randomUUID(),
            role: "ROLE_USER",
            parts: [{ text: JSON.stringify(input) }],
          },
        }),
      );
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(
        /customerEmail|customerName|SESSION_SECRET|Prisma/,
      );
      if (!("parts" in result) || result.parts[0]?.content?.$case !== "text")
        throw new Error("A2A_EXPECTED_MESSAGE");
      return JSON.parse(result.parts[0].content.value);
    };
    let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 27 });
    while (day.weekday > 5) day = day.plus({ days: 1 });
    const selection = {
      serviceId: "massage",
      staffId: "staff-demo",
      date: day.toISODate(),
    };
    const before = await db.booking.count();
    const result = await send({ action: "availability", ...selection });
    expect(result.slots.length).toBeGreaterThan(1);
    expect(result).toMatchObject({
      service: { id: "massage", duration: 30, priceOre: 45000 },
      staff: { id: "staff-demo" },
      timeZone: "Europe/Stockholm",
    });
    expect(await db.booking.count()).toBe(before);
    const input = {
      action: "book",
      serviceId: selection.serviceId,
      staffId: selection.staffId,
      start: result.slots[0],
      serviceVersion: result.service.version,
      clientRequestId: randomUUID(),
      confirmed: true,
    };
    expect((await send({ ...input, confirmed: false })).error.status).toBe(400);
    expect(
      (await send({ ...input, serviceVersion: undefined })).error.status,
    ).toBe(400);
    expect(
      (await send({ ...input, serviceVersion: result.service.version + 1 }))
        .error.status,
    ).toBe(409);
    expect(await db.booking.count()).toBe(before);
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => send(input)),
    );
    const booked = attempts[0].booking;
    expect(booked).toBeDefined();
    created.push(booked.id);
    for (const attempt of attempts) expect(attempt.booking).toEqual(booked);
    expect(await db.booking.count()).toBe(before + 1);
    expect(
      await db.bookingEvent.count({
        where: { bookingId: booked.id, action: "create" },
      }),
    ).toBe(1);
    expect(
      (await send({ ...input, start: result.slots[1] })).error.status,
    ).toBe(409);
    expect(
      (await send({ ...input, clientRequestId: randomUUID() })).error.message,
    ).toBe("Tiden är inte tillgänglig");
    expect(
      (await send({ action: "availability", ...selection })).slots,
    ).not.toContain(input.start);
    const stored = await db.booking.findUniqueOrThrow({
      where: { id: booked.id },
    });
    expect(stored.startsAt.toISOString()).toBe(input.start);
    expect(stored.customerEmail).toBe("a2a-demo@example.test");
    const owner = new Client({ name: "a2a-owner-verification", version: "1" });
    try {
      await owner.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: ["--import", "tsx", "src/mcp/server.ts", "--admin"],
          env: mcpEnvironment(),
        }),
      );
      const read = await owner.callTool({
        name: "get_booking",
        arguments: { id: booked.id },
      });
      expect(read.isError).not.toBeTruthy();
      const block = read.content[0];
      if (block.type !== "text") throw new Error("MCP_EXPECTED_TEXT");
      expect(JSON.parse(block.text)).toMatchObject({
        id: booked.id,
        startsAt: input.start,
        version: 1,
      });
      expect(JSON.stringify(read)).not.toMatch(
        /customerName|customerEmail|a2a-demo@example.test/,
      );
    } finally {
      await owner.close();
    }
    expect((await send({ action: "cancel", id: booked.id })).error.status).toBe(
      400,
    );
    expect(
      (
        await authenticated(demo.url + "/a2a", {
          method: "POST",
          headers: { origin: "https://untrusted.invalid" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  } finally {
    await demo.close();
  }
}, 30000);
