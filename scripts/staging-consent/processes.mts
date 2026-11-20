// Child process helpers for the staging runner. Child output is never printed: it is
// kept in memory, bounded, so the runner can scan it for leaked secrets at the end.
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

const children = new Set<ChildProcess>();
export const captured: Record<string, string> = {};

export async function freePort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

function capture(name: string, chunk: unknown) {
  captured[name] = ((captured[name] ?? "") + String(chunk)).slice(-200_000);
}

/** Runs a command to completion with a closed environment. Rejects with a static code only. */
export function runStep(code: string, command: string, args: string[], cwd: string, env: Record<string, string>, timeoutMs = 600_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: env as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child);
    child.stdout.on("data", chunk => capture(code, chunk));
    child.stderr.on("data", chunk => capture(code, chunk));
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
    child.stdout.on("data", chunk => {
      capture(name, chunk);
      buffer = (buffer + String(chunk)).slice(-8192);
      if (buffer.split("\n").some(line => line.startsWith(ready))) { clearTimeout(timer); resolve(child); }
    });
    child.stderr.on("data", chunk => capture(name, chunk));
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
