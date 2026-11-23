import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getSalon } from "../../src/app/api/owner/salon/route";
import { POST as postAction } from "../../src/app/api/owner/salon/actions/route";
import { POST as postErase } from "../../src/app/api/owner/salon/erase/route";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { sessionKey } from "../../src/lib/owner-http";
import { openOwnerSession, OWNER_COOKIE, ownerFromCookie } from "../../src/lib/owner-session";

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


/** The session key of a cookie (what the salon load hands the studio for `x-cresavo-session`). */
const keyOf = async (cookie: string) => {
  const owner = await ownerFromCookie(cookie.slice(cookie.indexOf("=") + 1));
  return owner ? sessionKey(owner) : "";
};
const erase = async (cookie: string, body: unknown, session?: string) => postErase(new NextRequest(`${origin}/api/owner/salon/erase`, {
  method: "POST", body: JSON.stringify(body),
  headers: { cookie, origin, host: "localhost", "content-type": "application/json", "x-cresavo-session": session ?? await keyOf(cookie) },
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

describe("customer rights over the owner salon API", () => {
  const lena = { firstName: "Lena", lastName: "Raderbar", phone: "0700007777", email: "lena.raderbar@example.test", category: "both", since: "2025-01-10", isRegular: false, tags: ["Imported"], waitlist: false };

  async function salonWithCustomer(name: string) {
    const a = await owner(name);
    const loaded = (await (await read(a.cookie)).json()) as { state: { staff: Array<{ id: string }> } };
    const preferredStaff = loaded.state.staff[0]?.id ?? "anna";
    const imported = await send(a.cookie, { action: { type: "customers/import", customers: [{ ...lena, preferredStaff }] }, idempotencyKey: `import-${randomUUID()}` });
    expect(imported.status).toBe(200);
    const state = (await imported.json()).state as { customers: Array<{ id: string; firstName: string }> };
    const customer = state.customers.find((c) => c.firstName === "Lena")!;
    const journal = { type: "journal/add", entry: { customerId: customer.id, date: "2026-11-20", staffId: preferredStaff, treatment: "Fictional treatment", observations: "Fictional observation", advice: "Rest" } };
    expect((await send(a.cookie, { action: journal, idempotencyKey: `journal-${randomUUID()}` })).status).toBe(200);
    return { ...a, customer, preferredStaff };
  }

  const actionRows = (tenantId: string) => db.$queryRaw<Array<{ action: { type: string } }>>`SELECT action FROM tenant_action WHERE tenant_id = ${tenantId} ORDER BY seq`;

  it("corrects fields through the same route and refuses invalid or unknown ones", async () => {
    const a = await salonWithCustomer("Salong Rattar");
    const patch = { phone: "070 000 88 88", email: "lena.ny@example.test" };
    const response = await send(a.cookie, { action: { type: "customer/update", id: a.customer.id, patch }, idempotencyKey: "update-1" });
    expect(response.status).toBe(200);
    expect((await response.json()).state.customers.find((c: { id: string }) => c.id === a.customer.id)).toMatchObject({ phone: "070 000 88 88", email: "lena.ny@example.test" });
    expect((await send(a.cookie, { action: { type: "customer/update", id: a.customer.id, patch: { phone: "123" } }, idempotencyKey: "update-2" })).status).toBe(422);
    expect((await send(a.cookie, { action: { type: "customer/update", id: a.customer.id, patch: { id: "k-1" } }, idempotencyKey: "update-3" })).status).toBe(400);
  });

  it("erases a customer for good, redacts the audit log and leaves another salon alone", async () => {
    const a = await salonWithCustomer("Salong Radera");
    const b = await salonWithCustomer("Salong Annan");
    await send(a.cookie, { action: { type: "customer/note", id: a.customer.id, note: "Fictional note about Lena Raderbar" }, idempotencyKey: "note-1" });
    expect(JSON.stringify(await actionRows(a.tenantId))).toContain("lena.raderbar@example.test");

    expect((await erase("", { customerId: a.customer.id, name: "Lena Raderbar" })).status).toBe(401);
    expect((await erase(a.cookie, { customerId: a.customer.id, name: "Lena Raderbar", tenantId: "other" })).status).toBe(400);
    expect((await erase(a.cookie, {})).status).toBe(400);
    // The name on screen must be the name of that customer in this salon: a tab left open in another salon cannot erase here.
    expect((await erase(a.cookie, { customerId: a.customer.id, name: "Someone Else" })).status).toBe(409);
    expect((await (await read(a.cookie)).json()).state.customers.some((c: { id: string }) => c.id === a.customer.id)).toBe(true);
    const response = await erase(a.cookie, { customerId: a.customer.id, name: "Lena Raderbar" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ pendingPayments: 0, inFlightMessages: 0 });
    expect(body.state.customers.some((c: { id: string }) => c.id === a.customer.id)).toBe(false);
    expect(body.state.journals).toEqual([]);

    const text = JSON.stringify(await actionRows(a.tenantId)) + JSON.stringify((await (await read(a.cookie)).json()).state);
    for (const secret of ["lena.raderbar@example.test", "0700007777", "Raderbar", "Fictional observation"]) expect(text, secret).not.toContain(secret);
    // The same erasure again is safe, and the other salon's Lena is untouched, even when her id is sent here.
    expect((await erase(a.cookie, { customerId: a.customer.id, name: "Lena Raderbar" })).status).toBe(200);
    expect((await erase(a.cookie, { customerId: b.customer.id, name: "Lena Raderbar" })).status).toBe(200);
    expect((await (await read(b.cookie)).json()).state.customers.some((c: { id: string }) => c.id === b.customer.id)).toBe(true);
    expect(JSON.stringify(await actionRows(b.tenantId))).toContain("lena.raderbar@example.test");
  });

  it("logs the load of a salon that holds journals as a read of all of them, once per ten minutes", async () => {
    const a = await salonWithCustomer("Salong Journal");
    const first = await (await read(a.cookie)).json();
    expect(first.state.journalAccess).toHaveLength(1);
    expect(first.state.journalAccess[0]).toMatchObject({ actor: "owner" });
    expect(first.state.journalAccess[0]).not.toHaveProperty("customerId");
    const second = await (await read(a.cookie)).json();
    expect(second.state.journalAccess).toHaveLength(1);
    expect(second.version).toBe(first.version);
    // A read of one customer's journal reported by the studio is kept with the customer and without any content.
    const reported = await send(a.cookie, { action: { type: "journal/view", customerId: a.customer.id, actor: "owner" }, idempotencyKey: "view-1" });
    expect(reported.status).toBe(200);
    const log = (await reported.json()).state.journalAccess as Array<Record<string, unknown>>;
    expect(log.map((row) => row.customerId)).toEqual([a.customer.id, undefined]);
    const views = (await actionRows(a.tenantId)).map((row) => row.action).filter((action) => action.type === "journal/view");
    expect(views).toEqual([{ type: "journal/view", actor: "owner" }, { type: "journal/view", customerId: a.customer.id, actor: "owner" }]);
    // The bulk load and staff reads are the server's: a session cannot report them.
    expect((await send(a.cookie, { action: { type: "journal/view", actor: "owner" }, idempotencyKey: "view-2" })).status).toBe(400);
    expect((await send(a.cookie, { action: { type: "journal/view", customerId: a.customer.id, actor: "staff", staffId: a.preferredStaff }, idempotencyKey: "view-3" })).status).toBe(400);
    // Journals that only sit in the trash are still delivered, so that load is logged too.
    const trashed = await salonWithCustomer("Salong Papperskorg");
    await send(trashed.cookie, { action: { type: "customer/delete", id: trashed.customer.id }, idempotencyKey: "delete-1" });
    const afterDelete = await (await read(trashed.cookie)).json();
    expect(afterDelete.state.journals).toEqual([]);
    expect(afterDelete.state.journalAccess.some((row: Record<string, unknown>) => !("customerId" in row))).toBe(true);
    // A salon without journals is not written to by a load.
    const empty = await owner("Salong Utan Journal");
    const before = await (await read(empty.cookie)).json();
    expect(before.state.journalAccess ?? []).toEqual([]);
    expect((await (await read(empty.cookie)).json()).version).toBe(before.version);
  });
});
