import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { test, expect } from "./fixtures";
import { socketClient } from "./http-client";
import { db } from "../../src/lib/db";
import { getAvailability } from "../../src/lib/domain";
import { mcpEnvironment } from "../../src/mcp/environment";

test.afterAll(async () => {
  await db.$disconnect();
});

test("publik HTTP kan inte återläsa kortets bokning med dess exakta nyckel", async ({
  synthetic,
}, testInfo) => {
  const serviceId = `replay-${synthetic.marker}`,
    staffId = `replay-staff-${synthetic.marker}`;
  await db.service.create({
    data: {
      id: serviceId,
      businessId: "demo",
      name: "Syntetiskt kanalprov",
      duration: 30,
      priceOre: 45000,
    },
  });
  synthetic.trackResource("service", serviceId);
  const base = await db.staff.findUniqueOrThrow({
    where: { id: "staff-demo" },
  });
  await db.staff.create({
    data: {
      id: staffId,
      businessId: "demo",
      name: "Demo kanalpersonal",
      weekly: base.weekly!,
      serviceIds: [serviceId],
    },
  });
  synthetic.trackResource("staff", staffId);
  const date = DateTime.now()
    .setZone("Europe/Stockholm")
    .startOf("week")
    .plus({ weeks: 1 })
    .toISODate()!;
  const args = {
    serviceId,
    staffId,
    serviceVersion: 1,
    start: (await getAvailability(serviceId, date, db, staffId))[0],
    clientRequestId: randomUUID(),
    confirmed: true,
  };
  const card = new Client({ name: "http-replay-proof", version: "1" });
  try {
    await card.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [
          "--import",
          "tsx",
          "src/mcp/time-card/server.ts",
          "--admin",
          "--allow-bookings",
        ],
        env: {
          ...mcpEnvironment({ booking: true }),
          BOOKING_TIME_CARD_DEMO: "1",
          BOOKING_TIME_CARD_BOOKINGS: "1",
        },
      }),
    );
    const original = await card.callTool({
      name: "book_demo_time",
      arguments: args,
    });
    expect(original.isError, JSON.stringify(original)).not.toBeTruthy();
    const client = socketClient(
      testInfo.project.name === "desktop" ? "127.0.0.121" : "127.0.0.122",
    );
    const replays = await Promise.all(
      Array.from({ length: 20 }, () =>
        client.post("/api/bookings", {
          headers: {
            origin: "http://localhost:3000",
            "Idempotency-Key": `time-card_${args.clientRequestId}`,
          },
          data: {
            ...args,
            customerName: "Tidkort Demo",
            customerEmail: "tidkort@example.test",
          },
        }),
      ),
    );
    for (const response of replays) {
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({
        error: "This demo profile cannot access the booking.",
      });
    }
    const ownReplay = await card.callTool({
      name: "book_demo_time",
      arguments: args,
    });
    expect(ownReplay.isError).not.toBeTruthy();
    expect(ownReplay.structuredContent).toMatchObject({
      id: (original.structuredContent as { id: string }).id,
    });
    expect(await db.booking.count({ where: { serviceId } })).toBe(1);
    expect(
      await db.bookingEvent.count({ where: { booking: { serviceId } } }),
    ).toBe(1);
  } finally {
    await card.close();
  }
});
