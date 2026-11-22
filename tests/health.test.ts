import { afterEach, describe, expect, it, vi } from "vitest";
import { version } from "../package.json";

const queryRaw = vi.fn();
vi.mock("@/lib/db", () => ({ db: { $queryRaw: queryRaw } }));

afterEach(() => {
  vi.unstubAllEnvs();
  queryRaw.mockReset();
});

describe("GET /api/health", () => {
  it("answers ok and the version, and never touches the database by default", async () => {
    const { GET } = await import("@/app/api/health/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, version });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("checks the database only with HEALTH_CHECK_DB=1", async () => {
    vi.stubEnv("HEALTH_CHECK_DB", "1");
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const { GET } = await import("@/app/api/health/route");
    expect(await (await GET()).json()).toEqual({ ok: true, version });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("answers 503 without details when the database fails or hangs", async () => {
    vi.stubEnv("HEALTH_CHECK_DB", "1");
    const { GET } = await import("@/app/api/health/route");
    queryRaw.mockRejectedValue(new Error("postgres://user:pw@host/db refused"));
    let response = await GET();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).toBe(JSON.stringify({ ok: false, version }));
    vi.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));
    const pending = GET();
    await vi.advanceTimersByTimeAsync(2000);
    response = await pending;
    vi.useRealTimers();
    expect(response.status).toBe(503);
  });
});
