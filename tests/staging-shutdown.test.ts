// Shutdown of the staging runner's child processes. Its own file: an expired deadline marks the
// runner's captured output incomplete for the rest of the process. POSIX process groups only.
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureStream, leakedStreams, runStep, stopAll, track } from "../scripts/staging-consent/processes.mjs";

const firstLine = (stream: NodeJS.ReadableStream) => new Promise<string>(resolve => {
  let text = "";
  stream.on("data", (chunk: string) => { text += chunk; if (text.includes("\n")) resolve(text.split("\n")[0]); });
});
// Running, not just present: `ps` works on Linux and macOS, and a killed process whose new parent
// has not reaped it yet shows as a zombie (Z).
function alive(pid: number) {
  try { process.kill(pid, 0); } catch { return false; }
  try { const state = execFileSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).trim(); return state !== "" && !state.startsWith("Z"); }
  catch { return false; }
}
const kill = (pid: number | undefined, group = false) => { if (pid) try { process.kill(group ? -pid : pid, "SIGKILL"); } catch { /* gone */ } };
// Reports its own PID on stdout and, when the test gives it one, in a test-owned file: cleanup
// then kills exactly this process, never one with a similar command line.
const holder = `process.on("SIGTERM", () => {}); console.log(process.pid);
  if (process.env.HOLDER_PID_FILE) require("node:fs").writeFileSync(process.env.HOLDER_PID_FILE, String(process.pid));
  setInterval(() => {}, 1000);`;
const parent = (detachGrandchild: boolean) => `const { spawn } = require("node:child_process");
  spawn(process.execPath, ["-e", ${JSON.stringify(holder)}], { stdio: ["ignore", "inherit", "ignore"], detached: ${detachGrandchild} })${detachGrandchild ? ".unref()" : ""};
  process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);`;

describe.skipIf(process.platform === "win32")("staging runner child shutdown", () => {
  it("terminates the whole process group, including a grandchild that ignores SIGTERM", async () => {
    const child = track(spawn(process.execPath, ["-e", parent(false)], { stdio: ["ignore", "pipe", "pipe"], detached: true }));
    let pid: number | undefined;
    try {
      child.stdout!.setEncoding("utf8");
      captureStream("group:stdout", child.stdout);
      pid = Number(await firstLine(child.stdout!));
      expect(alive(pid)).toBe(true);
      const started = Date.now();
      await stopAll({ killAfterMs: 300, closeTimeoutMs: 10_000, final: false });
      expect(Date.now() - started).toBeLessThan(5000);
      expect(alive(pid)).toBe(false);
      expect(leakedStreams()).toEqual([]);
    } finally { kill(pid); kill(child.pid, true); }
  }, 20_000);

  it("settles a timed-out step although a worker outside its group still holds the pipe", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cresavo-shutdown-test-")), pidFile = join(dir, "holder.pid");
    const step = runStep("STEP_TIMEOUT", process.execPath, ["-e", `${parent(true)}`], process.cwd(), { PATH: process.env.PATH ?? "", HOLDER_PID_FILE: pidFile }, 600);
    try {
      const started = Date.now();
      await expect(step).rejects.toThrow(/^STEP_TIMEOUT$/);
      expect(Date.now() - started).toBeLessThan(3000);
    } finally {
      // Only the helper this test started, by the PID it wrote to this test's own file.
      try { kill(Number(readFileSync(pidFile, "utf8"))); } catch { /* not written */ }
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);

  it("releases this side of a pipe still held open by a process outside the group at the deadline", async () => {
    const child = track(spawn(process.execPath, ["-e", parent(true)], { stdio: ["ignore", "pipe", "pipe"], detached: true }));
    let pid: number | undefined;
    try {
      child.stdout!.setEncoding("utf8");
      captureStream("held:stdout", child.stdout);
      pid = Number(await firstLine(child.stdout!));
      const started = Date.now();
      await stopAll({ killAfterMs: 200, closeTimeoutMs: 800, final: false });
      expect(Date.now() - started).toBeLessThan(4000);
      // Not complete, so the scan fails instead of passing; and nothing of ours keeps the pipe alive.
      expect(leakedStreams()).toEqual(["CAPTURE_INCOMPLETE"]);
      expect(child.stdout!.destroyed).toBe(true);
      expect(child.stderr!.destroyed).toBe(true);
      // A second stop has nothing left to wait for.
      const again = Date.now();
      await stopAll({ killAfterMs: 200, closeTimeoutMs: 800, final: false });
      expect(Date.now() - again).toBeLessThan(200);
    } finally { kill(pid); kill(child.pid, true); }
  }, 20_000);
});
