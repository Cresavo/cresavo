import { randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as postAction } from "../../src/app/api/owner/salon/actions/route";
import { sessionKey } from "../../src/lib/owner-http";
import { ownerFromCookie } from "../../src/lib/owner-session";

import { GET } from "../../src/app/api/public/salons/[slug]/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { openOwnerSession, OWNER_COOKIE } from "../../src/lib/owner-session";
import { ownerStore } from "../../src/lib/owner-store";
import { findSalonTenant } from "../../src/lib/public-booking";

/** The session key of a cookie (what the salon load hands the studio for `x-cresavo-session`). */
const keyOf = async (cookie: string) => sessionKey((await ownerFromCookie(cookie.slice(cookie.indexOf("=") + 1)))!);

// Public salon lookup against a disposable local *_test database. All data is fictional.

const run = randomUUID().slice(0, 8);
const SECRET = "synthetic-address-secret";

async function salon(name: string) {
  const result = await createOwnerAccount({ email: `${randomUUID().slice(0, 8)}-${run}@example.test`, password: "a long fictional passphrase", salonName: name, language: "sv" });
  if (!result.ok) throw new Error("sign-up failed");
  const state = (await ownerStore().load(result.tenantId))!.state;
  const session = await openOwnerSession(result.identity);
  return { tenantId: result.tenantId, slug: state.salon.slug, accountId: result.identity.id, cookie: `${OWNER_COOKIE}=${session!.value}` };
}

const publicGet = (slug: string) => {
  const ip = "192.0.2.9";
  return GET(new NextRequest(`http://localhost/api/public/salons/${slug}`, {
    headers: { "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug }) });
};

beforeAll(() => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
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

describe("salon addresses", () => {
  it("are unique: a second salon with the same name gets the next free address", async () => {
    const first = await salon(`Salong Fiktiv ${run}`);
    const second = await salon(`Salong Fiktiv ${run}`);
    expect(second.slug).toBe(`${first.slug}-2`);
    expect(await findSalonTenant(first.slug)).toBe(first.tenantId);
    expect(await findSalonTenant(second.slug)).toBe(second.tenantId);
  });

  it("cannot be taken by changing a salon's address to another's", async () => {
    const a = await salon(`Salong Alfa ${run}`);
    const b = await salon(`Salong Beta ${run}`);
    const taken = await ownerStore().apply(b.tenantId, { type: "salon/slug", slug: a.slug });
    expect(taken).toMatchObject({ ok: false, reason: "rejected", detail: "slug_taken" });
    expect(await findSalonTenant(a.slug)).toBe(a.tenantId);
    const free = await ownerStore().apply(b.tenantId, { type: "salon/slug", slug: `${b.slug}-nytt` });
    expect(free.ok).toBe(true);
  });

  it("survive a race: simultaneous sign-ups for one name all succeed, each with its own address", async () => {
    const name = `Salong Lopp ${run}`;
    const salons = await Promise.all([1, 2, 3, 4].map(() => salon(name)));
    const slugs = salons.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(4);
    for (const s of salons) expect(await findSalonTenant(s.slug)).toBe(s.tenantId);
  });

  it("are refused to the owner as slug_taken, a code the studio turns into its own message", async () => {
    const a = await salon(`Salong Delta ${run}`);
    const b = await salon(`Salong Epsilon ${run}`);
    const response = await postAction(new NextRequest("http://localhost/api/owner/salon/actions", {
      method: "POST", body: JSON.stringify({ action: { type: "salon/slug", slug: a.slug }, idempotencyKey: randomUUID().replaceAll("-", "") }),
      headers: { cookie: b.cookie, origin: "http://localhost", host: "localhost", "content-type": "application/json", "x-cresavo-session": await keyOf(b.cookie) },
    }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "slug_taken" });
  });

  it("stay reserved by a salon whose owner account is switched off, which is not served", async () => {
    const off = await salon(`Salong Zeta ${run}`);
    expect((await publicGet(off.slug)).status).toBe(200);
    await db.ownerAccount.update({ where: { id: off.accountId }, data: { active: false } });
    expect((await publicGet(off.slug)).status).toBe(404);
    expect((await salon(`Salong Zeta ${run}`)).slug).toBe(`${off.slug}-2`);
  });

  it("are not found for demo or sandbox tenants", async () => {
    const tenantId = `sandbox_${run}`;
    await db.$executeRaw`INSERT INTO tenant_state (tenant_id, kind, doc) VALUES (${tenantId}, 'sandbox', ${JSON.stringify({ salon: { slug: `sandbox-${run}` } })}::jsonb)`;
    expect(await findSalonTenant(`sandbox-${run}`)).toBeNull();
    await db.$executeRaw`DELETE FROM tenant_state WHERE tenant_id = ${tenantId}`;
  });
});

describe("GET /api/public/salons/[slug]", () => {
  const get = publicGet;

  it("sends the salon's public view and nothing that names its tenant", async () => {
    const own = await salon(`Salong Gamma ${run}`);
    await ownerStore().apply(own.tenantId, { type: "inbox/add", item: { kind: "message", date: "2026-11-16", time: 600, title: "Fictional private title", body: "Fictional private body", read: false, handled: false } });
    const response = await get(own.slug);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text).state.salon.slug).toBe(own.slug);
    expect(text).not.toContain(own.tenantId);
    expect(text).not.toContain("Fictional private");
  });

  it("serves a renamed salon only under its current address, in one read", async () => {
    const own = await salon(`Salong Eta ${run}`);
    const renamed = `${own.slug}-nytt`;
    expect((await ownerStore().apply(own.tenantId, { type: "salon/slug", slug: renamed })).ok).toBe(true);
    expect((await get(own.slug)).status).toBe(404);
    expect((await (await get(renamed)).json()).state.salon.slug).toBe(renamed);
    expect((await get(renamed.toUpperCase())).status).toBe(200);
  });

  it("answers 404 for an address no salon has", async () => {
    expect((await get(`ingen-salong-${run}`)).status).toBe(404);
  });
});
