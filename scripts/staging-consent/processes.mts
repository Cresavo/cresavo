// Child process helpers for the staging runner. Child output is never printed. All of it
// is kept in memory, per stream, until every process has exited, so the runner can scan
// the complete output for secrets, including ones registered after they were printed.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { Readable } from "node:stream";
import { containsSecret } from "./sanitize.mjs";
import { refuseEnvFiles } from "./preflight.mjs";

// Each child with a promise that settles on `close`: after `exit`, stdout and stderr can still
// deliver data, so shutdown waits for `close` before the final scan.
const children = new Map<ChildProcess, Promise<void>>();
// Set by the first stopAll: from then on no new child may start, since a detached child started
// after shutdown would outlive the runner.
let stopping = false;
export const isStopping = () => stopping;

// Children get a closed environment built by the runner, never this process's own, so nothing
// inherited reaches them. These may not be in it either: they would make a child log or load
// what the runner refused for itself (TLS keys, debug output, extra code).
const CHILD_ENV_REFUSED = ["NODE_OPTIONS", "NODE_DEBUG", "DEBUG", "DEBUG_FILE", "SSLKEYLOGFILE", "NODE_V8_COVERAGE"];
export function assertChildEnv(env: Record<string, string | undefined>) {
  for (const name of CHILD_ENV_REFUSED) if (env[name] !== undefined) throw new Error("STAGING_CHILD_ENV_REFUSED");
  // Connection defaults (PGPORT, PGUSER, ...): a child connects with DATABASE_URL and nothing else.
  if (Object.keys(env).some(name => /^PG[A-Z_]+$/.test(name) && name !== "PGDATA")) throw new Error("STAGING_CHILD_ENV_REFUSED");
  return env;
}

// Directories a child may read env files from (the repository, the gateway checkout, the build copy
// and the gateway export). Checked again right before every step and server: preflight alone
// would miss a file created during the run, which Prisma or Next.js would then load.
const protectedDirs = new Set<string>();
export function protectFromEnvFiles(...dirs: string[]) { for (const dir of dirs) protectedDirs.add(dir); }
export function refuseEnvFilesNow() { refuseEnvFiles([...protectedDirs]); }

export function track<T extends ChildProcess>(child: T): T {
  if (stopping) { signalGroup(child, "SIGKILL"); throw new Error("STAGING_STOPPING"); }
  children.set(child, new Promise<void>(resolve => {
    // `close` means the leader's own streams closed, not that its group is empty: a worker it
    // started with its own stdio would outlive it unseen. What is left of the group is stopped.
    child.once("close", () => { signalGroup(child, "SIGKILL"); children.delete(child); resolve(); });
    child.once("error", () => { if (child.pid === undefined) { children.delete(child); resolve(); } });
  }));
  return child;
}
const captured: Record<string, string> = {};
// Past this, output is no longer complete and cannot be declared secret-free.
const CAPTURE_LIMIT = 64 * 1024 * 1024;
let total = 0, overflowed = false;

/**
 * `count` distinct loopback ports, held open together while they are chosen so no two can be the
 * same. Each is then closed for its owner to bind; a bind that still fails rejects that start.
 */
export async function freePorts(count: number) {
  const servers = Array.from({ length: count }, () => createServer());
  try {
    await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => {
      server.once("error", () => reject(new Error("FREE_PORT_UNAVAILABLE")));
      server.listen(0, "127.0.0.1", resolve);
    })));
    return servers.map(server => (server.address() as { port: number }).port);
  } finally {
    await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  }
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
    if (stopping) return reject(new Error("STAGING_STOPPING"));
    try { assertChildEnv(env); refuseEnvFilesNow(); } catch (error) { return reject(error); }
    const child = track(spawn(command, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"], detached: true }));
    captureStream(`${code}:stdout`, child.stdout);
    captureStream(`${code}:stderr`, child.stderr);
    // The deadline settles the step itself: waiting for `close` could last forever if a worker
    // outside the group still holds an inherited pipe. The child stays tracked, so the runner's
    // bounded shutdown still drains or releases its streams.
    let settled = false;
    const settle = (ok: boolean) => { if (settled) return; settled = true; clearTimeout(timer); if (ok) resolve(); else reject(new Error(code)); };
    const timer = setTimeout(() => { signalGroup(child, "SIGKILL"); settle(false); }, timeoutMs);
    child.on("error", () => settle(false));
    child.on("close", status => settle(status === 0));
  });
}

/** Starts a long-running server and resolves when a stdout line starts with the ready marker. */
export function startServer(name: string, command: string, args: string[], cwd: string, env: Record<string, string>, ready: string) {
  return new Promise<ChildProcess>((resolve, reject) => {
    if (stopping) return reject(new Error("STAGING_STOPPING"));
    try { assertChildEnv(env); refuseEnvFilesNow(); } catch (error) { return reject(error); }
    const child = track(spawn(command, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"], detached: true }));
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
/**
 * Signals the child's whole process group. Every child is spawned `detached`, so it leads its own
 * group and the signal also reaches anything it started (Next.js workers, npm's children).
 */
function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (child.pid === undefined) return;
  try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already gone */ } }
}

/**
 * Stops every tracked child and its process group, and resolves once all have closed their
 * streams. Past `closeTimeoutMs` (a pipe held open by something outside the group) the output is
 * marked incomplete, so the final scan fails, and this side of the pipes is closed, so nothing
 * left behind can keep the runner from exiting.
 */
/** `final: false` (tests only) stops the current children without refusing later ones. */
export async function stopAll({ killAfterMs = 5000, closeTimeoutMs = 15_000, final = true } = {}) {
  if (final) stopping = true;
  await Promise.all([...children].map(async ([child, closed]) => {
    signalGroup(child, "SIGTERM");
    const timer = setTimeout(() => signalGroup(child, "SIGKILL"), killAfterMs);
    let wait: NodeJS.Timeout | undefined;
    const settled = await Promise.race([closed.then(() => true), new Promise<boolean>(r => { wait = setTimeout(() => r(false), closeTimeoutMs); })]);
    clearTimeout(timer); clearTimeout(wait);
    // Whatever is left of the group (a process that closed its streams but ignored SIGTERM).
    signalGroup(child, "SIGKILL");
    if (!settled) {
      overflowed = true;
      for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.destroy();
      children.delete(child);
    }
  }));
}
