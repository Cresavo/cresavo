// Shutdown of the staging runner's child processes. Its own file: an expired deadline marks the
// runner's captured output incomplete for the rest of the process.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { captureStream, leakedStreams, stopAll, track } from "../scripts/staging-consent/processes.mjs";

const firstLine = (stream: NodeJS.ReadableStream) => new Promise<string>(resolve => {
  let text = "";
  stream.on("data", (chunk: string) => { text += chunk; if (text.includes("\n")) resolve(text.split("\n")[0]); });
});
// Running, not just present: a killed process whose new parent has not reaped it yet is a zombie.
function alive(pid: number) {
  try { process.kill(pid, 0); } catch { return false; }
  try { return !/^\d+ \(.*\) Z/.test(readFileSync(`/proc/${pid}/stat`, "utf8")); } catch { return false; }
}

it("terminates the whole process group, including a grandchild that ignores SIGTERM", async () => {
  // The grandchild ignores SIGTERM and keeps the inherited stdout open.
  const grandchild = `process.on("SIGTERM", () => {}); console.log(process.pid); setInterval(() => {}, 1000);`;
  const script = `const { spawn } = require("node:child_process");
    spawn(process.execPath, ["-e", ${JSON.stringify(grandchild)}], { stdio: ["ignore", "inherit", "ignore"] });
    process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);`;
  const child = track(spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"], detached: true }));
  child.stdout!.setEncoding("utf8");
  captureStream("group:stdout", child.stdout);
  const pid = Number(await firstLine(child.stdout!));
  expect(alive(pid)).toBe(true);
  const started = Date.now();
  await stopAll({ killAfterMs: 300, closeTimeoutMs: 10_000 });
  expect(Date.now() - started).toBeLessThan(5000);
  expect(alive(pid)).toBe(false);
  expect(leakedStreams()).toEqual([]);
}, 20_000);

it("releases this side of a pipe still held open by a process outside the group at the deadline", async () => {
  // The grandchild leads its own group, so the child's group signal cannot reach it.
  const grandchild = `process.on("SIGTERM", () => {}); console.log(process.pid); setInterval(() => {}, 1000);`;
  const script = `const { spawn } = require("node:child_process");
    spawn(process.execPath, ["-e", ${JSON.stringify(grandchild)}], { stdio: ["ignore", "inherit", "ignore"], detached: true }).unref();
    process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);`;
  const child = track(spawn(process.execPath, ["-e", script], { stdio: ["ignore", "pipe", "pipe"], detached: true }));
  child.stdout!.setEncoding("utf8");
  captureStream("held:stdout", child.stdout);
  const pid = Number(await firstLine(child.stdout!));
  try {
    const started = Date.now();
    await stopAll({ killAfterMs: 200, closeTimeoutMs: 800 });
    expect(Date.now() - started).toBeLessThan(4000);
    // Not complete, so the scan fails instead of passing; and nothing of ours keeps the pipe alive.
    expect(leakedStreams()).toEqual(["CAPTURE_INCOMPLETE"]);
    expect(child.stdout!.destroyed).toBe(true);
    expect(child.stderr!.destroyed).toBe(true);
    // A second stop has nothing left to wait for.
    const again = Date.now();
    await stopAll({ killAfterMs: 200, closeTimeoutMs: 800 });
    expect(Date.now() - again).toBeLessThan(200);
  } finally { try { process.kill(pid, "SIGKILL"); } catch { /* gone */ } }
}, 20_000);
