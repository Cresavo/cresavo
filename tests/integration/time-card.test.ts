import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { mcpEnvironment } from "../../src/mcp/environment";
import { db } from "../../src/lib/db";
import { timeCardData } from "../../src/mcp/time-card/data";

const marker = randomUUID();
const monday = DateTime.now()
  .setZone("Europe/Stockholm")
  .startOf("week")
  .plus({ weeks: 1 })
  .toISODate()!;
let client: Client;
beforeAll(async () => {
  client = new Client({ name: "time-card-test", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/mcp/time-card/server.ts"],
      env: { ...mcpEnvironment(), BOOKING_TIME_CARD_DEMO: "1" },
    }),
  );
});
afterAll(async () => {
  await client?.close();
  await db.booking.deleteMany({ where: { id: marker } });
  await db.$disconnect();
});

describe("Tidvalskort via verklig stdio MCP", () => {
  it("stops a misconfigured process before it calls the database", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "src/mcp/time-card/server.ts"],
      {
        env: {
          ...mcpEnvironment(),
          BOOKING_TIME_CARD_DEMO: "1",
          NODE_ENV: "production",
          DATABASE_URL:
            "postgresql://canary:DO_NOT_ECHO@remote.test/real_customers",
        },
        encoding: "utf8",
        timeout: 15000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toBe("TIME_CARD_DEMO_REFUSED");
  });
  it("exposes only two read tools and a sandboxed UI resource", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "list_services",
      "show_time_picker",
    ]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
    const resource = await client.readResource({
      uri: "ui://booking-lab/time-card-v1.html",
    });
    expect(resource.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(resource.contents[0]._meta).toMatchObject({
      ui: { csp: { connectDomains: [], resourceDomains: [] } },
    });
    await expect(
      client.callTool({ name: "create_booking", arguments: {} }),
    ).rejects.toThrow();
  });
  it("returns structured results and fallback text without customer details", async () => {
    const result = await client.callTool({
      name: "show_time_picker",
      arguments: { serviceId: "massage", staffId: "staff-demo", date: monday },
    });
    expect(result.isError).not.toBeTruthy();
    expect(result.structuredContent).toMatchObject({
      demo: true,
      bookingCreated: false,
      timezone: "Europe/Stockholm",
      service: { name: "Massage", duration: 30, priceOre: 45000 },
      selectedStaff: { name: "Anna" },
    });
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Selecting a time does not reserve it"),
    });
    expect(JSON.stringify(result)).not.toMatch(
      /customerEmail|customerName|emailCapKey|requestHash|idempotencyKey/,
    );
  });
  it("uses the same domain rules to hide newly booked times without tool writes", async () => {
    const args = { serviceId: "massage", staffId: "staff-demo", date: monday };
    const before = await timeCardData(args);
    const slot = before.slots[0];
    expect(slot).toBeDefined();
    await db.booking.create({
      data: {
        id: marker,
        businessId: "demo",
        serviceId: "massage",
        staffId: "staff-demo",
        startsAt: new Date(slot.start),
        endsAt: new Date(slot.end),
        customerName: "Syntetisk kontaktkanariefågel",
        customerEmail: "card-canary@example.test",
      },
    });
    const result = await client.callTool({
      name: "show_time_picker",
      arguments: args,
    });
    expect(JSON.stringify(result)).not.toContain("card-canary");
    const body = result.structuredContent as Awaited<
      ReturnType<typeof timeCardData>
    >;
    expect(body.slots.some((s) => s.start === slot.start)).toBe(false);
    expect(await db.booking.count({ where: { id: marker } })).toBe(1);
  });
  it("handles Sunday closure and enforces a 28-day limit", async () => {
    const date = DateTime.fromISO(monday).plus({ days: 6 }).toISODate()!;
    expect(
      (
        await timeCardData({
          serviceId: "massage",
          staffId: "staff-demo",
          date,
        })
      ).slots,
    ).toEqual([]);
    for (const days of [-1, 28]) {
      const date = DateTime.now()
        .setZone("Europe/Stockholm")
        .plus({ days })
        .toISODate()!;
      const result = await client.callTool({
        name: "show_time_picker",
        arguments: { date },
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({
        text: "Choose a date within the next 28 days.",
      });
    }
  });
  it("sanitizes invalid and unauthorized input", async () => {
    const result = await client.callTool({
      name: "show_time_picker",
      arguments: { customerEmail: "DO_NOT_ECHO@example.test", date: "garbage" },
    });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).not.toContain("DO_NOT_ECHO");
  });
});
