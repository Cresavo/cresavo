import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { failure } from "../src/lib/http";
import { DomainError, pageDataFailure } from "../src/lib/errors";

const state = vi.hoisted(() => ({ cookie: undefined as string | undefined, set: vi.fn(), headers: new Headers() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => state.cookie ? { value: state.cookie } : undefined, set: state.set }),
  headers: async () => state.headers
}));
import { checkPassword, isAdmin, login, sameOrigin } from "../src/lib/auth";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); state.cookie = undefined; state.set.mockReset(); });

describe("Säkra felgränser", () => {
  it("lämnar inte ut feltext, cause eller metadata via HTTP, SSR eller loggar", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("finns inte CANARY@example.test postgres://CANARY"), {
      cause: new Error("CANARY secret"), meta: { query: "CANARY" }
    });
    const response = failure(error);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Ett fel inträffade" });
    expect(() => pageDataFailure(error)).toThrow("Ett fel inträffade");
    expect(log.mock.calls).toEqual([["BOOKING_INTERNAL_ERROR"], ["BOOKING_INTERNAL_ERROR"]]);
  });
  it("behåller säkra domänfel och minimerar validerings- och JSON-fel", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const domain = failure(new DomainError("Tiden är inte tillgänglig"));
    expect(domain.status).toBe(400);
    expect(await domain.json()).toEqual({ error: "Tiden är inte tillgänglig" });
    for (const error of [z.string().safeParse(42).error, new SyntaxError("CANARY")]) {
      const response = failure(error);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Kontrollera uppgifterna" });
    }
    expect(log).not.toHaveBeenCalled();
  });
});

describe("Lokal admins session", () => {
  const secret = "synthetic-session-secret-for-tests-only";
  function token(expiry: number) {
    const value = String(expiry);
    return `${value}.${createHmac("sha256", secret).update(value).digest("hex")}`;
  }
  it("kräver giltig signatur, exakt format och högst åtta timmar", async () => {
    vi.stubEnv("SESSION_SECRET", secret);
    const valid = token(Date.now() + 60_000);
    state.cookie = valid;
    expect(await isAdmin()).toBe(true);
    for (const value of [undefined, `${valid}.extra`, valid.replace(/.$/, "z"), token(Date.now() - 1), token(Date.now() + 9 * 3600_000), "9".repeat(10000)]) {
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
    expect(state.set).toHaveBeenCalledWith("booking_admin", expect.any(String), {
      httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 28800
    });
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
