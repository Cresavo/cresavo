import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { db } from "../../src/lib/db";
import { createBooking } from "../../src/lib/domain";
import { cancelBooking } from "../../src/lib/booking-mutations";
import {
  listCapacity,
  inspectCapacity,
  decideCapacity,
} from "../../src/lib/capacity";
import { mcpEnvironment } from "../../src/mcp/environment";
import { LOCAL_WORKSPACE_ACTOR } from "../../src/lib/workspace-write";

const marker = `capacity-${randomUUID()}`;
const actor = { kind: "admin" as const, id: marker };
const serviceId = marker,
  staffId = marker;
const day = DateTime.now()
  .setZone("Europe/Stockholm")
  .plus({ days: 2 })
  .startOf("day");
const bookingIds: string[] = [];
beforeAll(async () => {
  await db.adminUser.create({
    data: {
      id: marker,
      businessId: "demo",
      email: `${marker}@example.test`,
      passwordHash: "unused-synthetic",
    },
  });
  await db.service.create({
    data: {
      id: serviceId,
      businessId: "demo",
      name: "Syntetisk kapacitetsbehandling",
      duration: 30,
      priceOre: 45000,
    },
  });
  await db.staff.create({
    data: {
      id: staffId,
      businessId: "demo",
      name: "Syntetisk utförare",
      serviceIds: [serviceId],
      weekly: Array.from({ length: 7 }, (_, i) => ({
        weekday: i + 1,
        periods: [{ start: "09:00", end: "18:00" }],
        breaks: [],
      })),
      exceptions: [],
    },
  });
});
async function make(hour: number, cancel = true, at = day, minute = 0) {
  const b = await createBooking(
    {
      serviceId,
      staffId,
      start: at.set({ hour, minute }).toUTC().toISO()!,
      customerName: "Syntetisk kund hemligt namn",
      customerEmail: `${randomUUID()}@example.test`,
    },
    randomUUID(),
    undefined,
    actor,
  );
  bookingIds.push(b.id);
  if (cancel)
    await cancelBooking(
      { id: b.id, expectedVersion: b.version },
      randomUUID(),
      actor,
    );
  const result = await listCapacity({ limit: 20 }, actor);
  return result.suggestions.find((s) => s.bookingId === b.id)!;
}
afterAll(async () => {
  vi.restoreAllMocks();
  const decisions = await db.capacityDecision.findMany({
    where: { bookingId: { in: bookingIds } },
  });
  await db.capacityDecision.deleteMany({
    where: { bookingId: { in: bookingIds } },
  });
  await db.campaign.deleteMany({
    where: {
      id: {
        in: decisions.flatMap((d) => (d.campaignId ? [d.campaignId] : [])),
      },
    },
  });
  await db.booking.deleteMany({ where: { id: { in: bookingIds } } });
  // Each workspace result is minimerat; narrow cleanup through our own result IDs.
  const ids = [...bookingIds, ...decisions.map((d) => d.id)];
  for (const id of ids)
    await db.workspaceRequest.deleteMany({
      where: { result: { path: ["id"], equals: id } },
    });
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.adminUser.deleteMany({ where: { id: marker } });
  await db.$disconnect();
});
it("finds actual capacity without customer data and keeps dismissal on reload", async () => {
  const s = await make(9);
  expect(s.available).toBe(true);
  expect(s.serviceId).toBe(serviceId);
  expect(JSON.stringify(s)).not.toMatch(/customer|hemligt namn|@example/);
  const result = await decideCapacity(
    {
      bookingId: s.bookingId,
      sourceVersion: s.sourceVersion,
      expectedToken: s.expectedToken,
    },
    randomUUID(),
    actor,
    "dismiss",
  );
  expect(result.status).toBe("dismissed");
  expect(
    (await listCapacity({}, actor)).suggestions.find(
      (x) => x.bookingId === s.bookingId,
    )?.status,
  ).toBe("dismissed");
  await expect(
    decideCapacity({ ...s, unexpected: true }, randomUUID(), actor, "dismiss"),
  ).rejects.toThrow();
});
it("rejects changed staff configuration, unavailable service, expired and rebooked capacity", async () => {
  const s = await make(10),
    input = {
      bookingId: s.bookingId,
      sourceVersion: s.sourceVersion,
      expectedToken: s.expectedToken,
    };
  await db.staff.update({
    where: { id: staffId },
    data: {
      exceptions: [{ date: day.toISODate(), periods: [], breaks: [] }],
      version: { increment: 1 },
    },
  });
  expect(
    (await listCapacity({}, actor)).suggestions.find(
      (x) => x.bookingId === s.bookingId,
    )?.available,
  ).toBe(false);
  await expect(inspectCapacity(input, actor)).rejects.toMatchObject({
    status: 409,
  });
  await db.staff.update({
    where: { id: staffId },
    data: { exceptions: [], version: { increment: 1 } },
  });
  await expect(inspectCapacity(input, actor)).rejects.toMatchObject({
    status: 409,
  });
  await db.service.update({
    where: { id: serviceId },
    data: { active: false },
  });
  expect(
    (await listCapacity({}, actor)).suggestions.find(
      (x) => x.bookingId === s.bookingId,
    )?.available,
  ).toBe(false);
  await db.service.update({ where: { id: serviceId }, data: { active: true } });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(day.set({ hour: 11 }).toJSDate());
  try {
    expect(
      (await listCapacity({}, actor)).suggestions.find(
        (x) => x.bookingId === s.bookingId,
      )?.available,
    ).toBe(false);
  } finally {
    vi.useRealTimers();
  }
  await make(10, false);
  expect(
    (await listCapacity({}, actor)).suggestions.find(
      (x) => x.bookingId === s.bookingId,
    )?.available,
  ).toBe(false);
});
it("creates exactly one persistent draft for sequential retries and20 concurrent actors/keys", async () => {
  const s = await make(11);
  const input = {
    bookingId: s.bookingId,
    sourceVersion: s.sourceVersion,
    expectedToken: s.expectedToken,
    campaign: {
      serviceId,
      title: "Syntetiskt erbjudande",
      discountPercent: 12,
      validFrom: day.toISODate()!,
      validUntil: day.toISODate()!,
    },
  };
  const key = randomUUID();
  const versioned = {
    bookingId: s.bookingId,
    sourceVersion: s.sourceVersion,
    expectedToken: s.expectedToken,
  };
  await expect(
    inspectCapacity(
      { ...versioned, campaign: { ...input.campaign, serviceId: "fotvard" } },
      actor,
      true,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    inspectCapacity(
      {
        ...versioned,
        campaign: {
          ...input.campaign,
          validUntil: day.minus({ days: 1 }).toISODate()!,
        },
      },
      actor,
      true,
    ),
  ).rejects.toThrow();
  expect(await inspectCapacity(input, actor, true)).toHaveProperty(
    "calendarHref",
  );
  const concurrent = await Promise.all(
    Array.from({ length: 20 }, () =>
      decideCapacity(input, key, actor, "draft"),
    ),
  );
  const a = concurrent[0];
  expect(new Set(concurrent.map((x) => x.campaignId)).size).toBe(1);
  expect(await decideCapacity(input, key, actor, "draft")).toEqual(a);
  const all = await Promise.all(
    Array.from({ length: 20 }, () =>
      decideCapacity(input, randomUUID(), actor, "draft"),
    ),
  );
  expect(new Set(all.map((x) => x.campaignId)).size).toBe(1);
  expect(all[0].campaignId).toBe(a.campaignId);
  expect(await db.campaign.count({ where: { serviceId } })).toBe(1);
  expect(
    await db.campaign.findUnique({ where: { id: a.campaignId! } }),
  ).toMatchObject({
    published: false,
    validFrom: day.toISODate(),
    validUntil: day.toISODate(),
  });
  await expect(
    decideCapacity(
      { ...input, campaign: { ...input.campaign, discountPercent: 20 } },
      key,
      actor,
      "draft",
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    decideCapacity(input, key, { kind: "admin", id: "not-an-admin" }, "draft"),
  ).rejects.toMatchObject({ status: 403 });
  await make(11, false);
  const after = (await listCapacity({}, actor)).suggestions.find(
    (x) => x.bookingId === s.bookingId,
  )!;
  expect(after).toMatchObject({
    available: false,
    status: "draft",
    campaign: { id: a.campaignId },
  });
  const fresh = await make(12);
  const next = {
    ...input,
    bookingId: fresh.bookingId,
    sourceVersion: fresh.sourceVersion,
    expectedToken: fresh.expectedToken,
  };
  const mixed = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      decideCapacity(
        next,
        randomUUID(),
        i % 2 ? actor : LOCAL_WORKSPACE_ACTOR,
        "draft",
      ),
    ),
  );
  expect(new Set(mixed.map((x) => x.campaignId)).size).toBe(1);
  expect(await db.campaign.count({ where: { serviceId } })).toBe(2);
  await db.adminUser.update({ where: { id: marker }, data: { active: false } });
  await expect(
    decideCapacity(input, key, actor, "draft"),
  ).rejects.toMatchObject({ status: 403 });
  await db.adminUser.update({ where: { id: marker }, data: { active: true } });
});
it("bounds ranges and results and rejects foreign sources", async () => {
  await expect(listCapacity({ days: 8 }, actor)).rejects.toThrow();
  await expect(listCapacity({ limit: 21 }, actor)).rejects.toThrow();
  await expect(listCapacity({ from: "garbage" }, actor)).rejects.toThrow();
  await expect(
    listCapacity({ from: day.plus({ days: 7 }).toISODate() }, actor),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    inspectCapacity(
      { bookingId: "foreign", sourceVersion: 2, expectedToken: "a".repeat(64) },
      actor,
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect((await listCapacity({ limit: 1 }, actor)).suggestions.length).toBe(1);
});
it("keeps the eleventh actionable source reachable beyond ten handled sources", async () => {
  const earlier = day.minus({ days: 1 });
  const sources = [];
  for (let i = 0; i < 12; i++) {
    const s = await make(9 + Math.floor(i / 2), true, earlier, (i % 2) * 30);
    sources.push(s);
    if (i < 10)
      await decideCapacity(
        {
          bookingId: s.bookingId,
          sourceVersion: s.sourceVersion,
          expectedToken: s.expectedToken,
        },
        randomUUID(),
        actor,
        "dismiss",
      );
  }
  const query = { from: earlier.toISODate()!, days: 1, limit: 10 };
  const first = await listCapacity(query, actor);
  expect(first.suggestions).toHaveLength(10);
  expect(first.suggestions.every((s) => s.status === "dismissed")).toBe(true);
  expect(first.hasMore).toBe(true);
  const next = await listCapacity(
    { ...query, cursor: first.nextCursor! },
    actor,
  );
  expect(next.suggestions.map((s) => s.bookingId)).toEqual(
    sources.slice(10).map((s) => s.bookingId),
  );
  expect(next.suggestions.every((s) => s.available && s.status === "new")).toBe(
    true,
  );
  expect(next.nextCursor).toBeNull();
  expect(next.hasMore).toBe(false);
  for (const cursor of ["foreign-source", bookingIds[0]])
    await expect(listCapacity({ ...query, cursor }, actor)).rejects.toThrow(
      "This page does not match the date range. Showing the first page.",
    );
  expect(JSON.stringify(next)).not.toMatch(/customer|hemligt namn|@example/);
}, 15000);
it("MCP read/write opt-in exposes the same domain and rejects unknown fields", async () => {
  const s = await make(13),
    source = {
      bookingId: s.bookingId,
      sourceVersion: s.sourceVersion,
      expectedToken: s.expectedToken,
    };
  for (const { writes, only } of [
    { writes: false, only: false },
    { writes: false, only: true },
    { writes: true, only: true },
    { writes: true, only: false },
  ]) {
    const client = new Client({ name: "capacity-contract-test", version: "1" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        env: mcpEnvironment({ workspace: writes }),
        args: [
          "--import",
          "tsx",
          "src/mcp/server.ts",
          "--admin",
          ...(only ? ["--capacity-only"] : []),
          ...(writes ? ["--allow-workspace"] : []),
        ],
      }),
    );
    try {
      const tools = (await client.listTools()).tools.map((x) => x.name);
      expect(tools.includes("create_capacity_campaign_draft")).toBe(writes);
      expect(tools.includes("create_campaign_draft")).toBe(writes && !only);
      if (only) {
        expect(tools.sort()).toEqual(
          [
            "get_availability",
            "inspect_capacity_suggestion",
            "list_capacity_suggestions",
            "list_services",
            ...(writes
              ? [
                  "create_capacity_campaign_draft",
                  "dismiss_capacity_suggestion",
                ]
              : []),
          ].sort(),
        );
        for (const name of [
          "create_booking",
          "create_campaign_draft",
          "save_staff",
          "save_service",
          "export_customer_data",
          "remove_customer_contact",
        ])
          await expect(
            client.callTool({ name, arguments: {} }),
          ).rejects.toThrow();
      }
      const list = await client.callTool({
        name: "list_capacity_suggestions",
        arguments: {},
      });
      expect(list.isError).toBeFalsy();
      expect(JSON.stringify(list.content)).not.toMatch(
        /hemligt namn|customerEmail/,
      );
      const block = list.content[0];
      if (block.type !== "text") throw Error("MCP_TEXT_EXPECTED");
      const first = JSON.parse(block.text) as Awaited<
        ReturnType<typeof listCapacity>
      >;
      expect(first.nextCursor).not.toBeNull();
      const next = await client.callTool({
        name: "list_capacity_suggestions",
        arguments: { from: first.from, days: 7, cursor: first.nextCursor },
      });
      expect(next.isError).toBeFalsy();
      const nextBlock = next.content[0];
      if (nextBlock.type !== "text") throw Error("MCP_TEXT_EXPECTED");
      const second = JSON.parse(nextBlock.text) as Awaited<
        ReturnType<typeof listCapacity>
      >;
      expect(second.suggestions.length).toBeGreaterThan(0);
      expect(
        second.suggestions.every(
          (s) => !first.suggestions.some((a) => a.bookingId === s.bookingId),
        ),
      ).toBe(true);
      if (writes) {
        const v = {
          ...source,
          campaign: {
            serviceId,
            title: "Lokal MCP",
            discountPercent: 10,
            validFrom: day.toISODate()!,
            validUntil: day.toISODate()!,
          },
          confirmed: true,
          clientRequestId: randomUUID(),
        };
        expect(
          (
            await client.callTool({
              name: "create_capacity_campaign_draft",
              arguments: { ...v, unwanted: true },
            })
          ).isError,
        ).toBe(true);
        const result = await client.callTool({
          name: "create_capacity_campaign_draft",
          arguments: v,
        });
        expect(result.isError).toBeFalsy();
        expect(
          (
            await listCapacity(
              { from: first.from, days: 7, cursor: first.nextCursor! },
              actor,
            )
          ).suggestions.find((x) => x.bookingId === s.bookingId)?.status,
        ).toBe("draft");
      }
    } finally {
      await client.close();
    }
  }
}, 30000); // Four real stdio subprocesses, including their cold start.
