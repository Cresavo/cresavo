import { NextRequest } from "next/server";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { POST as adminLogin } from "../src/app/api/admin/login/route";
import { POST as ownerLogin } from "../src/app/api/owner/login/route";
import { checkLoginAttempt } from "../src/lib/rate-limit";
import { PasswordCapacityError } from "../src/lib/errors";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), owner: vi.fn(), login: vi.fn(), session: vi.fn() }));
vi.mock("../src/lib/auth", () => ({ sameOrigin: async () => true, login: mocks.login }));
vi.mock("../src/lib/admin-accounts", () => ({ verifyAdminCredentials: mocks.admin }));
vi.mock("../src/lib/owner-accounts", async (original) => ({
  ...(await original<typeof import("../src/lib/owner-accounts")>()), verifyOwnerCredentials: mocks.owner,
}));
vi.mock("../src/lib/owner-session", async (original) => ({
  ...(await original<typeof import("../src/lib/owner-session")>()), openOwnerSession: mocks.session,
}));
vi.mock("../src/lib/rate-limit", async (original) => ({
  ...(await original<typeof import("../src/lib/rate-limit")>()),
  clientIp: (headers: Headers) => headers.get("x-test-ip")!,
}));

beforeAll(() => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("RATE_LIMIT_STORE", "memory");
});
afterAll(() => vi.unstubAllEnvs());

for (const [name, route] of [["admin", adminLogin], ["owner", ownerLogin]] as const) {
  const request = (body: BodyInit, ip: string, extra: Record<string, string> = {}) => new NextRequest(`http://localhost/api/${name}/login`, {
    method: "POST", body, headers: { origin: "http://localhost", host: "localhost", "x-test-ip": ip, ...extra },
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  } as ConstructorParameters<typeof NextRequest>[1]);

  it(`${name} rejects oversized declared and streamed login bodies`, async () => {
    const declared = request("{}", `${name}-declared`, { "content-length": "8193" });
    expect((await route(declared)).status).toBe(413);
    const stream = new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(4096));
      controller.enqueue(new Uint8Array(4097));
      controller.close();
    } });
    expect((await route(request(stream, `${name}-stream`))).status).toBe(413);
  });

  it(`${name} reserves an attempt while a slow body is still open`, async () => {
    const ip = `${name}-slow`;
    for (let n = 0; n < 4; n++) await checkLoginAttempt(ip, () => false);
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    let started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const stream = new ReadableStream<Uint8Array>({ start(c) { controller = c; }, pull() { started(); } }, { highWaterMark: 0 });
    const pending = route(request(stream, ip));
    try {
      await reading;
      const rejected = request("{}", ip);
      expect((await route(rejected)).status).toBe(429);
      expect(rejected.bodyUsed).toBe(false);
    } finally {
      controller.enqueue(new TextEncoder().encode("{}"));
      controller.close();
      await pending;
    }
  });

  it.each(["malformed", "oversized"])(`${name} counts a %s body`, async (kind) => {
    const ip = `${name}-${kind}-count`;
    for (let n = 0; n < 5; n++) {
      const req = kind === "malformed" ? request("{", ip) : request("{}", ip, { "content-length": "8193" });
      expect((await route(req)).status).toBe(kind === "oversized" ? 413 : name === "admin" ? 400 : 401);
    }
    expect((await route(request("{}", ip))).status).toBe(429);
  });

  it.each(["success", "capacity"])(`${name} refunds a %s attempt`, async (kind) => {
    const ip = `${name}-${kind}-refund`;
    const verify = name === "admin" ? mocks.admin : mocks.owner;
    verify.mockReset();
    if (kind === "capacity") verify.mockRejectedValue(new PasswordCapacityError());
    else {
      verify.mockResolvedValue({ identity: {} });
      mocks.login.mockResolvedValue(true);
      mocks.session.mockResolvedValue({ value: "fake", expires: new Date(Date.now() + 60000) });
    }
    try {
      for (let n = 0; n < 6; n++) expect((await route(request("{}", ip))).status).toBe(kind === "success" ? 200 : 429);
      verify.mockResolvedValue(null);
      expect((await route(request("{}", ip))).status).toBe(401);
    } finally { verify.mockReset(); }
  });

  it(`${name} does not read a body after the login limit is exhausted`, async () => {
    const ip = `${name}-exhausted`;
    for (let n = 0; n < 5; n++) await checkLoginAttempt(ip, () => false);
    const req = request("{}", ip);
    expect((await route(req)).status).toBe(429);
    expect(req.bodyUsed).toBe(false);
  });
}

it("keeps the admin malformed JSON response", async () => {
  const request = new NextRequest("http://localhost/api/admin/login", {
    method: "POST", body: "{", headers: { "x-test-ip": "admin-malformed" },
  });
  const response = await adminLogin(request);
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Check the details and try again." });
});
