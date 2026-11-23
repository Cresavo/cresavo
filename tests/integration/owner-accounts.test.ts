import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "../../src/lib/db";
import { createOwnerAccount, verifyOwnerCredentials } from "../../src/lib/owner-accounts";
import { closeOwnerSession, openOwnerSession, OWNER_SESSION_MS, ownerFromCookie, pruneOwnerSessions } from "../../src/lib/owner-session";

// Owner accounts against a disposable local *_test database. All data is fictional.

const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}-${run}@example.test`;
const password = "a long fictional passphrase";
const signup = (name: string, extra: Record<string, unknown> = {}) =>
  createOwnerAccount({ email: email(name), password, salonName: `Salong ${name}`, language: "sv", ...extra });

afterAll(async () => {
  const accounts = await db.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await db.tenantState.deleteMany({ where: { tenantId: { in: accounts.map((a) => a.tenantId) } } });
  await db.$disconnect();
});

describe("owner sign-up", () => {
  it("creates the account and a salon tenant together", async () => {
    const result = await signup("linnea");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tenant = await db.tenantState.findUnique({ where: { tenantId: result.tenantId } });
    const doc = tenant?.doc as { salon: { name: string }; localization: { language: string }; bookings: unknown[] };
    expect(tenant?.kind).toBe("salon");
    expect(doc.salon.name).toBe("Salong linnea");
    expect(doc.localization.language).toBe("sv");
    expect(doc.bookings).toEqual([]);
  });

  it("refuses a taken email in any letter case and creates nothing", async () => {
    await signup("taken");
    const before = await db.tenantState.count();
    const again = await createOwnerAccount({ email: email("TAKEN").toUpperCase(), password, salonName: "Copy", language: "en" });
    expect(again).toEqual({ ok: false, reason: "email_taken" });
    expect(await db.tenantState.count()).toBe(before);
  });

  it("refuses short passwords, unknown fields and empty names", async () => {
    expect(await signup("short", { password: "too short" })).toEqual({ ok: false, reason: "invalid" });
    expect(await signup("extra", { role: "admin" })).toEqual({ ok: false, reason: "invalid" });
    expect(await signup("blank", { salonName: "  " })).toEqual({ ok: false, reason: "invalid" });
    expect(await db.ownerAccount.count({ where: { email: { in: [email("short"), email("extra"), email("blank")] } } })).toBe(0);
  });
});

describe("owner login and sessions", () => {
  it("accepts the right password only, for active accounts", async () => {
    await signup("login");
    expect(await verifyOwnerCredentials({ email: email("login"), password })).not.toBeNull();
    expect(await verifyOwnerCredentials({ email: ` ${email("LOGIN")} `, password })).not.toBeNull();
    expect(await verifyOwnerCredentials({ email: email("login"), password: `${password}!` })).toBeNull();
    expect(await verifyOwnerCredentials({ email: email("nobody"), password })).toBeNull();
    await db.ownerAccount.update({ where: { email: email("login") }, data: { active: false } });
    expect(await verifyOwnerCredentials({ email: email("login"), password })).toBeNull();
  });

  it("resolves a session to its own salon and ends it on logout", async () => {
    const result = await signup("session");
    if (!result.ok) throw new Error("sign-up failed");
    const session = await openOwnerSession(result.identity);
    expect(await ownerFromCookie(session?.value)).toEqual({ accountId: result.identity.id, email: email("session"), tenantId: result.tenantId, mfaEnabled: false, credentialVersion: 1 });
    await closeOwnerSession(session?.value);
    expect(await ownerFromCookie(session?.value)).toBeNull();
  });

  it("never mixes up two salons", async () => {
    const a = await signup("salon-a");
    const b = await signup("salon-b");
    if (!a.ok || !b.ok) throw new Error("sign-up failed");
    const sessionA = await openOwnerSession(a.identity);
    const sessionB = await openOwnerSession(b.identity);
    expect((await ownerFromCookie(sessionA?.value))?.tenantId).toBe(a.tenantId);
    expect((await ownerFromCookie(sessionB?.value))?.tenantId).toBe(b.tenantId);
  });

  it("rejects tampered, expired and outdated sessions", async () => {
    const result = await signup("tamper");
    if (!result.ok) throw new Error("sign-up failed");
    const session = await openOwnerSession(result.identity);
    const value = session!.value;
    const flipped = value.slice(0, -1) + (value.endsWith("0") ? "1" : "0");
    expect(await ownerFromCookie(flipped)).toBeNull();
    expect(await ownerFromCookie("not-a-session")).toBeNull();
    expect(await ownerFromCookie(value, Date.now() + OWNER_SESSION_MS + 1000)).toBeNull();
    await db.ownerAccount.update({ where: { id: result.identity.id }, data: { credentialVersion: { increment: 1 } } });
    expect(await ownerFromCookie(value)).toBeNull();
    expect(await openOwnerSession(result.identity)).toBeNull();
  });

  it("prunes revoked sessions", async () => {
    const result = await signup("prune");
    if (!result.ok) throw new Error("sign-up failed");
    const session = await openOwnerSession(result.identity);
    await closeOwnerSession(session?.value);
    await pruneOwnerSessions();
    expect(await db.ownerSession.count({ where: { accountId: result.identity.id } })).toBe(0);
  });
});
