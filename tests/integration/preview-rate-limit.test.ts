import { afterAll, afterEach, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { checkLoginAttempt, checkRateLimit } from "../../src/lib/rate-limit";
import { PasswordCapacityError } from "../../src/lib/errors";
import { rateLimitDatabase, reserveRateLimit, refundRateLimit } from "../../src/lib/postgres-rate-limit";

const keys = new Set<string>();
function track(route: string, value: string) {
  keys.add(createHmac("sha256", process.env.SESSION_SECRET!)
    .update(`rate-limit:v1:${route}:${value}`).digest("hex"));
}
function identity(route = "login") {
  const value = `preview-${randomUUID()}`;
  track(route, value);
  return value;
}
afterEach(async () => {
  vi.unstubAllEnvs();
  await rateLimitDatabase.rateLimitBucket.deleteMany({ where: { key: { in: [...keys] } } });
  keys.clear();
});
afterAll(() => rateLimitDatabase.$disconnect());

it("reserverar högst fem lösenordskontroller mellan fyra riktiga processer", async () => {
  const client = identity();
  const script = `import { checkLoginAttempt } from './src/lib/rate-limit.ts';
    let checked=0, blocked=0;
    await Promise.all(Array.from({length:5},async()=>{
      try { await checkLoginAttempt(${JSON.stringify(client)},async()=>{checked++;return false;}); }
      catch(e){ if(e.status===429)blocked++;else throw e; }
    }));
    console.log(JSON.stringify({checked,blocked}));
    const {rateLimitDatabase}=await import('./src/lib/postgres-rate-limit.ts');
    await rateLimitDatabase.$disconnect();`;
  const run = () => new Promise<{ checked: number; blocked: number }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
        TEMP: process.env.TEMP, TMP: process.env.TMP,
        DATABASE_URL: process.env.DATABASE_URL,
        SESSION_SECRET: process.env.SESSION_SECRET,
        RATE_LIMIT_STORE: "postgres",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (data) => { output += data; });
    child.stderr.on("data", () => { /* Never echo arbitrary subprocess errors. */ });
    child.on("error", () => reject(new Error("PREVIEW_LIMITER_CHILD_FAILED")));
    child.on("close", (code) => {
      if (code !== 0) reject(new Error("PREVIEW_LIMITER_CHILD_FAILED"));
      else { try { resolve(JSON.parse(output.trim())); } catch { reject(new Error("PREVIEW_LIMITER_CHILD_OUTPUT")); } }
    });
  });
  const results = await Promise.all(Array.from({ length: 4 }, run));
  expect(results.reduce((sum, row) => sum + row.checked, 0)).toBe(5);
  expect(results.reduce((sum, row) => sum + row.blocked, 0)).toBe(15);
  vi.stubEnv("RATE_LIMIT_STORE", "postgres");
  const correct = vi.fn(() => true);
  await expect(checkLoginAttempt(client, correct)).rejects.toMatchObject({ status: 429 });
  expect(correct).not.toHaveBeenCalled();
  expect(await checkLoginAttempt(identity(), correct)).toBe(true);
}, 30000);

it("refundar bara lyckade eller kapacitetsnekade reservationer, aldrig ett nytt fönster", async () => {
  vi.stubEnv("RATE_LIMIT_STORE", "postgres");
  const client = identity();
  for (let i = 0; i < 7; i++) {
    expect(await checkLoginAttempt(client, () => true)).toBe(true);
    await expect(checkLoginAttempt(client, () => { throw new PasswordCapacityError(); }))
      .rejects.toBeInstanceOf(PasswordCapacityError);
  }
  for (let i = 0; i < 5; i++) expect(await checkLoginAttempt(client, () => false)).toBe(false);
  await expect(checkLoginAttempt(client, () => true)).rejects.toMatchObject({ status: 429 });
  const expired = await reserveRateLimit("login", identity());
  await rateLimitDatabase.rateLimitBucket.update({
    where: { key: expired.key }, data: { expiresAt: new Date(0) },
  });
  // Recreate the same identity by using its known store key in the DB fixture.
  const nextGeneration = randomUUID();
  await rateLimitDatabase.rateLimitBucket.update({
    where: { key: expired.key },
    data: { generation: nextGeneration, count: 5, expiresAt: new Date(Date.now() + 900000) },
  });
  await refundRateLimit(expired);
  expect((await rateLimitDatabase.rateLimitBucket.findUniqueOrThrow({ where: { key: expired.key } })).count).toBe(5);
});

it("håller rutterna åtskilda, använder databasens klocka och lagrar inga råa identiteter", async () => {
  vi.stubEnv("RATE_LIMIT_STORE", "postgres");
  const client = identity("bookings");
  for (let i = 0; i < 30; i++) await checkRateLimit("bookings", client);
  await expect(checkRateLimit("bookings", client)).rejects.toMatchObject({ status: 429, retryAfter: expect.any(Number) });
  track("login", client);
  await expect(checkRateLimit("login", client)).resolves.toBe(1);
  const row = await rateLimitDatabase.rateLimitBucket.findFirstOrThrow({ where: { key: { in: [...keys] }, count: 30 } });
  expect(row.key).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(row)).not.toContain(client);
  await rateLimitDatabase.rateLimitBucket.update({ where: { key: row.key }, data: { expiresAt: new Date(0) } });
  await expect(checkRateLimit("bookings", client)).resolves.toBe(1);
});

it("begränsar lagret till10000rader och nekar inte en ny legitim klient vid kapacitet", async () => {
  const marker = randomUUID();
  const data = Array.from({ length: 10000 }, (_, i) => {
    const key = createHmac("sha256", marker).update(String(i)).digest("hex");
    keys.add(key);
    return { key, generation: marker, expiresAt: new Date(Date.now() + 900000), count: 1 };
  });
  await rateLimitDatabase.rateLimitBucket.createMany({ data });
  await expect(reserveRateLimit("login", identity())).resolves.toMatchObject({ count: 1 });
  expect(await rateLimitDatabase.rateLimitBucket.count()).toBe(10000);
}, 30000);

it("vägrar lokal minnesspärr när processen kör i Vercel", () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("RATE_LIMIT_STORE", "memory");
  expect(() => checkRateLimit("login", "synthetic")).toThrow("RATE_LIMIT_CONFIG_INVALID");
});
