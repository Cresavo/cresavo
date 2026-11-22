import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The owner actions route with the session and the store replaced: the size caps are per action type.

const apply = vi.fn(async () => ({ ok: true, state: {}, version: 1, replayed: false }));
vi.mock("@/lib/owner-session", async (original) => ({ ...(await original<typeof import("@/lib/owner-session")>()), ownerFromCookie: async () => ({ tenantId: "t-1" }) }));
vi.mock("@/lib/owner-store", async (original) => ({ ...(await original<typeof import("@/lib/owner-store")>()), ownerStore: () => ({ apply }) }));

const origin = "http://localhost";
const key = "a".repeat(32);

async function send(action: unknown) {
  const { POST } = await import("@/app/api/owner/salon/actions/route");
  return POST(new NextRequest(`${origin}/api/owner/salon/actions`, {
    method: "POST", body: JSON.stringify({ action, idempotencyKey: key }),
    headers: { origin, host: "localhost", cookie: "owner=x", "content-type": "application/json" },
  }));
}

const row = (i: number) => ({
  firstName: `Fictional${i}`, lastName: "Example", phone: `073-410 ${String(i).padStart(4, "0")}`, email: `fictional${i}@mail.example`,
  category: "both", preferredStaff: "anna", since: "2026-11-16", isRegular: false, note: "n".repeat(300), tags: ["Imported"], waitlist: false,
});

beforeEach(() => { vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1"); apply.mockClear(); });
afterEach(() => vi.unstubAllEnvs());

describe("owner actions route size caps", () => {
  it("accepts a 2,000-row customer import well over 64 KB", async () => {
    const action = { type: "customers/import", customers: Array.from({ length: 2000 }, (_, i) => row(i)) };
    expect(JSON.stringify(action).length).toBeGreaterThan(64 * 1024);
    const response = await send(action);
    expect(response.status).toBe(200);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("still refuses an import with an unknown field or a too-long note", async () => {
    expect((await send({ type: "customers/import", customers: [{ ...row(1), extra: 1 }] })).status).toBe(400);
    expect((await send({ type: "customers/import", customers: [{ ...row(1), note: "n".repeat(501) }] })).status).toBe(400);
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses any other action over 64 KB with 413", async () => {
    const response = await send({ type: "customer/note", id: "k-7", note: "x".repeat(100 * 1024) });
    expect(response.status).toBe(413);
    expect(apply).not.toHaveBeenCalled();
  });

  it("refuses an import over its own cap with 413", async () => {
    const response = await send({ type: "customers/import", customers: [row(1)], padding: "x".repeat(2.6 * 1024 * 1024) });
    expect(response.status).toBe(413);
  });
});
