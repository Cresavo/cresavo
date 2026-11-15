import { afterAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createAgentApiKey, hashApiKey, revokeAgentApiKey } from "../../src/lib/agent-api/keys";
import { GET as services } from "../../src/app/api/v1/services/route";
import { GET as availability } from "../../src/app/api/v1/availability/route";

const agentName = `integration-agent-${Date.now()}`;
afterAll(async () => {
  const keys = await db.agentApiKey.findMany({ where: { agentName } });
  await db.agentApiKey.deleteMany({ where: { agentName } });
  await db.agentClient.deleteMany({ where: { id: { in: keys.map(k => k.clientId) } } });
  await db.$disconnect();
});
let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 5 });
while (day.weekday > 5) day = day.plus({ days: 1 });
const DAY = day.toISODate()!;
const call = (fn: (r: Request) => Promise<Response>, path: string, key: string) =>
  fn(new Request(`http://localhost${path}`, { headers: { authorization: `Bearer ${key}` } }));

describe("Agent API v1 mot PostgreSQL", () => {
  it("lagrar bara hash, läser seedad syntetisk data och nekar återkallad nyckel", async () => {
    const { key, record } = await createAgentApiKey(
      { businessId: "demo", agentName, ownerName: "Syntetisk Ägare", ownerContact: "owner@example.test" },
      db,
    );
    const row = await db.agentApiKey.findUniqueOrThrow({ where: { id: record.id } });
    expect(row.keyHash).toBe(hashApiKey(key));
    expect(JSON.stringify(row)).not.toContain(key.split("_").at(-1));

    const s = await call(services, "/api/v1/services?business=demo", key);
    expect(s.status).toBe(200);
    expect((await s.json()).services.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(["fotvard", "massage"]));

    const a = await call(availability, `/api/v1/availability?business=demo&service=fotvard&date=${DAY}`, key);
    expect(a.status).toBe(200);
    const body = await a.json();
    expect(body.slots.length).toBeGreaterThan(0);
    expect(body.slots[0].start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\+0[12]:00$/);
    expect((await db.agentApiKey.findUniqueOrThrow({ where: { id: record.id } })).lastUsedAt).toBeInstanceOf(Date);

    const foreign = await call(services, "/api/v1/services?business=another-salon", key);
    expect(foreign.status).toBe(403);

    await revokeAgentApiKey(record.id, db);
    expect((await call(services, "/api/v1/services?business=demo", key)).status).toBe(401);
  });

  it("databasen vägrar klartext i keyHash", async () => {
    await expect(
      db.agentApiKey.create({
        data: { client: { create: { id: `invalid-${agentName}`, businessId: "demo" } }, agentName, ownerName: "x", ownerContact: "x@example.test", keyPrefix: "plaintextxx1", keyHash: "blk_not_a_hash", scopes: [] },
      }),
    ).rejects.toThrow();
  });
});
