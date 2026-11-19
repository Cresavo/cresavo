import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exactRedirect, fetchDocument, publicAddress, secureUrl } from "../src/concept/pairing/clients";
import { matchesPkce, revoke, token } from "../src/concept/pairing/tokens";
import { pairingDb } from "../src/concept/pairing/db";
import { digest, secret } from "../src/concept/pairing/http";
import { freshSnapshot } from "../src/concept/pairing/workspace";
import { weekday } from "../src/concept/data/dates";
import { pairingOrigin } from "../src/concept/pairing/policy";
import { publicReadonlyResponse } from "../src/lib/public-readonly";

vi.mock("../src/concept/pairing/db", async original => ({ ...await original<typeof import("../src/concept/pairing/db")>(), pairingDb: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("pairing boundaries", () => {
  it("requires the exact registered redirect and an S256 proof", () => {
    const registered = ["https://assistant.example.test/return"];
    expect(exactRedirect(registered, registered[0])).toBe(true);
    for (const suffix of ["/", "?x=1", "#fragment"]) expect(exactRedirect(registered, registered[0] + suffix)).toBe(false);
    const verifier = secret();
    expect(matchesPkce(verifier, digest(verifier))).toBe(true);
    expect(matchesPkce(verifier, verifier)).toBe(false);
    expect(matchesPkce("short", digest("short"))).toBe(false);
  });
  it("restricts CIMD to bounded public HTTPS fetches", async () => {
    for (const address of ["0.0.0.0", "127.0.0.1", "10.1.1.1", "172.16.2.1", "192.168.0.1", "169.254.1.2",
      "100.64.0.1", "198.18.0.1", "224.1.2.3", "::1", "::ffff:127.0.0.1"]) expect(publicAddress(address)).toBe(false);
    expect(publicAddress("1.1.1.1")).toBe(true);
    for (const url of ["http://host.test/doc", "https://user@host.test/doc", "https://host.test/doc#fragment"]) expect(() => secureUrl(url)).toThrow();
    for (const url of ["https://127.0.0.1/doc", "https://localhost:8443/doc", "https://host.test/"]) await expect(fetchDocument(url)).rejects.toThrow();
  });
  it("keeps writes gated by flag, host, path and method", () => {
    vi.stubEnv("PUBLIC_READONLY", "1");
    vi.stubEnv("ASSISTANT_PAIRING", "0");
    const req = (path: string, host = "demo.cresavo.com", method = "POST") => new Request("https://" + host + path, { method, headers: { host } });
    expect(publicReadonlyResponse(req("/mcp/owner"))?.status).toBe(403);
    vi.stubEnv("ASSISTANT_PAIRING", "1");
    expect(publicReadonlyResponse(req("/mcp/owner"))).toBeUndefined();
    expect(pairingOrigin(req("/", "cresavo.com").headers)).toBeNull();
    for (const path of ["/api/concept/mcp", "/api/v1/mcp", "/api/admin/login", "/api/pairing/other"]) expect(publicReadonlyResponse(req(path))?.status).toBe(403);
    expect(publicReadonlyResponse(req("/mcp/owner", "demo.cresavo.com", "DELETE"))?.status).toBe(403);
  });
  it("seeds an actual Friday booking in each independent fixture", () => {
    const a = freshSnapshot("2026-11-18"), b = freshSnapshot("2026-11-18");
    const request = a.inbox[0];
    const booked = a.bookings.find(row => row.id === request.bookingId)!;
    expect(weekday(booked.date)).toBe(5);
    expect(booked.status).toBe("booked");
    expect(b.bookings.some(row => row.id === booked.id)).toBe(false);
    expect(a.inbox[1].body).toMatch(/Ignore/);
  });
});

it("consumes a code once, rotates a token family, detects reuse and revokes a live grant", async () => {
  const origin = "https://demo.cresavo.com", audience = origin + "/mcp/owner";
  const verifier = secret(), plainCode = secret(), workspaceId = randomUUID();
  const code = { hash: digest(plainCode), challenge: digest(verifier), clientId: "client", clientName: "Test",
    audience, scopes: "bookings:read", consent: false, workspaceId, redirectUri: "https://assistant.example.test/return", expiresAt: new Date(Date.now() + 300000) };
  const dbDate = new Date(Date.now() + 3600000);
  type Row = { accessHash: string; refreshHash: string; family: string; workspaceId: string; rotated: boolean; clientId: string; audience: string };
  let codes = [code], tokens: Row[] = [];
  const tx = {
    $queryRaw: async () => [{ id: workspaceId, expiresAt: dbDate, hardExpiry: dbDate, revision: 1, count: 1 }],
    pairWorkspace: { update: vi.fn() },
    pairCode: { findUnique: async () => codes[0], deleteMany: async () => { const count = codes.length; codes = []; return { count }; } },
    pairToken: {
      create: async ({ data }: { data: Row }) => tokens.push(data),
      findUnique: async ({ where }: { where: { refreshHash: string } }) => tokens.find(t => t.refreshHash === where.refreshHash),
      findFirst: async ({ where }: { where: { OR: [{ accessHash: string }] } }) => tokens.find(t => t.accessHash === where.OR[0].accessHash),
      update: async ({ where }: { where: { refreshHash: string } }) => { tokens.find(t => t.refreshHash === where.refreshHash)!.rotated = true; },
      deleteMany: async ({ where }: { where: { family?: string; workspaceId?: string } }) => { tokens = tokens.filter(t => t.family !== where.family && t.workspaceId !== where.workspaceId); },
    },
  };
  vi.mocked(pairingDb).mockReturnValue({ $transaction: (fn: (txArg: typeof tx) => unknown) => fn(tx) } as unknown as ReturnType<typeof pairingDb>);
  const req = (data: Record<string, string>) => new Request(origin + "/oauth/token", { method: "POST", body: new URLSearchParams({ client_id: "client", ...data }) });
  const redeem = () => token(req({ grant_type: "authorization_code", code: plainCode, code_verifier: verifier, redirect_uri: code.redirectUri }), origin);
  const refresh = (refresh_token: string) => token(req({ grant_type: "refresh_token", refresh_token }), origin);
  const initial = await (await redeem()).json();
  await expect(redeem()).rejects.toThrow("invalid_grant");
  expect(tokens[0].accessHash).toBe(digest(initial.access_token));
  const rotated = await (await refresh(initial.refresh_token)).json();
  expect(tokens[0].rotated).toBe(true);
  expect(tokens[1].refreshHash).toBe(digest(rotated.refresh_token));
  await expect(refresh(initial.refresh_token)).rejects.toThrow("invalid_grant");
  expect(tokens).toHaveLength(0);
  codes = [code];
  const fresh = await (await redeem()).json();
  expect((await revoke(req({ token: fresh.access_token }))).status).toBe(200);
  expect(tokens).toHaveLength(0);
});
