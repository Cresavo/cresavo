import { afterAll, afterEach, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { checkLoginAttempt, checkRateLimit } from "../../src/lib/rate-limit";
import { PasswordCapacityError } from "../../src/lib/errors";
import { rateLimitDatabase, reserveRateLimit, refundRateLimit } from "../../src/lib/postgres-rate-limit";
import { createDatabaseClient } from "../../scripts/database.mjs";

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

it("reserves at most five password checks across four processes", async () => {
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

it("refunds only successful or capacity-rejected attempts within the same window", async () => {
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

it("isolates routes, uses the database clock, and stores no raw client identities", async () => {
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

it("limits storage to 10,000 rows and admits a new legitimate client at capacity", async () => {
  const marker = randomUUID();
  const existing = await rateLimitDatabase.rateLimitBucket.count();
  if (existing > 10000) throw new Error("PREVIEW_CAP_FIXTURE_NOT_ISOLATED");
  const data = Array.from({ length: 10000 - existing }, (_, i) => {
    const key = createHmac("sha256", marker).update(String(i)).digest("hex");
    keys.add(key);
    return { key, generation: marker, expiresAt: new Date(Date.now() + 900000), count: 1 };
  });
  await rateLimitDatabase.rateLimitBucket.createMany({ data });
  await expect(reserveRateLimit("login", identity())).resolves.toMatchObject({ count: 1 });
  expect(await rateLimitDatabase.rateLimitBucket.count()).toBeLessThanOrEqual(10000);
}, 30000);

it("rejects in-memory rate limiting on Vercel", () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("RATE_LIMIT_STORE", "memory");
  expect(() => checkRateLimit("login", "synthetic")).toThrow("RATE_LIMIT_CONFIG_INVALID");
});

it("a refund waits for another connection's reservation and survives its update", async () => {
  const reservation = await reserveRateLimit("login", identity());
  const other = createDatabaseClient(undefined, 1);
  let locked!: () => void, release!: () => void;
  const ready = new Promise<void>((resolve) => { locked = resolve; });
  const proceed = new Promise<void>((resolve) => { release = resolve; });
  const writer = other.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('booking-lab:rate-store:v1'))`;
    const old = await tx.rateLimitBucket.findUniqueOrThrow({ where: { key: reservation.key } });
    locked();
    await proceed;
    await tx.rateLimitBucket.update({ where: { key: old.key }, data: { count: old.count + 1 } });
  }, { timeout: 10000 });
  try {
    await ready;
    const refund = refundRateLimit(reservation);
    const outcome = await Promise.race([
      refund.then(() => "finished"),
      new Promise<string>((resolve) => setTimeout(() => resolve("waiting"), 200)),
    ]);
    release();
    await writer;
    await refund;
    expect(outcome).toBe("waiting");
    const row = await rateLimitDatabase.rateLimitBucket.findUniqueOrThrow({ where: { key: reservation.key } });
    expect(row.count).toBe(1);
  } finally {
    release();
    await writer;
    await other.$disconnect();
  }
}, 30000);
