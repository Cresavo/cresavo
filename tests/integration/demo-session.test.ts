import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "../../src/lib/db";
import { createAdminUser } from "../../src/lib/admin-accounts";
import {
  demoDatabaseFingerprint,
  DEMO_ADMIN_EMAIL,
} from "../../src/lib/demo-access";
import { addressProof } from "../../scripts/client-address.mjs";
const state = vi.hoisted(() => ({
  cookie: "",
  origin: "http://localhost:3000",
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie ? { value: state.cookie } : undefined),
    set: (_name: string, value: string) => {
      state.cookie = value;
    },
  }),
  headers: async () =>
    new Headers({ host: "localhost:3000", origin: state.origin }),
}));
import { POST } from "../../src/app/api/demo/session/route";
import { getAdminContext, logout, login } from "../../src/lib/auth";
const users: string[] = [];
function configure() {
  for (const [k, v] of Object.entries({
    BOOKING_DEMO_ACCESS: "1",
    BOOKING_RUNTIME: "vercel",
    RATE_LIMIT_STORE: "postgres",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_ID: "synthetic-preview",
    BOOKING_DEMO_PROJECT_ID: "synthetic-preview",
    BOOKING_DEMO_DATABASE: demoDatabaseFingerprint(process.env.DATABASE_URL!),
    BOOKING_ADDRESS_SECRET: "synthetic-wrapper-secret-for-demo-tests",
  }))
    vi.stubEnv(k, v);
}
function request() {
  return new NextRequest("http://localhost:3000/api/demo/session", {
    method: "POST",
    headers: {
      "x-booking-client-ip": "127.91.0.1",
      "x-booking-client-proof": addressProof(
        "127.91.0.1",
        process.env.BOOKING_ADDRESS_SECRET ?? "not-configured",
      ),
    },
  });
}
afterEach(async () => {
  state.cookie = "";
  state.origin = "http://localhost:3000";
  vi.unstubAllEnvs();
  await db.adminSession.deleteMany({ where: { userId: { in: users } } });
  await db.adminUser.deleteMany({ where: { id: { in: users } } });
  await db.rateLimitBucket.deleteMany({
    where: {
      key: createHmac("sha256", process.env.SESSION_SECRET!)
        .update("rate-limit:v1:login:127.91.0.1")
        .digest("hex"),
    },
  });
  users.length = 0;
  await db.$disconnect();
});
it("nekar defaultläge, produktion och främmande origin utan sessionsskrivning", async () => {
  expect((await POST(request())).status).toBe(403);
  configure();
  vi.stubEnv("VERCEL_ENV", "production");
  expect((await POST(request())).status).toBe(403);
  vi.stubEnv("VERCEL_ENV", "preview");
  state.origin = "https://other.example.test";
  expect((await POST(request())).status).toBe(403);
  state.origin = "";
  expect((await POST(request())).status).toBe(403);
  expect(state.cookie).toBe("");
});
it("ger märkt demoaktör en vanlig återkallelig session och återanvänder den", async () => {
  configure();
  const user = await createAdminUser(
    DEMO_ADMIN_EMAIL,
    "synthetic-demo-actor-password-2026",
  );
  users.push(user.id);
  expect((await POST(request())).status).toBe(200);
  expect(await getAdminContext()).toEqual({
    id: user.id,
    email: DEMO_ADMIN_EMAIL,
  });
  const copied = state.cookie;
  expect((await POST(request())).status).toBe(200);
  expect(await db.adminSession.count({ where: { userId: user.id } })).toBe(1);
  for (const patch of [
    ["BOOKING_DEMO_ACCESS", "0"],
    ["VERCEL_ENV", "production"],
    ["BOOKING_DEMO_DATABASE", "0".repeat(64)],
  ]) {
    vi.stubEnv(patch[0], patch[1]);
    expect(await getAdminContext()).toBeNull();
    configure();
  }
  await logout();
  state.cookie = copied;
  expect(await getAdminContext()).toBeNull();
});
it("nekar saknad/inaktiverad demoaktör och påverkar inte vanlig adminsession", async () => {
  configure();
  expect((await POST(request())).status).toBe(403);
  const demo = await createAdminUser(
    DEMO_ADMIN_EMAIL,
    "synthetic-inactive-demo-password-2026",
  );
  users.push(demo.id);
  await db.adminUser.update({
    where: { id: demo.id },
    data: { active: false },
  });
  expect((await POST(request())).status).toBe(403);
  const user = await createAdminUser(
    "regular-demo-session-test@example.test",
    "synthetic-regular-password-2026",
  );
  users.push(user.id);
  vi.stubEnv("BOOKING_DEMO_ACCESS", "0");
  expect(await login({ id: user.id, credentialVersion: 1 })).toBe(true);
  expect((await getAdminContext())?.id).toBe(user.id);
});
