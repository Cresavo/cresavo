import { beforeEach, describe, expect, it, vi } from "vitest";

// The demo studio's server writes (AI settings, proposal decisions, demo reset) are limited per address.
// Each route gets a fresh module graph, so its counter starts at zero.

const same = { origin: "http://localhost", "sec-fetch-site": "same-origin", host: "localhost" };
const call = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, { method, headers: { ...same, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PUBLIC_READONLY", "");
  vi.stubEnv("CONCEPT_KEY_SECRET", "");
});

async function exhaust(send: () => Promise<Response>) {
  for (let i = 0; i < 30; i++) expect((await send()).status, `call ${i + 1}`).not.toBe(429);
  const limited = await send();
  expect(limited.status).toBe(429);
  expect(limited.headers.get("Retry-After")).toMatch(/^\d+$/);
  expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
  expect(await limited.json()).toEqual({ error: "rate_limited" });
}

describe("demo write limit", () => {
  it("limits PUT /api/concept/ai", async () => {
    const { PUT } = await import("@/app/api/concept/ai/route");
    await exhaust(() => Promise.resolve(PUT(call("PUT", "/api/concept/ai", { nope: true }), {})));
  });

  it("limits DELETE /api/concept/ai", async () => {
    const { DELETE } = await import("@/app/api/concept/ai/route");
    await exhaust(() => Promise.resolve(DELETE(call("DELETE", "/api/concept/ai"), {})));
  });

  it("limits DELETE /api/concept/proposals (the demo reset)", async () => {
    const { DELETE } = await import("@/app/api/concept/proposals/route");
    await exhaust(() => Promise.resolve(DELETE(call("DELETE", "/api/concept/proposals"), {})));
  }, 30_000);

  it("limits POST /api/concept/proposals/[id]", async () => {
    const { POST } = await import("@/app/api/concept/proposals/[id]/route");
    await exhaust(() => Promise.resolve(POST(call("POST", "/api/concept/proposals/p1", { decision: "approved" }), { params: Promise.resolve({ id: "p1" }) })));
  });

  it("does not count a request from another site against the allowance", async () => {
    const { DELETE } = await import("@/app/api/concept/proposals/route");
    const foreign = () => Promise.resolve(DELETE(new Request("http://localhost/api/concept/proposals", { method: "DELETE", headers: { origin: "https://elsewhere.example", "sec-fetch-site": "cross-site", host: "localhost" } }), {}));
    for (let i = 0; i < 35; i++) expect((await foreign()).status).toBe(403);
    expect((await Promise.resolve(DELETE(call("DELETE", "/api/concept/proposals"), {}))).status).toBe(204);
  });

  it("lets the allowance run out only for the limiter's own window", async () => {
    const { createDemoWriteGuard } = await import("@/concept/server/demo-write-limit");
    const guard = createDemoWriteGuard({ max: 1, windowMs: 60_000 });
    const request = new Request("http://localhost/x");
    expect(guard(request)).toBeUndefined();
    expect(guard(request)?.status).toBe(429);
  });
});
