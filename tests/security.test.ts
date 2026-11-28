import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac, createHash } from "node:crypto";
import { z } from "zod";
import { db } from "../src/lib/db";
import { failure } from "../src/lib/http";
import {
  DomainError,
  PasswordCapacityError,
  pageDataFailure,
} from "../src/lib/errors";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  set: vi.fn(),
  headers: new Headers(),
  sessions: new Map<
    string,
    { id: string; expiresAt: Date; revokedAt?: Date; userId?: string }
  >(),
}));
vi.mock("../src/lib/db", () => {
  const fakeDb = {
    $queryRaw: async () => [
      { active: true, businessId: "demo", credentialVersion: 1 },
    ],
    adminSession: {
      findMany: vi.fn(async () =>
        [...state.sessions.values()]
          .filter((s) => s.expiresAt <= new Date() || s.revokedAt)
          .slice(0, 100)
          .map(({ id }) => ({ id })),
      ),
      deleteMany: vi.fn(
        async ({ where }: { where: { id: { in: string[] } } }) => {
          for (const id of where.id.in) state.sessions.delete(id);
          return { count: where.id.in.length };
        },
      ),
      create: async ({
        data,
      }: {
        data: { id: string; expiresAt: Date; userId?: string };
      }) => {
        state.sessions.set(data.id, data);
        return data;
      },
      findFirst: async ({ where }: { where: { id: string } }) => {
        const session = state.sessions.get(where.id);
        return session &&
          session.userId === "unit-admin" &&
          !session.revokedAt &&
          session.expiresAt > new Date()
          ? { user: { id: session.userId, email: "unit-admin@example.test" } }
          : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { revokedAt: Date };
      }) => {
        const session = state.sessions.get(where.id);
        if (session) session.revokedAt = data.revokedAt;
        return { count: session ? 1 : 0 };
      },
    },
  };
  return {
    db: {
      ...fakeDb,
      $transaction: async (run: (tx: typeof fakeDb) => Promise<unknown>) =>
        run(fakeDb),
    },
  };
});
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    set: state.set,
  }),
  headers: async () => state.headers,
}));
import { isAdmin, login, logout, sameOrigin } from "../src/lib/auth";
import {
  checkRateLimit,
  clientIp,
  checkLoginAttempt,
} from "../src/lib/rate-limit";
import { assertTestDatabase } from "../scripts/test-db-guard.mjs";
import { demoRevision } from "../scripts/demo-revision.mjs";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  state.cookie = undefined;
  state.set.mockReset();
  state.sessions.clear();
});

describe("Safe error boundaries", () => {
  it("keeps raw errors, causes, and metadata out of HTTP, SSR, and logs", async () => {
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
    expect(await response.json()).toEqual({ error: "Something went wrong. Try again." });
    expect(() => pageDataFailure(error)).toThrow("Something went wrong. Try again.");
    expect(log.mock.calls.map(([line]) => JSON.parse(line).event)).toEqual([
      "BOOKING_INTERNAL_ERROR",
      "BOOKING_INTERNAL_ERROR",
    ]);
  });
  it("preserves safe domain errors and minimizes validation and JSON errors", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const domain = failure(new DomainError("That time is no longer available. Choose another time."));
    expect(domain.status).toBe(400);
    expect(await domain.json()).toEqual({ error: "That time is no longer available. Choose another time." });
    for (const error of [
      z.string().safeParse(42).error,
      new SyntaxError("CANARY"),
    ]) {
      const response = failure(error);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "Check the details and try again.",
      });
    }
    expect(log).not.toHaveBeenCalled();
  });
});

