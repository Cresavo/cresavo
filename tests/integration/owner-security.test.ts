import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createOutbox } from "../../src/concept/connections/simulated/outbox";
import { createRegistry } from "../../src/concept/connections/server/registry";
import type { EmailMessage } from "../../src/concept/connections/ports/email";
import { ok } from "../../src/concept/connections/core";
import { db } from "../../src/lib/db";
import { createOwnerAccount, verifyOwnerCredentials } from "../../src/lib/owner-accounts";
import { lockDurationMs } from "../../src/lib/owner-lockout";
import { requestPasswordReset, resetPassword, RESET_TTL_MS, type ResetRegistry } from "../../src/lib/owner-password-reset";
import {
  closeAllOwnerSessions, openOwnerSession, OWNER_COOKIE, OWNER_IDLE_MS, OWNER_SESSION_MS, ownerFromCookie, renewedOwnerCookie,
} from "../../src/lib/owner-session";
import { POST as resetRequestRoute } from "../../src/app/api/owner/password/reset-request/route";
import { POST as resetRoute } from "../../src/app/api/owner/password/reset/route";
import { POST as logoutAllRoute } from "../../src/app/api/owner/logout-all/route";
import { POST as loginRoute } from "../../src/app/api/owner/login/route";
import { GET as meRoute } from "../../src/app/api/owner/me/route";

// Lockout, password reset and session timeouts against a disposable local *_test database. All data is fictional.
// Time is fixed: the clock is set to a known day and moved by hand.

// The client address of a request comes from a verified socket in production; the test names it in a header.
vi.mock("../../src/lib/rate-limit", async (original) => ({
  ...(await original<typeof import("../../src/lib/rate-limit")>()),
  clientIp: (headers: Headers) => headers.get("x-forwarded-for") ?? "127.0.0.1",
}));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (task: () => unknown) => void task() }));

const run = randomUUID().slice(0, 8);
const email = (name: string) => `${name}-${run}@example.test`;
const password = "a long fictional passphrase";
const newPassword = "another fictional passphrase";
const START = new Date("2026-11-22T10:00:00.000Z");
const minutes = (n: number) => n * 60_000;

async function account(name: string) {
  const result = await createOwnerAccount({ email: email(name), password, salonName: `Salong ${name}`, language: "en" });
  if (!result.ok) throw new Error("sign-up failed");
  return result;
}

/** A registry whose e-mail connection records what it is asked to send. */
function recordingRegistry(live: boolean) {
  const sent: EmailMessage[] = [];
  const registry: ResetRegistry = {
    resolve: async () => ({
      live, reason: live ? "live" : "live-off",
      adapter: {
        info: { port: "email", provider: "test", kind: "simulated", capabilities: ["send"], secrets: [] },
        send: async (message) => { sent.push(message); return ok({ id: "m-1", to: message.to }, "queued"); },
      },
    }),
  };
  return { registry, sent };
}

const tokenIn = (message: EmailMessage) => /#t=([^\s"<]+)/.exec(message.text)![1];

