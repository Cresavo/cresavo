// Child process helpers for the staging runner. Child output is never printed. All of it
// is kept in memory, per stream, until every process has exited, so the runner can scan
// the complete output for secrets, including ones registered after they were printed.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { Readable } from "node:stream";
import { containsSecret } from "./sanitize.mjs";

const children = new Set<ChildProcess>();
const captured: Record<string, string> = {};
// Past this, output is no longer complete and cannot be declared secret-free.
const CAPTURE_LIMIT = 64 * 1024 * 1024;
let total = 0, overflowed = false;

export async function freePort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

export function capture(name: string, chunk: string) {
  if (overflowed || total + chunk.length > CAPTURE_LIMIT) { overflowed = true; return; }
  total += chunk.length;
  captured[name] = (captured[name] ?? "") + chunk;
}

/** Captures a child stream as UTF-8 text, so a chunk boundary never splits a character. */
export function captureStream(name: string, stream: Readable | null) {
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk: string) => capture(name, chunk));
}

/** Names of the streams that contain a registered secret, or ["CAPTURE_INCOMPLETE"] when output was dropped. */
export function leakedStreams() {
  if (overflowed) return ["CAPTURE_INCOMPLETE"];
  return Object.entries(captured).filter(([, output]) => containsSecret(output)).map(([name]) => name);
}

/** Runs a command to completion with a closed environment. Rejects with a static code only. */
export function runStep(code: string, command: string, args: string[], cwd: string, env: Record<string, string>, timeoutMs = 600_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child);
    captureStream(`${code}:stdout`, child.stdout);
    captureStream(`${code}:stderr`, child.stderr);
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", () => { clearTimeout(timer); reject(new Error(code)); });
    child.on("exit", status => { children.delete(child); clearTimeout(timer); if (status === 0) resolve(); else reject(new Error(code)); });
  });
}

/** Starts a long-running server and resolves when a stdout line starts with the ready marker. */
export function startServer(name: string, command: string, args: string[], cwd: string, env: Record<string, string>, ready: string) {
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child);
    const timer = setTimeout(() => reject(new Error(`${name}_READY_TIMEOUT`)), 90_000);
    let buffer = "";
    captureStream(`${name}:stdout`, child.stdout);
    captureStream(`${name}:stderr`, child.stderr);
    child.stdout.on("data", (chunk: string) => {
      buffer = (buffer + chunk).slice(-8192);
      if (buffer.split("\n").some(line => line.startsWith(ready))) { clearTimeout(timer); resolve(child); }
    });
    child.on("error", () => { clearTimeout(timer); reject(new Error(`${name}_START_FAILED`)); });
    child.on("exit", () => { children.delete(child); clearTimeout(timer); reject(new Error(`${name}_EXITED`)); });
  });
}

export async function stopAll() {
  await Promise.all([...children].map(child => new Promise<void>(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  })));
}
