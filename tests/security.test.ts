import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { failure } from "../src/lib/http";
import { DomainError, pageDataFailure } from "../src/lib/errors";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  set: vi.fn(),
  headers: new Headers(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    set: state.set,
  }),
  headers: async () => state.headers,
}));
import {
  checkPassword,
  isAdmin,
  login,
  logout,
  sameOrigin,
} from "../src/lib/auth";
import { checkRateLimit, clientIp } from "../src/lib/rate-limit";
import { assertTestDatabase } from "../scripts/test-db-guard.mjs";
import { demoRevision } from "../scripts/demo-revision.mjs";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  state.cookie = undefined;
  state.set.mockReset();
});

describe("Säkra felgränser", () => {
  it("lämnar inte ut feltext, cause eller metadata via HTTP, SSR eller loggar", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(
      new Error("finns inte CANARY@example.test postgres://CANARY"),
      {
        cause: new Error("CANARY secret"),
        meta: { query: "CANARY" },
      },
    );
    const response = failure(error);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Ett fel inträffade" });
    expect(() => pageDataFailure(error)).toThrow("Ett fel inträffade");
    expect(log.mock.calls).toEqual([
      ["BOOKING_INTERNAL_ERROR"],
      ["BOOKING_INTERNAL_ERROR"],
    ]);
  });
  it("behåller säkra domänfel och minimerar validerings- och JSON-fel", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const domain = failure(new DomainError("Tiden är inte tillgänglig"));
    expect(domain.status).toBe(400);
    expect(await domain.json()).toEqual({ error: "Tiden är inte tillgänglig" });
    for (const error of [
      z.string().safeParse(42).error,
      new SyntaxError("CANARY"),
    ]) {
      const response = failure(error);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Kontrollera uppgifterna",
      });
    }
    expect(log).not.toHaveBeenCalled();
  });
});

describe("Lokal admins session", () => {
  const secret = "synthetic-session-secret-for-tests-only";
  function token(expiry: number) {
    const value = String(expiry);
    return `${value}.${createHmac("sha256", secret).update(`1:${value}`).digest("hex")}`;
  }
  it("kräver giltig signatur, exakt format och högst åtta timmar", async () => {
    vi.stubEnv("SESSION_SECRET", secret);
    const valid = token(Date.now() + 60_000);
    state.cookie = valid;
    expect(await isAdmin()).toBe(true);
    vi.stubEnv("ADMIN_SESSION_VERSION", "2");
    expect(await isAdmin()).toBe(false);
    vi.stubEnv("ADMIN_SESSION_VERSION", "1");
    for (const value of [
      undefined,
      `${valid}.extra`,
      valid.replace(/.$/, "z"),
      token(Date.now() - 1),
      token(Date.now() + 9 * 3600_000),
      "9".repeat(10000),
    ]) {
      state.cookie = value;
      expect(await isAdmin()).toBe(false);
    }
    vi.stubEnv("SESSION_SECRET", "rotated-synthetic-session-secret-only");
    state.cookie = valid;
    expect(await isAdmin()).toBe(false);
  });
  it("sätter säkra cookieflaggor och avvisar fel/överstora lösenord", async () => {
    vi.stubEnv("SESSION_SECRET", secret);
    vi.stubEnv("ADMIN_PASSWORD", "synthetic-test-password");
    vi.stubEnv("NODE_ENV", "production");
    expect(checkPassword("synthetic-test-password")).toBe(true);
    expect(checkPassword("wrong")).toBe(false);
    expect(checkPassword("x".repeat(1025))).toBe(false);
    await login();
    expect(state.set).toHaveBeenCalledWith(
      "booking_admin",
      expect.any(String),
      {
        httpOnly: true,
        sameSite: "strict",
        secure: true,
        path: "/",
        maxAge: 28800,
      },
    );
    await logout();
    expect(state.set).toHaveBeenLastCalledWith(
      "booking_admin",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
  it("avvisar saknat, främmande och ogiltigt origin", async () => {
    for (const origin of [null, "http://other.test", "invalid"]) {
      state.headers = new Headers({ host: "localhost:3000" });
      if (origin) state.headers.set("origin", origin);
      expect(await sameOrigin()).toBe(false);
    }
    state.headers.set("origin", "http://localhost:3000");
    expect(await sameOrigin()).toBe(true);
  });
});

describe("Missbruksskydd och testgrind", () => {
  it("demo kan rapportera okänd revision utan Git", () => {
    expect(
      demoRevision(() => {
        throw new Error("synthetic unavailable git");
      }),
    ).toEqual({ revision: "unknown", dirty: null });
  });
  it("stoppar sjätte försöket, håller isär rutter/IP och släpper efter fönstret", () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++) checkRateLimit("login", "unit-ip", true, now);
    expect(() => checkRateLimit("login", "unit-ip", false, now)).toThrow(
      DomainError,
    );
    try {
      checkRateLimit("login", "unit-ip", false, now);
    } catch (e) {
      expect(e).toMatchObject({ status: 429, retryAfter: 900 });
    }
    expect(() =>
      checkRateLimit("bookings", "unit-ip", true, now),
    ).not.toThrow();
    expect(() =>
      checkRateLimit("login", "other-unit-ip", true, now),
    ).not.toThrow();
    expect(() =>
      checkRateLimit("login", "unit-ip", true, now + 900001),
    ).not.toThrow();
  });
  it("litar inte på godtyckliga IP-headers utan explicit proxykonfiguration", () => {
    vi.stubEnv("TRUST_PROXY_IP", "0");
    const headers = new Headers({
      "x-real-ip": "192.0.2.10",
      "x-forwarded-for": "192.0.2.20",
    });
    expect(clientIp(headers)).toBe("local-shared");
    vi.stubEnv("TRUST_PROXY_IP", "1");
    expect(clientIp(headers)).toBe("192.0.2.10");
    headers.set("x-real-ip", "forged");
    expect(clientIp(headers)).toBe("local-shared");
  });
  it("avvisar osäkra databasadresser före dataåtkomst", () => {
    for (const value of [
      undefined,
      "not a URL",
      "postgresql://user@remote.test/db_test",
      "postgresql://user@localhost/production",
      "postgresql://user@127.0.0.1/db_test%2Fprod",
    ])
      expect(() => assertTestDatabase(value)).toThrow("TEST_DATABASE_REFUSED");
    for (const host of ["localhost", "127.0.0.1", "[::1]"])
      expect(() =>
        assertTestDatabase(`postgresql://user@${host}/booking_test`),
      ).not.toThrow();
  });
});
