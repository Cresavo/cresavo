// Cancellation of the staging runner while it acquires resources. Its own file: the first final
// stop refuses every later child process for the rest of the process.
import { spawn } from "node:child_process";
import { expect, it } from "vitest";
import { acquisition } from "../scripts/staging-consent/lifecycle.mjs";
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
  // A failed attempt is still an attempt: the release (DROP ... IF EXISTS) runs and is harmless.
  const failed = acquisition();
  await expect(failed.run(() => Promise.reject(new Error("CREATE_FAILED")))).rejects.toThrow();
  expect(await failed.settled()).toBe(true);
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