describe("Lokal admins session", () => {
  const secret = "synthetic-session-secret-for-tests-only";
  const identity = { id: "unit-admin", credentialVersion: 1 };
  function token(expiry: number) {
    const id = "1".repeat(64);
    state.sessions.set(createHash("sha256").update(id).digest("hex"), {
      id: createHash("sha256").update(id).digest("hex"),
      expiresAt: new Date(expiry),
      userId: identity.id,
    });
    const value = `${id}.${expiry}`;
    return `${value}.${createHmac("sha256", secret).update(`1:${value}`).digest("hex")}`;
  }
  it("requires a valid signature, exact format, and at most eight hours", async () => {
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
  it("rejects the session after a database error without exposing raw details", async () => {
    vi.stubEnv("SESSION_SECRET", secret);
    state.cookie = token(Date.now() + 60000);
    vi.spyOn(db.adminSession, "findFirst").mockRejectedValueOnce(
      new Error("CANARY@example.test"),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await isAdmin()).toBe(false);
    expect(log.mock.calls.map(([line]) => JSON.parse(line).event)).toEqual(["BOOKING_INTERNAL_ERROR"]);
  });
  it("sets secure cookie flags and revokes a copied cookie", async () => {
    vi.stubEnv("SESSION_SECRET", secret);
    vi.stubEnv("NODE_ENV", "production");
    state.set.mockImplementation((_name, value) => {
      state.cookie = value;
    });
    await login(identity);
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
    const copied = state.cookie;
    expect(await isAdmin()).toBe(true);
    await logout();
    state.cookie = copied;
    expect(await isAdmin()).toBe(false);
    expect(state.set).toHaveBeenLastCalledWith(
      "booking_admin",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
  it("rejects missing, foreign, and invalid origins", async () => {
    for (const origin of [null, "http://other.test", "invalid"]) {
      state.headers = new Headers({ host: "localhost:3000" });
      if (origin) state.headers.set("origin", origin);
      expect(await sameOrigin()).toBe(false);
    }
    state.headers.set("origin", "http://localhost:3000");
    expect(await sameOrigin()).toBe(true);
  });
  it("prunes at most 100 expired or revoked sessions at login and retains active sessions", async () => {
    vi.stubEnv("SESSION_SECRET", secret);
    for (let i = 0; i < 105; i++)
      state.sessions.set(`old-${i}`, {
        id: `old-${i}`,
        expiresAt: new Date(0),
      });
    state.sessions.set("revoked", {
      id: "revoked",
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: new Date(),
    });
    state.sessions.set("active", {
      id: "active",
      expiresAt: new Date(Date.now() + 60000),
    });
    await login(identity);
    expect(state.sessions.size).toBe(8);
    expect(state.sessions.has("active")).toBe(true);
    expect(db.adminSession.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 100,
        where: {
          OR: [
            { expiresAt: { lte: expect.any(Date) } },
            { revokedAt: { not: null } },
          ],
        },
      }),
    );
    await login(identity);
    expect(
      [...state.sessions.keys()].some(
        (id) => id.startsWith("old-") || id === "revoked",
      ),
    ).toBe(false);
    expect(state.sessions.has("active")).toBe(true);
  });
});

describe("Abuse protection and test database guard", () => {
  it("keeps the 60-attempt admin window separate from the 30-attempt customer window", () => {
    const now = Date.now(),
      id = "unit-admin-booking-budget";
    for (let i = 0; i < 60; i++)
      checkRateLimit("admin-bookings", id, true, now);
    expect(() => checkRateLimit("admin-bookings", id, true, now)).toThrow(
      DomainError,
    );
    expect(() =>
      checkRateLimit("admin-bookings", "another-admin-budget", true, now),
    ).not.toThrow();
    for (let i = 0; i < 30; i++) checkRateLimit("bookings", id, true, now);
    expect(() => checkRateLimit("bookings", id, true, now)).toThrow(
      DomainError,
    );
  });
  it("the demo can report an unknown revision without Git", () => {
    expect(
      demoRevision(() => {
        throw new Error("synthetic unavailable git");
      }),
    ).toEqual({ revision: "unknown", dirty: null });
  });
  it("blocks the sixth attempt, isolates routes and IPs, and resets after the window", () => {
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
  it("rejects unsigned identity headers even in proxy mode", () => {
    vi.stubEnv("TRUST_PROXY_IP", "1");
    vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-proof-secret");
    expect(() =>
      clientIp(
        new Headers({
          "x-real-ip": "192.0.2.10",
          "x-booking-client-ip": "192.0.2.10",
          "x-booking-client-proof": "0".repeat(64),
        }),
      ),
    ).toThrow();
  });
  it("never checks a blocked client's password, even with concurrent attempts", async () => {
    const wrong = vi.fn(() => false);
    const attempts = await Promise.allSettled(
      Array.from({ length: 20 }, () => checkLoginAttempt("locked-unit", wrong)),
    );
    expect(wrong).toHaveBeenCalledTimes(5);
    expect(attempts.filter((a) => a.status === "rejected")).toHaveLength(15);
    const correct = vi.fn(() => true);
    await expect(
      checkLoginAttempt("locked-unit", correct),
    ).rejects.toMatchObject({ status: 429 });
    expect(correct).not.toHaveBeenCalled();
    expect(await checkLoginAttempt("other-unit", correct)).toBe(true);
  });
  it("keeps exhausted buckets at capacity and admits new clients after expiry", () => {
    const now = Date.now() + 1800000;
    for (let i = 0; i < 5; i++) checkRateLimit("login", "capacity-original", true, now);
    for (let i = 0; i < 9999; i++) checkRateLimit("login", `capacity-${i}`, true, now);
    expect(checkRateLimit("login", "capacity-read-only", false, now)).toBe(0);
    expect(() => checkRateLimit("login", "capacity-new", true, now)).toThrow(DomainError);
    expect(checkRateLimit("public-tenant", "synthetic-salon", true, now)).toBe(1);
    expect(() => checkRateLimit("login", "capacity-original", true, now)).toThrow(DomainError);
    expect(checkRateLimit("login", "capacity-original", true, now + 900001)).toBe(1);
  });
  it("awaits a failed async verification and throttles 300 concurrent attempts", async () => {
    const verify = vi.fn(async () => {
      await Promise.resolve();
      return false;
    });
    const results = await Promise.allSettled(
      Array.from({ length: 300 }, () =>
        checkLoginAttempt("async-unit", verify),
      ),
    );
    expect(verify).toHaveBeenCalledTimes(5);
    expect(
      results.filter((r) => r.status === "fulfilled" && r.value === false),
    ).toHaveLength(5);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(295);
  });
  it("refunds capacity rejections so a valid login succeeds after more than five rejections", async () => {
    for (let i = 0; i < 8; i++)
      await expect(
        checkLoginAttempt("capacity-refund-unit", async () => {
          throw new PasswordCapacityError();
        }),
      ).rejects.toMatchObject({ status: 429, retryAfter: 1 });
    expect(
      await checkLoginAttempt("capacity-refund-unit", async () => true),
    ).toBe(true);
    const response = failure(new PasswordCapacityError());
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("1");
    expect(await response.json()).toEqual({
      error: "Too many attempts. Please try again later.",
    });
  });
  it("keeps real errors and does not refund unrelated 429 responses", async () => {
    for (let i = 0; i < 4; i++)
      expect(
        await checkLoginAttempt("real-errors-unit", async () => false),
      ).toBe(false);
    for (let i = 0; i < 6; i++)
      await expect(
        checkLoginAttempt("real-errors-unit", async () => {
          throw new PasswordCapacityError();
        }),
      ).rejects.toBeInstanceOf(PasswordCapacityError);
    await expect(
      checkLoginAttempt("real-errors-unit", async () => {
        throw new DomainError("Too many attempts. Please try again later.", 429, 1);
      }),
    ).rejects.toBeInstanceOf(DomainError);
    const correct = vi.fn(async () => true);
    await expect(
      checkLoginAttempt("real-errors-unit", correct),
    ).rejects.toMatchObject({ status: 429, retryAfter: expect.any(Number) });
    expect(correct).not.toHaveBeenCalled();
  });
  it("rejects unsafe database URLs before data access", () => {
    vi.stubEnv("DATABASE_URL", undefined);
    for (const value of [
      undefined,
      "not a URL",
      "postgresql://user@remote.test/db_test",
      "postgresql://user@localhost/production",
      "postgresql://user@127.0.0.1/db_test%2Fprod",
      "postgresql://u@localhost/x_test?host=/tmp",
      "postgresql://u@localhost/x_test?hostaddr=192.0.2.1",
      "postgresql://u@localhost/x_test?%68ost=/tmp",
    ])
      expect(() => assertTestDatabase(value)).toThrow("TEST_DATABASE_REFUSED");
    for (const host of ["localhost", "127.0.0.1", "[::1]"])
      expect(() =>
        assertTestDatabase(`postgresql://user@${host}/booking_test`),
      ).not.toThrow();
  });
});
