import { NextRequest } from "next/server";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { POST as adminLogin } from "../src/app/api/admin/login/route";
import { POST as ownerLogin } from "../src/app/api/owner/login/route";
import { checkLoginAttempt } from "../src/lib/rate-limit";

vi.mock("../src/lib/auth", () => ({ sameOrigin: async () => true, login: async () => false }));
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
