// Cancellation of the staging runner while it acquires resources. Its own file: the first final
// stop refuses every later child process for the rest of the process.
import { spawn } from "node:child_process";
import { expect, it } from "vitest";
import { acquisition, databaseAlreadyExisted } from "../scripts/staging-consent/lifecycle.mjs";
import { isStopping, runStep, startServer, stopAll, track } from "../scripts/staging-consent/processes.mjs";

it("waits for a database creation in flight before deciding what to drop", async () => {
  const database = acquisition();
  expect(await database.settled()).toBe(false);
  let finish!: () => void;
  const created = database.run(() => new Promise<void>(resolve => { finish = resolve; }));
  const order: string[] = [];
  // A cancellation arrives while CREATE DATABASE has not returned yet.
  const cleanup = database.settled().then(attempted => { order.push(`cleanup attempted=${attempted}`); });
  await new Promise(resolve => setTimeout(resolve, 20));
  order.push("created");
  finish(); await created; await cleanup;
  expect(order).toEqual(["created", "cleanup attempted=true"]);
  // A failure that does not rule creation out (a lost reply): the release (DROP ... IF EXISTS) runs.
  const failed = acquisition();
  await expect(failed.run(() => Promise.reject(new Error("CONNECTION_RESET")), databaseAlreadyExisted)).rejects.toThrow();
  expect(await failed.settled()).toBe(true);
});

it("never authorises dropping a database whose name already existed", async () => {
  // Shaped like Prisma's error for CREATE DATABASE on a taken name (checked against PostgreSQL 16).
  const duplicate = Object.assign(new Error("database already exists"), { code: "P2010",
    meta: { driverAdapterError: { cause: { originalCode: "42P04", kind: "DatabaseAlreadyExists" } } } });
  expect(databaseAlreadyExisted(duplicate)).toBe(true);
  for (const other of [new Error("x"), { meta: { driverAdapterError: { cause: { originalCode: "57P01" } } } }, null, undefined])
    expect(databaseAlreadyExisted(other)).toBe(false);
  const taken = acquisition();
  await expect(taken.run(() => Promise.reject(duplicate), databaseAlreadyExisted)).rejects.toThrow();
  expect(await taken.settled()).toBe(false);
});

it("starts no child process once shutdown has begun", async () => {
  await stopAll();
  expect(isStopping()).toBe(true);
  await expect(runStep("LATE_STEP", process.execPath, ["-e", ""], process.cwd(), { PATH: process.env.PATH ?? "" })).rejects.toThrow(/^STAGING_STOPPING$/);
  await expect(startServer("late", process.execPath, ["-e", ""], process.cwd(), { PATH: process.env.PATH ?? "" }, "READY")).rejects.toThrow(/^STAGING_STOPPING$/);
  // One started directly (the agent) is killed and refused.
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", detached: true });
  expect(() => track(child)).toThrow(/^STAGING_STOPPING$/);
  await new Promise(resolve => child.once("exit", resolve));
  expect(child.signalCode).toBe("SIGKILL");
});

it("reports a cleanup that throws instead of letting it pass unnoticed", async () => {
  const { settles } = await import("../scripts/staging-consent/lifecycle.mjs");
  expect(await settles(async () => {})).toBe(true);
  expect(await settles(async () => { throw new Error("EACCES: cannot remove the run directory"); })).toBe(false);
});

it("chooses listener ports that are all distinct", async () => {
  const { freePorts } = await import("../scripts/staging-consent/processes.mjs");
  for (let round = 0; round < 5; round++) {
    const ports = await freePorts(8);
    expect(new Set(ports).size).toBe(8);
    for (const port of ports) expect(port).toBeGreaterThan(0);
  }
});

it("closes a browser whose launch was still pending when cleanup began, and starts none after", async () => {
  const { launchedBrowsers } = await import("../scripts/staging-consent/lifecycle.mjs");
  const closed: string[] = [];
  const browser = (name: string) => ({ close: async () => { closed.push(name); } });
  const browsers = launchedBrowsers<ReturnType<typeof browser>>();
  await browsers.start(async () => browser("first"));
  let finish!: () => void;
  // A signal arrives while the second launch is still starting Chromium.
  const second = browsers.start(() => new Promise(resolve => { finish = () => resolve(browser("second")); }));
  const cleanup = browsers.closeAll();
  let done = false;
  void cleanup.then(() => { done = true; });
  await new Promise(resolve => setTimeout(resolve, 20));
  expect(done, "cleanup finished before the pending launch").toBe(false);
  finish();
  await cleanup;
  await expect(second).rejects.toThrow(/^STAGING_STOPPING$/);
  expect(closed.sort()).toEqual(["first", "second"]);
  await expect(browsers.start(async () => browser("late"))).rejects.toThrow(/^STAGING_STOPPING$/);
  expect(closed).not.toContain("late");
});

it("reports a failed browser launch once, to its caller, with no unhandled rejection", async () => {
  const { launchedBrowsers } = await import("../scripts/staging-consent/lifecycle.mjs");
  const unhandled: unknown[] = [];
  const listener = (reason: unknown) => { unhandled.push(reason); };
  process.on("unhandledRejection", listener);
  try {
    const browsers = launchedBrowsers<{ close(): Promise<void> }>();
    await expect(browsers.start(() => Promise.reject(new Error("CHROMIUM_LAUNCH_FAILED")))).rejects.toThrow(/^CHROMIUM_LAUNCH_FAILED$/);
    // Let any stray rejection surface before checking.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(unhandled).toEqual([]);
    await browsers.closeAll();
  } finally { process.off("unhandledRejection", listener); }
});

it("attempts every browser close and reports the ones that failed", async () => {
  const { launchedBrowsers } = await import("../scripts/staging-consent/lifecycle.mjs");
  const closed: string[] = [];
  const browser = (name: string, fails = false) => ({ close: async () => { if (fails) throw new Error("PLAYWRIGHT_CLOSE_FAILED"); closed.push(name); } });
  const browsers = launchedBrowsers<ReturnType<typeof browser>>();
  await browsers.start(async () => browser("customer", true));
  await browsers.start(async () => browser("owner"));
  // One close fails: the other is still closed, and the failure is counted, not swallowed.
  expect(await browsers.closeAll()).toBe(1);
  expect(closed).toEqual(["owner"]);
  // A launch that finished during cleanup and could not be closed counts as well.
  const late = launchedBrowsers<ReturnType<typeof browser>>();
  let finish!: () => void;
  const pending = late.start(() => new Promise(resolve => { finish = () => resolve(browser("late", true)); }));
  const cleanup = late.closeAll();
  finish();
  await expect(pending).rejects.toThrow(/^STAGING_STOPPING$/);
  expect(await cleanup).toBe(1);
});
