// The staging runner's preflight, in a child process. The runner runs from a clean fixture (a
// throwaway git checkout of its own scripts) so the developer's checkout, a local .env included,
// cannot change what is asserted.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { assertTestDatabase } from "../scripts/test-db-guard.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));

it("validates the derived database URL and its password before anything is acquired", async () => {
  const { stagingDatabase } = await import("../scripts/staging-consent/preflight.mjs");
  const ok = stagingDatabase(new URL("postgresql://booking:p%40ss@127.0.0.1:5432/postgres"), "abc123", assertTestDatabase);
  expect(ok.dbName).toBe("staging_consent_abc123_test");
  expect(ok.databaseUrl.pathname).toBe("/staging_consent_abc123_test");
  expect(ok.password).toBe("p@ss");
  // A query parameter that would send the connection elsewhere, and a malformed password.
  expect(() => stagingDatabase(new URL("postgresql://booking:fictional@127.0.0.1:5432/postgres?host=/tmp/elsewhere"), "abc123", assertTestDatabase))
    .toThrow(/^STAGING_DATABASE_REFUSED$/);
  expect(() => stagingDatabase(new URL("postgresql://booking:%E0%A4%A@127.0.0.1:5432/postgres"), "abc123", assertTestDatabase))
    .toThrow(/^STAGING_PG_ADMIN_URL_INVALID$/);
});

it("gives children a closed environment: nothing inherited, and no option or debug variables", async () => {
  const { runStep } = await import("../scripts/staging-consent/processes.mjs");
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-"))), out = join(dir, "env.json");
  vi.stubEnv("NODE_OPTIONS", "--max-old-space-size=128"); vi.stubEnv("SSLKEYLOGFILE", join(dir, "keys.log"));
  try {
    // The runner's own NODE_OPTIONS never reaches a child.
    await runStep("ENV_PROBE", process.execPath, ["-e", `require("node:fs").writeFileSync(${JSON.stringify(out)}, JSON.stringify(Object.keys(process.env)))`],
      dir, { PATH: process.env.PATH ?? "" });
    const keys = JSON.parse(readFileSync(out, "utf8")) as string[];
    expect(keys.includes("NODE_OPTIONS") || keys.includes("SSLKEYLOGFILE"), "an inherited option reached the child").toBe(false);
    // And a child environment that names one is refused before anything starts.
    for (const name of ["NODE_OPTIONS", "SSLKEYLOGFILE", "NODE_DEBUG", "DEBUG"])
      await expect(runStep("ENV_REFUSED", process.execPath, ["-e", ""], dir, { PATH: process.env.PATH ?? "", [name]: "x" })).rejects.toThrow(/^STAGING_CHILD_ENV_REFUSED$/);
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
});

/** A throwaway git checkout holding the runner's scripts, the package manifest and the dependencies. */
function salonFixture(root: string, withEnvFile = false) {
  const salon = join(root, "salon");
  mkdirSync(salon, { recursive: true });
  cpSync(join(repo, "scripts"), join(salon, "scripts"), { recursive: true });
  cpSync(join(repo, "package.json"), join(salon, "package.json"));
  symlinkSync(join(repo, "node_modules"), join(salon, "node_modules"), "dir");
  if (withEnvFile) writeFileSync(join(salon, ".env"), "# fictional, empty\n");
  const git = (...args: string[]) => execFileSync("git", ["-C", salon, "-c", "user.name=Fictional", "-c", "user.email=fictional@example.test", ...args], { encoding: "utf8" });
  git("init", "-q"); writeFileSync(join(salon, ".gitignore"), "node_modules\n.env\n"); git("add", "-A"); git("commit", "-q", "-m", "fixture");
  return salon;
}

function runPreflight(root: string, salon: string, extra: Record<string, string> = {}, preload: string[] = []) {
  const checkout = join(root, "gateway"), runTmp = join(root, "tmp");
  mkdirSync(checkout, { recursive: true }); mkdirSync(runTmp, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", ["-C", checkout, "-c", "user.name=Fictional", "-c", "user.email=fictional@example.test", ...args], { encoding: "utf8" }).trim();
  git("init", "-q"); writeFileSync(join(checkout, "README"), "fictional\n"); git("add", "README"); git("commit", "-q", "-m", "fictional");
  const result = spawnSync(process.execPath, [...preload, "--import", "tsx", join(salon, "scripts/staging-consent/run.mts")], {
    cwd: salon, encoding: "utf8", timeout: 60_000,
    env: { PATH: process.env.PATH ?? "", HOME: root, TMPDIR: runTmp, GATEWAY_CHECKOUT: checkout, STAGING_GATEWAY_REVISION: git("rev-parse", "HEAD"),
      STAGING_PG_ADMIN_URL: "postgresql://booking:fictional-pass@127.0.0.1:5432/postgres?host=/tmp/elsewhere", ...extra } as unknown as NodeJS.ProcessEnv,
  });
  return { output: `${result.stdout}${result.stderr}`, status: result.status, leftovers: readdirSync(runTmp).filter(name => name.startsWith("cresavo-staging-")) };
}

describe.skipIf(process.platform === "win32")("runner preflight in a child process", () => {
  it("leaves no run directory behind when the database configuration is refused", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      const { output, status, leftovers } = runPreflight(root, salonFixture(root));
      expect(status).not.toBe(0);
      expect(output.includes("STAGING_DATABASE_REFUSED"), "the refusal code is reported").toBe(true);
      expect(output.includes("fictional-pass"), "the password is printed").toBe(false);
      expect(leftovers).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 90_000);

  it("refuses diagnostics before Playwright loads: an existing DEBUG_FILE is left byte-identical", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      // Playwright's debug logger opens DEBUG_FILE for writing as it loads.
      const sentinel = join(root, "operator-debug.log"), content = "operator's own log, must stay as it is\n";
      writeFileSync(sentinel, content);
      const before = statSync(sentinel);
      // Playwright opens the file asynchronously, so an early exit can hide the write: the probe
      // records at exit whether any Playwright module was loaded at all.
      const probe = join(root, "probe.mjs"), loaded = join(root, "loaded.json");
      writeFileSync(probe, `import { createRequire } from "node:module"; import { writeFileSync } from "node:fs";
        const cache = createRequire(import.meta.url).cache;
        process.on("exit", () => writeFileSync(${JSON.stringify(loaded)}, JSON.stringify(Object.keys(cache).some(key => /[\\\\/]playwright(-core)?[\\\\/]/.test(key)))));`);
      const { output, status } = runPreflight(root, salonFixture(root), { DEBUG_FILE: sentinel }, ["--import", probe]);
      expect(readFileSync(loaded, "utf8"), "Playwright was loaded before the diagnostics check").toBe("false");
      expect(status).not.toBe(0);
      expect(output.includes("STAGING_DIAGNOSTICS_REFUSED"), "the refusal code is reported").toBe(true);
      expect(readFileSync(sentinel, "utf8")).toBe(content);
      expect(statSync(sentinel).mtimeMs).toBe(before.mtimeMs);
      expect(readdirSync(root).filter(name => name.startsWith("cresavo-staging-"))).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 90_000);

  it("runs from its own fixture: a .env in a checkout is refused there, and only there", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      // The fixture with a .env gives the env-file refusal; the clean one (above) the database refusal.
      const { output } = runPreflight(root, salonFixture(root, true));
      expect(output.includes("STAGING_ENV_FILE_REFUSED"), "the fixture's .env decides, not the developer's").toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 90_000);
});
