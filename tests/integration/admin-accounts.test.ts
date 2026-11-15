import { afterEach, expect, it, vi } from "vitest";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  createAdminUser,
  disableAdminUser,
  resetAdminPassword,
  verifyAdminCredentials,
} from "../../src/lib/admin-accounts";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (jar.value ? { value: jar.value } : undefined),
    set: (_name: string, value: string) => {
      jar.value = value;
    },
  }),
  headers: async () => new Headers(),
}));
import { getAdminContext, isAdmin, login, logout } from "../../src/lib/auth";
const marker = `identity-${randomUUID()}`;
const ids: string[] = [];
const password = "synthetic-admin-password-A-2026";
const replacement = "synthetic-admin-password-B-2026";
async function account(suffix: string) {
  const email = `${marker}-${suffix}@example.test`;
  const user = await createAdminUser(email, password);
  ids.push(user.id);
  return { ...user, email };
}
async function signIn(email: string, value = password) {
  const identity = await verifyAdminCredentials({ email, password: value });
  expect(identity).not.toBeNull();
  expect(await login(identity!)).toBe(true);
  return jar.value!;
}

afterEach(async () => {
  jar.value = undefined;
  vi.unstubAllEnvs();
  await db.adminSession.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { id: { startsWith: marker } }] },
  });
  await db.adminUser.deleteMany({ where: { id: { in: ids } } });
  ids.length = 0;
  await db.$disconnect();
});

it("lagrar hash, normaliserar identifierare och nekar ogiltig/duplicerad indata", async () => {
  const a = await account("valid");
  const row = await db.adminUser.findUniqueOrThrow({ where: { id: a.id } });
  expect(row.passwordHash).toMatch(/^\$argon2id\$/);
  expect(row.passwordHash).not.toContain(password);
  expect(
    await verifyAdminCredentials({
      email: ` ${a.email.toUpperCase()} `,
      password,
    }),
  ).toEqual({ id: a.id, credentialVersion: 1 });
  for (const input of [
    { email: a.email, password: "wrong" },
    { email: `${marker}-missing@example.test`, password },
    { password },
    { email: a.email, password: "x".repeat(129) },
    { email: a.email, password, businessId: "other" },
  ])
    expect(await verifyAdminCredentials(input)).toBeNull();
  await expect(
    createAdminUser(a.email.toUpperCase(), password),
  ).rejects.toMatchObject({ code: "P2002" });
  await expect(createAdminUser("not-email", password)).rejects.toThrow();
  await expect(
    createAdminUser(`${marker}-short@example.test`, "short"),
  ).rejects.toThrow();
  expect(await db.adminSession.count({ where: { userId: a.id } })).toBe(0);
});

it("kopplar minimerad identitet till tokenhash och logout påverkar bara rätt session", async () => {
  const a = await account("logout-a"),
    b = await account("logout-b");
  const cookieA = await signIn(a.email);
  const context = await getAdminContext();
  expect(context).toEqual({ id: a.id, email: a.email });
  const session = await db.adminSession.findFirstOrThrow({
    where: { userId: a.id },
  });
  const token = cookieA.split(".")[0];
  expect(session.id).not.toBe(token);
  expect(session.id).toBe(createHash("sha256").update(token).digest("hex"));
  const cookieB = await signIn(b.email);
  jar.value = cookieA;
  await logout();
  jar.value = cookieA;
  expect(await isAdmin()).toBe(false);
  jar.value = cookieB;
  expect(await isAdmin()).toBe(true);
});

it("återställer ett kontos lösenord och nekar gamla verifieringar/cookies utan att röra andra", async () => {
  const a = await account("reset-a"),
    b = await account("reset-b");
  const oldIdentity = await verifyAdminCredentials({
    email: a.email,
    password,
  });
  const cookieA = await signIn(a.email),
    cookieB = await signIn(b.email);
  await resetAdminPassword(a.email, replacement);
  jar.value = cookieA;
  expect(await isAdmin()).toBe(false);
  expect(await login(oldIdentity!)).toBe(false);
  expect(await verifyAdminCredentials({ email: a.email, password })).toBeNull();
  await signIn(a.email, replacement);
  jar.value = cookieB;
  expect(await isAdmin()).toBe(true);
});

it("spärrar konto och gamla sessioner förblir ogiltiga även efter direkt återaktivering", async () => {
  const a = await account("disabled"),
    b = await account("still-active");
  const oldIdentity = await verifyAdminCredentials({
    email: a.email,
    password,
  });
  const cookieA = await signIn(a.email),
    cookieB = await signIn(b.email);
  await disableAdminUser(a.email);
  expect(await verifyAdminCredentials({ email: a.email, password })).toBeNull();
  jar.value = cookieA;
  expect(await isAdmin()).toBe(false);
  await db.adminUser.update({ where: { id: a.id }, data: { active: true } });
  expect(await isAdmin()).toBe(false);
  expect(await login(oldIdentity!)).toBe(false);
  jar.value = cookieB;
  expect(await isAdmin()).toBe(true);
});

it("nekar främmande verksamhet, gamla konto-lösa cookies och ADMIN_PASSWORD-fallback", async () => {
  const a = await account("foreign");
  const cookie = await signIn(a.email);
  const identity = await verifyAdminCredentials({ email: a.email, password });
  await db.adminUser.update({
    where: { id: a.id },
    data: { businessId: "other" },
  });
  jar.value = cookie;
  expect(await isAdmin()).toBe(false);
  expect(await verifyAdminCredentials({ email: a.email, password })).toBeNull();
  expect(await login(identity!)).toBe(false);
  vi.stubEnv("ADMIN_PASSWORD", password);
  expect(await verifyAdminCredentials({ password })).toBeNull();
  const token = randomUUID().replaceAll("-", "").repeat(2),
    expiry = Date.now() + 60000;
  const value = `${token}.${expiry}`;
  const id = createHash("sha256").update(token).digest("hex");
  await db.adminSession.create({ data: { id, expiresAt: new Date(expiry) } });
  try {
    jar.value = `${value}.${createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`${process.env.ADMIN_SESSION_VERSION ?? "1"}:${value}`)
      .digest("hex")}`;
    expect(await isAdmin()).toBe(false);
  } finally {
    await db.adminSession.delete({ where: { id } });
  }
});

it("samtidig reset och login lämnar aldrig gammal session giltig efter reset", async () => {
  const a = await account("race");
  const identity = await verifyAdminCredentials({ email: a.email, password });
  await Promise.all([
    login(identity!),
    resetAdminPassword(a.email, replacement),
  ]);
  expect(await isAdmin()).toBe(false);
  expect(await verifyAdminCredentials({ email: a.email, password })).toBeNull();
});
