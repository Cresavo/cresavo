import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("shares in-flight requests and refreshes the count after one hour", async () => {
  const { getStarCount } = await import("../src/concept/site/github-stars");
  fetchMock.mockResolvedValueOnce(Response.json({ stargazers_count: 0 }))
    .mockResolvedValueOnce(Response.json({ stargazers_count: 42 }));
  const timeout = vi.spyOn(AbortSignal, "timeout");
  expect(await Promise.all([getStarCount(), getStarCount()])).toEqual([0, 0]);
  expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/repos/Cresavo/cresavo", { signal: expect.any(AbortSignal) });
  expect(timeout).toHaveBeenCalledWith(2000);
  vi.advanceTimersByTime(3_599_999);
  expect(await getStarCount()).toBe(0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1);
  expect(await getStarCount()).toBe(42);
});

it("omits unavailable or invalid counts and retries after a short cooldown", async () => {
  const { getStarCount } = await import("../src/concept/site/github-stars");
  fetchMock.mockRejectedValueOnce(new DOMException("Timeout", "TimeoutError"))
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
    .mockResolvedValueOnce(Response.json({ stargazers_count: -1 }))
    .mockResolvedValueOnce(Response.json({ stargazers_count: 7 }));
  for (const expected of [null, null, null, 7]) {
    expect(await getStarCount()).toBe(expected);
    vi.advanceTimersByTime(60_000);
  }
});
