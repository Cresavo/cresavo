import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { assertTestDatabase } from "../../scripts/test-db-guard.mjs";

export const base = "http://127.0.0.1:3740";

export function serverEnvironment(env: Record<string, string | undefined> = process.env) {
  const database = env.DATABASE_URL ?? "";
  assertTestDatabase(database);
  if (env.PAIRING_DATABASE_URL && env.PAIRING_DATABASE_URL !== database)
    throw new Error("TEST_DATABASE_REFUSED: pairing and runner databases must match");
  return {
    DATABASE_URL: database, PAIRING_DATABASE_URL: database, PAIRING_ORIGIN: base, PORT: "3740",
    PUBLIC_READONLY: "1", ASSISTANT_PAIRING: "1", BOOKING_RUNTIME: "local", TRUST_PROXY_IP: "0",
    SESSION_SECRET: randomBytes(32).toString("hex"), NEXT_TELEMETRY_DISABLED: "1", BOOKING_PUBLIC_ORIGIN: base,
  };
}

export async function startPairingServer() {
  const env = serverEnvironment();
  const child = spawn(process.execPath, ["tests/pairing/serve.mjs", "--dev", "--hostname", "127.0.0.1"], {
    env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "inherit"],
  });
  const exited = once(child, "exit");
  async function stop() {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    try { await exited; } finally { clearTimeout(timeout); }
  }
  // Only this child's listen callback proves that it owns the port.
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Pairing server startup timed out")), 90000);
      let output = "";
      child.stdout.on("data", chunk => {
        output = (output + chunk).slice(-4096);
        if (output.includes("BOOKING_SERVER_READY")) { clearTimeout(timeout); resolve(); }
      });
      void exited.then(() => { clearTimeout(timeout); reject(new Error("Dedicated pairing server exited before listening")); },
        err => { clearTimeout(timeout); reject(err); });
    });
    return stop;
  } catch (err) { await stop(); throw err; }
}