beforeAll(() => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN", "book.example");
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterEach(() => { vi.setSystemTime(START); });

afterAll(async () => {
  vi.useRealTimers();
  const accounts = await db.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  await db.tenantState.deleteMany({ where: { tenantId: { in: accounts.map((a) => a.tenantId) } } });
  vi.unstubAllEnvs();
  await db.$disconnect();
});

describe("account lockout", () => {
  it("locks after five wrong passwords and answers a locked account like a wrong password", async () => {
    vi.setSystemTime(START);
    await account("lock");
    for (let n = 0; n < 4; n++) expect(await verifyOwnerCredentials({ email: email("lock"), password: "wrong password here" })).toBeNull();
    // The fifth wrong password locks; from then on even the right one is refused.
    expect(await verifyOwnerCredentials({ email: email("lock"), password: "wrong password here" })).toBeNull();
    expect(await verifyOwnerCredentials({ email: email("lock"), password })).toBeNull();
    vi.setSystemTime(new Date(START.getTime() + minutes(14)));
    expect(await verifyOwnerCredentials({ email: email("lock"), password })).toBeNull();
    vi.setSystemTime(new Date(START.getTime() + minutes(16)));
    expect(await verifyOwnerCredentials({ email: email("lock"), password })).not.toBeNull();
  });

  it("does not lock on four failures, and a correct password clears them", async () => {
    vi.setSystemTime(START);
    await account("clear");
    for (let n = 0; n < 4; n++) await verifyOwnerCredentials({ email: email("clear"), password: "wrong password here" });
    expect(await verifyOwnerCredentials({ email: email("clear"), password })).not.toBeNull();
    for (let n = 0; n < 4; n++) await verifyOwnerCredentials({ email: email("clear"), password: "wrong password here" });
    expect(await verifyOwnerCredentials({ email: email("clear"), password })).not.toBeNull();
  });

  it("doubles the lock each time within a day", async () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => lockDurationMs(n) / minutes(1))).toEqual([15, 30, 60, 120, 240, 480, 480]);
    vi.setSystemTime(START);
    await account("backoff");
    const fail = async () => { for (let n = 0; n < 5; n++) await verifyOwnerCredentials({ email: email("backoff"), password: "wrong password here" }); };
    await fail();
    vi.setSystemTime(new Date(START.getTime() + minutes(16)));
    await fail(); // the second lock: 30 minutes
    vi.setSystemTime(new Date(START.getTime() + minutes(16 + 29)));
    expect(await verifyOwnerCredentials({ email: email("backoff"), password })).toBeNull();
    vi.setSystemTime(new Date(START.getTime() + minutes(16 + 31)));
    expect(await verifyOwnerCredentials({ email: email("backoff"), password })).not.toBeNull();
  });

  it("locks an unknown address the same way, so a lock never shows whether an account exists", async () => {
    vi.setSystemTime(START);
    for (let n = 0; n < 5; n++) expect(await verifyOwnerCredentials({ email: email("nobody"), password })).toBeNull();
    await account("nobody"); // created after the lock: the lock follows the address, not the account
    expect(await verifyOwnerCredentials({ email: email("nobody"), password })).toBeNull();
  });

  it("returns the same 401 body for an unknown address, a wrong password and a locked account", async () => {
    vi.setSystemTime(START);
    await account("generic");
    const origin = "http://localhost";
    const login = async (mail: string, pass: string, ip: string) => {
      const response = await loginRoute(new NextRequest(`${origin}/api/owner/login`, {
        method: "POST", body: JSON.stringify({ email: mail, password: pass }),
        headers: { origin, host: "localhost", "content-type": "application/json", "x-forwarded-for": ip },
      }));
      return { status: response.status, body: await response.json() };
    };
    const unknown = await login(email("ghost"), password, "198.51.100.1");
    const wrong = await login(email("generic"), "wrong password here", "198.51.100.2");
    for (let n = 0; n < 5; n++) await verifyOwnerCredentials({ email: email("generic"), password: "wrong password here" });
    const locked = await login(email("generic"), password, "198.51.100.3");
    expect(unknown).toEqual({ status: 401, body: { error: "invalid_credentials" } });
    expect(wrong).toEqual(unknown);
    expect(locked).toEqual(unknown);
  });
});

