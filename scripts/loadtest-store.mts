import { randomBytes, randomUUID } from "node:crypto";
import { addDays } from "../src/concept/data/dates";
import { createDemoState } from "../src/concept/data/generate";
import { PostgresStudioStore } from "../src/concept/store/postgres-studio-store";
import { percentile } from "../src/concept/store/store-metrics";
import { salonClock } from "../src/concept/tools/clock";
import { createDatabaseClient } from "./database.mjs";
import { assertTestDatabase } from "./test-db-guard.mjs";

const BOOKING_COUNT = 10_000;
const WARMUP = 5;
const SAMPLES = 50;

async function run() {
  assertTestDatabase();
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error("A local _test database is required");
  const prisma = createDatabaseClient(process.env.DATABASE_URL, 2);
  const tenantId = `loadtest-${randomUUID()}`;
  let seeded = false;
  try {
    const day = salonClock().today;
    const fixture = createDemoState(day);
    const templates = fixture.bookings.filter((booking) => booking.status === "completed");
    const bookings = Array.from({ length: BOOKING_COUNT }, (_, index) => ({
      ...templates[index % templates.length],
      id: `loadtest-booking-${index}`,
      date: addDays(day, -1 - Math.floor(index / templates.length)),
    }));
    const state = { ...fixture, bookings };
    const document = JSON.stringify(state);
    await prisma.$executeRaw`
      INSERT INTO tenant_state (tenant_id, kind, doc) VALUES (${tenantId}, 'salon', ${document}::jsonb)`;
    seeded = true;
    const sink = () => {};
    const store = new PostgresStudioStore({
      prisma, hmacSecret: randomBytes(32).toString("hex"), sinks: { payment: sink, message: sink }, deliverAfterCommit: false,
    });
    const loadMs: number[] = [];
    const applyMs: number[] = [];
    for (let i = 0; i < WARMUP + SAMPLES; i++) {
      const startLoad = performance.now();
      const loaded = await store.load(tenantId);
      const load = performance.now() - startLoad;
      if (loaded?.state.bookings.length !== BOOKING_COUNT) throw new Error("Load failed");
      const startApply = performance.now();
      const applied = await store.apply(tenantId, { type: "card/dismiss", id: `loadtest-card-${i}` }, {}, { expectedVersion: loaded.version });
      const apply = performance.now() - startApply;
      if (!applied.ok) throw new Error("Apply failed");
      if (i >= WARMUP) {
        loadMs.push(load);
        applyMs.push(apply);
      }
    }
    const summary = (samples: number[]) => ({
      p50: Number(percentile(samples, 0.50).toFixed(2)),
      p95: Number(percentile(samples, 0.95).toFixed(2)),
    });
    console.log(JSON.stringify({
      bookings: BOOKING_COUNT, samples: SAMPLES, documentBytes: store.store_metrics().documentBytes,
      loadMs: summary(loadMs), applyMs: summary(applyMs),
    }));
  } finally {
    try {
      if (seeded) {
        await prisma.$transaction([
          prisma.$executeRaw`DELETE FROM tenant_action WHERE tenant_id = ${tenantId}`,
          prisma.$executeRaw`DELETE FROM tenant_state WHERE tenant_id = ${tenantId}`,
        ]);
      }
    } finally {
      await prisma.$disconnect();
    }
  }
}

try {
  await run();
} catch {
  console.error("STORE_LOADTEST_FAILED");
  process.exitCode = 1;
}
