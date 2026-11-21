import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getSalon } from "../../src/app/api/owner/salon/route";
import { POST as postAction } from "../../src/app/api/owner/salon/actions/route";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { openOwnerSession, OWNER_COOKIE } from "../../src/lib/owner-session";

// The owner salon API against a disposable local *_test database. All data is fictional.

const run = randomUUID().slice(0, 8);
const origin = "http://localhost";
const service = { name: "Klassisk fotvård", duration: 60, price: 650, category: "menu", description: "", staffIds: ["staff-1"] };

async function owner(name: string) {
  const result = await createOwnerAccount({ email: `${name.toLowerCase().replace(/\s+/g, "-")}-${run}@example.test`, password: "a long fictional passphrase", salonName: name, language: "sv" });
  if (!result.ok) throw new Error("sign-up failed");
  const session = await openOwnerSession(result.identity);
  return { tenantId: result.tenantId, cookie: `${OWNER_COOKIE}=${session!.value}` };
}

const read = (cookie: string) => getSalon(new NextRequest(`${origin}/api/owner/salon`, { headers: { cookie } }));
const send = (cookie: string, body: unknown) => postAction(new NextRequest(`${origin}/api/owner/salon/actions`, {
  method: "POST", body: JSON.stringify(body), headers: { cookie, origin, host: "localhost", "content-type": "application/json" },
}));

beforeAll(() => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("STUDIO_STORE_HMAC_SECRET", randomBytes(32).toString("hex"));
});

afterAll(async () => {
  const accounts = await db.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  const tenants = accounts.map((a) => a.tenantId);
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = ANY($1)`, tenants);
  vi.unstubAllEnvs();
  await db.$disconnect();
});

describe("owner salon API", () => {
  it("loads the signed-in owner's salon and saves a change", async () => {
    const a = await owner("Salong A");
    const loaded = await (await read(a.cookie)).json();
    expect(loaded.state.salon.name).toBe("Salong A");
    const response = await send(a.cookie, { action: { type: "service/add", service }, expectedVersion: loaded.version, idempotencyKey: "add-foot-1" });
    expect(response.status).toBe(200);
    const saved = await response.json();
    expect(saved.version).toBe(loaded.version + 1);
    expect((await (await read(a.cookie)).json()).state.services.map((s: { name: string }) => s.name)).toEqual(["Klassisk fotvård"]);
  });

  it("replays a retried change instead of applying it twice", async () => {
    const a = await owner("Salong Retry");
    const body = { action: { type: "service/add", service }, idempotencyKey: "retry-1" };
    const first = await (await send(a.cookie, body)).json();
    const again = await (await send(a.cookie, body)).json();
    expect(again).toMatchObject({ version: first.version, replayed: true });
    expect((await (await read(a.cookie)).json()).state.services).toHaveLength(1);
  });

  it("keeps two salons apart", async () => {
    const a = await owner("Salong Alfa");
    const b = await owner("Salong Beta");
    await send(a.cookie, { action: { type: "service/add", service }, idempotencyKey: "alfa-1" });
    const salonB = (await (await read(b.cookie)).json()).state;
    expect(salonB.salon.name).toBe("Salong Beta");
    expect(salonB.services).toEqual([]);
  });

  it("refuses stale versions, unknown or customer actions, and signed-out callers", async () => {
    const a = await owner("Salong Guard");
    expect((await send(a.cookie, { action: { type: "service/add", service }, expectedVersion: 99, idempotencyKey: "stale-1" })).status).toBe(409);
    expect((await send(a.cookie, { action: { type: "online/book" }, idempotencyKey: "guest-1" })).status).toBe(400);
    expect((await send(a.cookie, { action: { type: "customer/erase", id: "x" }, idempotencyKey: "erase-1" })).status).toBe(400);
    expect((await send(a.cookie, { action: { type: "service/add", service }, tenantId: "other", idempotencyKey: "smuggle-1" })).status).toBe(400);
    expect((await send("", { action: { type: "service/add", service }, idempotencyKey: "anon-1" })).status).toBe(401);
    expect((await read("")).status).toBe(401);
  });
});