describe("password reset", () => {
  it("sends one e-mail with a link for a known address, and nothing for an unknown one", async () => {
    const { registry, sent } = recordingRegistry(true);
    const a = await account("mail");
    await requestPasswordReset({ email: email("ghost") }, registry);
    await requestPasswordReset({ email: "not an address" }, registry);
    expect(sent).toHaveLength(0);
    await requestPasswordReset({ email: ` ${email("MAIL")} ` }, registry, START.getTime());
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual([email("mail")]);
    expect(sent[0].text).toMatch(/^https?:|https:\/\/book\.example\/account\/reset#t=/m);
    expect(sent[0].html).toContain("https://book.example/account/reset#t=");
    expect(sent[0].tracking).toBe(false);
    expect(a.identity.id).toBeTruthy();
  });

  it("simulates by default: the outbox names the account by reference and holds no link", async () => {
    const outbox = createOutbox();
    const a = await account("simulated");
    await requestPasswordReset({ email: email("simulated") }, createRegistry({ outbox }));
    const [entry] = outbox.list("email");
    expect(entry.to).toBe(`owner:${a.identity.id}`);
    expect(entry.body).not.toContain("#t=");
    expect(entry.body).not.toContain(email("simulated"));
  });

  it("writes the e-mail in the salon's language", async () => {
    const { registry, sent } = recordingRegistry(true);
    const result = await createOwnerAccount({ email: email("svenska"), password, salonName: "Salong Svenska", language: "sv" });
    expect(result.ok).toBe(true);
    await requestPasswordReset({ email: email("svenska") }, registry);
    expect(sent[0].subject).toMatch(/^Återställ ditt lösenord/);
    expect(sent[0].language).toBe("sv");
  });

  it("resets the password once, ends every session and lifts a lock", async () => {
    vi.setSystemTime(START);
    const { registry, sent } = recordingRegistry(true);
    const a = await account("reset");
    const session = await openOwnerSession(a.identity);
    const other = await openOwnerSession(a.identity);
    for (let n = 0; n < 5; n++) await verifyOwnerCredentials({ email: email("reset"), password: "wrong password here" });
    await requestPasswordReset({ email: email("reset") }, registry, START.getTime());
    const token = tokenIn(sent[0]);
    expect(await resetPassword({ token, password: "short" })).toEqual({ ok: false, reason: "invalid" });
    expect(await resetPassword({ token, password: newPassword })).toEqual({ ok: true });
    expect(await ownerFromCookie(session?.value)).toBeNull();
    expect(await ownerFromCookie(other?.value)).toBeNull();
    // A new password works at once even though the account was locked, and the old one does not.
    expect(await verifyOwnerCredentials({ email: email("reset"), password })).toBeNull();
    expect(await verifyOwnerCredentials({ email: email("reset"), password: newPassword })).not.toBeNull();
    // The link works once.
    expect(await resetPassword({ token, password: "a third fictional passphrase" })).toEqual({ ok: false, reason: "invalid_token" });
    expect(await verifyOwnerCredentials({ email: email("reset"), password: newPassword })).not.toBeNull();
  });

  it("lets only one of two simultaneous uses of a token win", async () => {
    const { registry, sent } = recordingRegistry(true);
    await account("race");
    await requestPasswordReset({ email: email("race") }, registry, START.getTime());
    const token = tokenIn(sent[0]);
    const results = await Promise.all([
      resetPassword({ token, password: newPassword }, START.getTime()),
      resetPassword({ token, password: "a rival fictional passphrase" }, START.getTime()),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "invalid_token" }]);
  });

  it("expires after 30 minutes", async () => {
    const { registry, sent } = recordingRegistry(true);
    await account("expiry");
    await requestPasswordReset({ email: email("expiry") }, registry, START.getTime());
    const token = tokenIn(sent[0]);
    expect(RESET_TTL_MS).toBe(minutes(30));
    expect(await resetPassword({ token, password: newPassword }, START.getTime() + RESET_TTL_MS + 1)).toEqual({ ok: false, reason: "invalid_token" });
    expect(await resetPassword({ token, password: newPassword }, START.getTime() + RESET_TTL_MS - 1000)).toEqual({ ok: true });
  });

  it("refuses forged, altered, foreign and superseded tokens with one answer", async () => {
    const { registry, sent } = recordingRegistry(true);
    const a = await account("forge");
    const b = await account("forge-other");
    await requestPasswordReset({ email: email("forge") }, registry, START.getTime());
    await requestPasswordReset({ email: email("forge-other") }, registry, START.getTime());
    const [own, foreign] = [tokenIn(sent[0]), tokenIn(sent[1])];
    const [id, expires, version, signature] = own.split(".");
    const swapped = `${b.identity.id}.${expires}.${version}.${signature}`;
    const extended = `${id}.${Number(expires) + minutes(60)}.${version}.${signature}`;
    const flipped = `${id}.${expires}.${version}.${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
    const invalid = { ok: false, reason: "invalid_token" };
    for (const token of ["", "garbage", swapped, extended, flipped, `${id}.${expires}.${version}`, `${a.identity.id}.1.1.${"0".repeat(64)}`])
      expect(await resetPassword({ token, password: newPassword }, START.getTime()), token).toEqual(invalid);
    // A password change by other means (a version bump) retires every token issued before it.
    await db.ownerAccount.update({ where: { id: b.identity.id }, data: { credentialVersion: { increment: 1 } } });
    expect(await resetPassword({ token: foreign, password: newPassword }, START.getTime())).toEqual(invalid);
    expect(await resetPassword({ token: own, password: newPassword }, START.getTime())).toEqual({ ok: true });
  });

  it("refuses a disabled account", async () => {
    const { registry, sent } = recordingRegistry(true);
    await account("disabled");
    await requestPasswordReset({ email: email("disabled") }, registry, START.getTime());
    const token = tokenIn(sent[0]);
    await db.ownerAccount.update({ where: { email: email("disabled") }, data: { active: false } });
    expect(await resetPassword({ token, password: newPassword }, START.getTime())).toEqual({ ok: false, reason: "invalid_token" });
    await requestPasswordReset({ email: email("disabled") }, registry, START.getTime());
    expect(sent).toHaveLength(1);
  });

  describe("routes", () => {
    const origin = "http://localhost";
    const post = (path: string, body: unknown, ip: string, cookie?: string) => new NextRequest(`${origin}${path}`, {
      method: "POST", body: JSON.stringify(body),
      headers: { origin, host: "localhost", "content-type": "application/json", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) },
    });

    it("gives the same answer for a known and an unknown address", async () => {
      await account("route");
      const known = await resetRequestRoute(post("/api/owner/password/reset-request", { email: email("route") }, "203.0.113.10"));
      const unknown = await resetRequestRoute(post("/api/owner/password/reset-request", { email: email("nobody-here") }, "203.0.113.11"));
      const malformed = await resetRequestRoute(post("/api/owner/password/reset-request", { email: "nope" }, "203.0.113.12"));
      expect([known.status, unknown.status, malformed.status]).toEqual([200, 200, 200]);
      expect(await known.json()).toEqual({ ok: true });
      expect(await unknown.json()).toEqual({ ok: true });
      expect(await malformed.json()).toEqual({ ok: true });
    });

    it("limits requests per address and per mailbox, with the same answer for any address", async () => {
      const ip = "203.0.113.20";
      for (let n = 0; n < 5; n++) expect((await resetRequestRoute(post("/api/owner/password/reset-request", { email: `n${n}-${run}@example.test` }, ip))).status).toBe(200);
      expect((await resetRequestRoute(post("/api/owner/password/reset-request", { email: `n9-${run}@example.test` }, ip))).status).toBe(429);
      const target = email("flooded");
      for (let n = 0; n < 3; n++) expect((await resetRequestRoute(post("/api/owner/password/reset-request", { email: target }, `203.0.113.${30 + n}`))).status).toBe(200);
      expect((await resetRequestRoute(post("/api/owner/password/reset-request", { email: target }, "203.0.113.40"))).status).toBe(429);
    });

    it("rejects a cross-site request and a bad token", async () => {
      const cross = new NextRequest(`${origin}/api/owner/password/reset`, {
        method: "POST", body: "{}", headers: { origin: "https://evil.example", host: "localhost", "content-type": "application/json" },
      });
      expect((await resetRoute(cross)).status).toBe(403);
      const bad = await resetRoute(post("/api/owner/password/reset", { token: "x", password: newPassword }, "203.0.113.50"));
      expect(bad.status).toBe(400);
      expect(await bad.json()).toEqual({ error: "invalid_token" });
    });

    it("signs out everywhere: every device's session ends and the cookie is cleared", async () => {
      const a = await account("everywhere");
      const here = await openOwnerSession(a.identity);
      const there = await openOwnerSession(a.identity);
      const unrelated = await openOwnerSession((await account("everywhere-other")).identity);
      const response = await logoutAllRoute(post("/api/owner/logout-all", {}, "203.0.113.60", `${OWNER_COOKIE}=${here!.value}`));
      expect(response.status).toBe(200);
      expect(response.headers.getSetCookie().find((c) => c.startsWith(`${OWNER_COOKIE}=`))).toMatch(/^cresavo_owner=;/);
      expect(await ownerFromCookie(here?.value)).toBeNull();
      expect(await ownerFromCookie(there?.value)).toBeNull();
      expect(await ownerFromCookie(unrelated?.value)).not.toBeNull();
      expect((await logoutAllRoute(post("/api/owner/logout-all", {}, "203.0.113.61"))).status).toBe(401);
      expect(await closeAllOwnerSessions(a.identity.id)).toBe(0);
    });
  });
});

describe("session timeouts and cookies", () => {
  it("ends an idle session after 12 hours and an active one after 14 days", async () => {
    vi.setSystemTime(START);
    const a = await account("idle");
    const session = await openOwnerSession(a.identity, START.getTime());
    expect(session?.expires.getTime()).toBe(START.getTime() + OWNER_IDLE_MS);
    expect(await ownerFromCookie(session?.value, START.getTime() + OWNER_IDLE_MS - 1000)).not.toBeNull();
    expect(await ownerFromCookie(session?.value, START.getTime() + OWNER_IDLE_MS + 1000)).toBeNull();

    // Activity moves the idle deadline, but never past the absolute one.
    let cookie = session!.value;
    let now = START.getTime();
    const stepMs = OWNER_IDLE_MS / 2 + 1000;
    while (now + stepMs < START.getTime() + OWNER_SESSION_MS) {
      now += stepMs;
      expect(await ownerFromCookie(cookie, now), `at ${new Date(now).toISOString()}`).not.toBeNull();
      cookie = renewedOwnerCookie(cookie, now)?.value ?? cookie;
    }
    const last = renewedOwnerCookie(cookie, START.getTime() + OWNER_SESSION_MS - minutes(10));
    expect(last?.expires.getTime()).toBe(START.getTime() + OWNER_SESSION_MS);
    expect(await ownerFromCookie(cookie, START.getTime() + OWNER_SESSION_MS + 1000)).toBeNull();
    expect(await ownerFromCookie(last?.value, START.getTime() + OWNER_SESSION_MS + 1000)).toBeNull();
  });

  it("renews only after half the idle time, and a client cannot extend a cookie", async () => {
    vi.setSystemTime(START);
    const a = await account("renew");
    const session = await openOwnerSession(a.identity, START.getTime());
    expect(renewedOwnerCookie(session?.value, START.getTime() + minutes(10))).toBeNull();
    const renewed = renewedOwnerCookie(session?.value, START.getTime() + OWNER_IDLE_MS / 2 + 1000);
    expect(renewed?.expires.getTime()).toBe(START.getTime() + OWNER_IDLE_MS / 2 + 1000 + OWNER_IDLE_MS);
    const [token, idle, absolute, signature] = session!.value.split(".");
    const forged = `${token}.${Number(idle) + OWNER_IDLE_MS}.${absolute}.${signature}`;
    expect(await ownerFromCookie(forged, START.getTime() + minutes(5))).toBeNull();
    expect(renewedOwnerCookie("not-a-cookie")).toBeNull();
  });

  it("sets HttpOnly, SameSite=Strict cookies, Secure in production, and renews through the API", async () => {
    const a = await account("cookie");
    const origin = "http://localhost";
    const cookieHeader = (value: string) => ({ cookie: `${OWNER_COOKIE}=${value}`, origin, host: "localhost" });
    const session = await openOwnerSession(a.identity, Date.now());

    const fresh = await meRoute(new NextRequest(`${origin}/api/owner/me`, { headers: cookieHeader(session!.value) }));
    expect(fresh.status).toBe(200);
    expect(fresh.headers.getSetCookie().some((c) => c.startsWith(`${OWNER_COOKIE}=`))).toBe(false);

    vi.setSystemTime(new Date(START.getTime() + OWNER_IDLE_MS / 2 + 1000));
    const renewed = await meRoute(new NextRequest(`${origin}/api/owner/me`, { headers: cookieHeader(session!.value) }));
    const set = renewed.headers.getSetCookie().find((c) => c.startsWith(`${OWNER_COOKIE}=`))!;
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=strict/i);
    expect(set).toMatch(/Path=\//);
    expect(set).toMatch(/Max-Age=43200/);
    expect(set).not.toMatch(/Secure/i);
    const hint = renewed.headers.getSetCookie().find((c) => c.startsWith("cresavo_owner_hint="))!;
    expect(hint).not.toMatch(/HttpOnly/i);
  });
});
