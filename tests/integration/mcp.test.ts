import { mcpEnvironment } from "../../src/mcp/environment";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { db } from "../../src/lib/db";

const marker = `mcp-${randomUUID()}`;
const customerEmail = `${marker}@example.test`;
const day = { from: "2027-03-28", to: "2027-03-28" };
const ids = Array.from(
  { length: 105 },
  (_, i) => `${marker}-${String(i).padStart(2, "0")}`,
);
let admin: Client;

async function connect(adminMode: boolean) {
  const client = new Client({ name: "test", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      env: mcpEnvironment(),
      args: [
        "--env-file-if-exists=.env",
        "--import",
        "tsx",
        "src/mcp/server.ts",
        ...(adminMode ? ["--admin"] : []),
      ],
    }),
  );
  return client;
}

async function list(args: Record<string, unknown>) {
  return admin.callTool({ name: "list_bookings", arguments: args });
}

type Page = {
  bookings: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    service: { id: string; name: string };
  }>;
  nextCursor: string | null;
};
function readPage(result: Awaited<ReturnType<typeof list>>): Page {
  expect(result.isError).not.toBeTruthy();
  const block = result.content[0];
  if (block.type !== "text") throw new Error("Förväntade textsvar");
  return JSON.parse(block.text) as Page;
}

beforeAll(async () => {
  const first = new Date("2027-03-27T23:00:00.000Z"); // 00:00 Stockholm, before the DST transition.
  const rows = ids.map((id, i) => {
    // The last record shares a start time with the first, but belongs to a different synthetic staff member.
    const start = new Date(first.getTime() + (i === 104 ? 0 : i * 12 * 60000));
    return {
      id,
      businessId: "demo",
      staffId: `${marker}-staff-${i}`,
      serviceId: "fotvard",
      startsAt: start,
      endsAt: new Date(start.getTime() + 30 * 60000),
      customerName: "Syntetisk testkund",
      customerEmail,
    };
  });
  for (const [id, start, businessId] of [
    [`${marker}-before`, "2027-03-27T22:59:59.999Z", "demo"],
    [`${marker}-after`, "2027-03-28T22:00:00.000Z", "demo"],
    [`${marker}-other`, "2027-03-27T23:00:00.000Z", "other"],
  ]) {
    const startsAt = new Date(start);
    rows.push({
      id,
      businessId,
      staffId: `${marker}-${id}`,
      serviceId: "fotvard",
      startsAt,
      endsAt: new Date(startsAt.getTime() + 30 * 60000),
      customerName: "Syntetisk testkund",
      customerEmail,
    });
  }
  await db.booking.createMany({ data: rows });
  admin = await connect(true);
});

afterAll(async () => {
  if (admin) await admin.close();
  await db.booking.deleteMany({ where: { customerEmail } });
  await db.$disconnect();
});

describe("Lokal MCP-behörighet och dataminimering", () => {
  it("sanerar verkliga databasfel innan MCP-klienten får svaret", async () => {
    const client = new Client({ name: "failure-test", version: "1" });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/mcp/server.ts", "--admin"],
      env: {
        ...mcpEnvironment(),
        DATABASE_URL:
          "postgresql://canary:CANARY_SECRET@127.0.0.1:1/canary?connect_timeout=1",
      },
      stderr: "pipe",
    });
    let stderr = "";
    transport.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    try {
      await client.connect(transport);
      for (const [name, args] of [
        ["list_services", {}],
        ["get_availability", { serviceId: "fotvard", date: day.from }],
        ["list_bookings", day],
        [
          "create_campaign_draft",
          {
            serviceId: "fotvard",
            title: "Syntetisk",
            discountPercent: 20,
            validFrom: day.from,
            validUntil: day.to,
          },
        ],
      ] as const) {
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([
          { type: "text", text: "Something went wrong. Try again." },
        ]);
      }
    } finally {
      await client.close();
    }
    expect(stderr).not.toMatch(/CANARY|postgresql:|PrismaClient|canary/);
    expect(stderr).toContain("BOOKING_INTERNAL_ERROR");
  });
  it("erbjuder inte adminverktyg utan uttryckligt adminläge", async () => {
    const client = await connect(false);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        "get_availability",
        "list_services",
      ]);
      await expect(
        client.callTool({ name: "list_bookings", arguments: day }),
      ).rejects.toThrow();
      await expect(
        client.callTool({ name: "create_campaign_draft", arguments: {} }),
      ).rejects.toThrow();
    } finally {
      await client.close();
    }
  });

  it("ger högst 20 minimerade bokningar som standard inom lokalt datum", async () => {
    const page = readPage(await list(day));
    expect(page.bookings).toHaveLength(20);
    expect(page.nextCursor).toBe(page.bookings[19].id);
    for (const booking of page.bookings) {
      expect(Object.keys(booking).sort()).toEqual([
        "endsAt",
        "id",
        "service",
        "startsAt",
      ]);
      expect(Object.keys(booking.service).sort()).toEqual(["id", "name"]);
      expect(JSON.stringify(booking)).not.toContain(customerEmail);
      expect(JSON.stringify(booking)).not.toContain("Syntetisk testkund");
    }
  });

  it("paginera stabilt utan dubbletter och håll verksamhet och datumgränser", async () => {
    const found: Page["bookings"] = [];
    let cursor: string | null = null;
    do {
      const page = readPage(
        await list({ ...day, limit: 7, ...(cursor ? { cursor } : {}) }),
      );
      expect(page.bookings.length).toBeLessThanOrEqual(7);
      found.push(...page.bookings);
      cursor = page.nextCursor;
    } while (cursor);
    expect(found.map((b) => b.id)).toHaveLength(105);
    expect(new Set(found.map((b) => b.id))).toEqual(new Set(ids));
    expect(found.map((b) => `${b.startsAt}:${b.id}`)).toEqual(
      [...found].map((b) => `${b.startsAt}:${b.id}`).sort(),
    );
    const first = readPage(await list({ ...day, limit: 100 }));
    expect(first.bookings).toHaveLength(100);
    expect(first.nextCursor).toBeTruthy();
    const last = readPage(
      await list({ ...day, limit: 100, cursor: first.nextCursor }),
    );
    expect(last.bookings).toHaveLength(5);
    expect(last.nextCursor).toBeNull();
    expect(
      readPage(await list({ from: "2027-03-01", to: "2027-03-31", limit: 100 }))
        .bookings,
    ).toHaveLength(100);
  });

  it("avvisar för stora sidor, felaktiga datum och ogiltiga markörer", async () => {
    const draft = await admin.callTool({
      name: "create_campaign_draft",
      arguments: {
        serviceId: "fotvard",
        title: "Syntetisk",
        discountPercent: 20,
        validFrom: "2027-03-01",
        validUntil: "2027-03-02",
        unknown: true,
      },
    });
    expect(draft.isError).toBe(true);
    for (const args of [
      {},
      { ...day, limit: 101 },
      { ...day, limit: 0 },
      { ...day, limit: 1.5 },
      { from: "2027-02-30", to: "2027-03-01" },
      { from: "2027-04-01", to: "2027-03-31" },
      { from: "2027-03-01", to: "2027-04-01" },
      { ...day, cursor: `${marker}-other` },
      { ...day, cursor: `${marker}-before` },
      { ...day, cursor: "saknas" },
      { ...day, includeCustomer: true },
    ])
      expect((await list(args)).isError).toBe(true);
  });
});
