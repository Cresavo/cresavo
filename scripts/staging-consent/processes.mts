// Child process helpers for the staging runner. Child output is never printed. All of it
// is kept in memory, per stream, until every process has exited, so the runner can scan
// the complete output for secrets, including ones registered after they were printed.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { Readable } from "node:stream";
import { containsSecret } from "./sanitize.mjs";

// Each child with a promise that settles on `close`: after `exit`, stdout and stderr can still
// deliver data, so shutdown waits for `close` before the final scan.
const children = new Map<ChildProcess, Promise<void>>();
export function track<T extends ChildProcess>(child: T): T {
  children.set(child, new Promise<void>(resolve => {
    child.once("close", () => { children.delete(child); resolve(); });
    child.once("error", () => { if (child.pid === undefined) { children.delete(child); resolve(); } });
  }));
  return child;
}
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

/** Takes `size` from the output budget shared by every captured stream; false (and incomplete output) past it. */
export function reserveCapture(size: number) {
  if (overflowed || total + size > CAPTURE_LIMIT) { overflowed = true; return false; }
  total += size;
  return true;
}

/** The budget counts UTF-8 bytes, not UTF-16 code units: "å" is two bytes. */
export const outputBytes = (chunk: string | Buffer) => typeof chunk === "string" ? Buffer.byteLength(chunk, "utf8") : chunk.length;

export function capture(name: string, chunk: string) {
  if (reserveCapture(outputBytes(chunk))) captured[name] = (captured[name] ?? "") + chunk;
}

/**
 * Charges a stream that is kept elsewhere (the agent's line protocol) to the same budget. It must
 * be attached before any other consumer: past the budget the stream is destroyed, so nothing
 * further reaches a line buffer, and `onOverflow` runs once.
 */
export function guardStream(stream: Readable, onOverflow: () => void, reserve: (size: number) => boolean = reserveCapture) {
  let tripped = false;
  stream.on("data", (chunk: string | Buffer) => {
    if (tripped || reserve(outputBytes(chunk))) return;
    tripped = true;
    stream.destroy();
    onOverflow();
  });
}

/** Captures a child stream as UTF-8 text, so a chunk boundary never splits a character. */
export function captureStream(name: string, stream: Readable | null) {
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk: string) => capture(name, chunk));
}

/** Names of the streams that contain a registered secret, or ["CAPTURE_INCOMPLETE"] when output was dropped or a stream never closed. */
export function leakedStreams() {
  if (overflowed) return ["CAPTURE_INCOMPLETE"];
  return Object.entries(captured).filter(([, output]) => containsSecret(output)).map(([name]) => name);
}

/** Runs a command to completion with a closed environment. Rejects with a static code only. */
export function runStep(code: string, command: string, args: string[], cwd: string, env: Record<string, string>, timeoutMs = 600_000) {
  return new Promise<void>((resolve, reject) => {
    const child = track(spawn(command, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] }));
    captureStream(`${code}:stdout`, child.stdout);
    captureStream(`${code}:stderr`, child.stderr);
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", () => { clearTimeout(timer); reject(new Error(code)); });
    child.on("close", status => { clearTimeout(timer); if (status === 0) resolve(); else reject(new Error(code)); });
  });
}

/** Starts a long-running server and resolves when a stdout line starts with the ready marker. */
export function startServer(name: string, command: string, args: string[], cwd: string, env: Record<string, string>, ready: string) {
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = track(spawn(command, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] }));
    const timer = setTimeout(() => reject(new Error(`${name}_READY_TIMEOUT`)), 90_000);
    let buffer = "";
    captureStream(`${name}:stdout`, child.stdout);
    captureStream(`${name}:stderr`, child.stderr);
    child.stdout.on("data", (chunk: string) => {
      buffer = (buffer + chunk).slice(-8192);
      if (buffer.split("\n").some(line => line.startsWith(ready))) { clearTimeout(timer); resolve(child); }
    });
    child.on("error", () => { clearTimeout(timer); reject(new Error(`${name}_START_FAILED`)); });
    child.on("exit", () => { clearTimeout(timer); reject(new Error(`${name}_EXITED`)); });
  });
}

/** Stops every tracked child and resolves once all of them have closed their streams. */
export async function stopAll() {
  await Promise.all([...children].map(async ([child, closed]) => {
    const running = child.exitCode === null && child.signalCode === null;
    const timer = running ? setTimeout(() => child.kill("SIGKILL"), 5000) : undefined;
    if (running) child.kill("SIGTERM");
    // A stream held open past this (for example by a surviving grandchild) leaves the output
    // incomplete: the final scan then fails instead of passing on part of it.
    let wait: NodeJS.Timeout | undefined;
    const settled = await Promise.race([closed.then(() => true), new Promise<boolean>(r => { wait = setTimeout(() => r(false), 15_000); })]);
    clearTimeout(timer); clearTimeout(wait);
    if (!settled) overflowed = true;
  }));
}
