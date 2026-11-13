import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";

// User-local paths only, never credentials in the plugin or its archive.
try {
  const profile = JSON.parse(
    readFileSync(join(homedir(), ".booking-lab", "time-card.json"), "utf8"),
  );
  if (!isAbsolute(profile.runtime) || !isAbsolute(profile.envFile))
    throw new Error();
  const settings = parseEnv(readFileSync(profile.envFile, "utf8"));
  if (
    settings.BOOKING_TIME_CARD_DEMO !== "1" ||
    settings.NODE_ENV === "production" ||
    settings.VERCEL_ENV
  )
    throw new Error();
  const env = {
    DATABASE_URL: settings.DATABASE_URL,
    BOOKING_TIME_CARD_DEMO: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    CHECKPOINT_DISABLE: "1",
  };
  for (const key of [
    "PATH",
    "Path",
    "SystemRoot",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
  ])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(join(profile.runtime, "node_modules/tsx/dist/loader.mjs"))
        .href,
      join(profile.runtime, "src/mcp/time-card/server.ts"),
    ],
    { cwd: profile.runtime, env, stdio: "inherit", windowsHide: true },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("error", () => {
    console.error("TIME_CARD_RUNTIME_UNAVAILABLE");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error("TIME_CARD_LOCAL_PROFILE_REQUIRED");
  process.exitCode = 1;
}
