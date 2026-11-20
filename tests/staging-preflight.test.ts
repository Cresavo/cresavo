// The staging runner's preflight, in a child process. The runner runs from a clean fixture (a
// throwaway git checkout of its own scripts) so the developer's checkout, a local .env included,
// cannot change what is asserted.
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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
  vi.stubEnv("NODE_OPTIONS", "--max-old-space-size=128"); vi.stubEnv("SSLKEYLOGFILE", join(dir, "keys.log")); vi.stubEnv("PGPORT", "5433");
  try {
    // The runner's own NODE_OPTIONS never reaches a child.
    await runStep("ENV_PROBE", process.execPath, ["-e", `require("node:fs").writeFileSync(${JSON.stringify(out)}, JSON.stringify(Object.keys(process.env)))`],
      dir, { PATH: process.env.PATH ?? "" });
    const keys = JSON.parse(readFileSync(out, "utf8")) as string[];
    expect(keys.includes("NODE_OPTIONS") || keys.includes("SSLKEYLOGFILE") || keys.includes("PGPORT"), "an inherited option reached the child").toBe(false);
    // And a child environment that names one is refused before anything starts.
    for (const name of ["NODE_OPTIONS", "SSLKEYLOGFILE", "NODE_DEBUG", "DEBUG", "PGPORT", "PGPASSWORD", "PGSERVICE", "PGSSLMODE"])
      await expect(runStep("ENV_REFUSED", process.execPath, ["-e", ""], dir, { PATH: process.env.PATH ?? "", [name]: "x" })).rejects.toThrow(/^STAGING_CHILD_ENV_REFUSED$/);
  } finally { vi.unstubAllEnvs(); rmSync(dir, { recursive: true, force: true }); }
});

it("stops the next step before it starts when an env file appears during the run", async () => {
  const { protectFromEnvFiles, runStep, startServer } = await import("../scripts/staging-consent/processes.mjs");
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
  const ran = (name: string) => join(dir, `${name}.ran`);
  const step = (name: string) => ["-e", `require("node:fs").writeFileSync(${JSON.stringify(ran(name))}, "x")`];
  try {
    protectFromEnvFiles(dir);
    await runStep("MIGRATE", process.execPath, step("migrate"), dir, { PATH: process.env.PATH ?? "" });
    expect(existsSync(ran("migrate"))).toBe(true);
    // Created after preflight: Prisma (prisma.config.ts) or Next.js would load it.
    writeFileSync(join(dir, ".env.local"), "# fictional, empty\n");
    await expect(runStep("SEED", process.execPath, step("seed"), dir, { PATH: process.env.PATH ?? "" })).rejects.toThrow(/^STAGING_ENV_FILE_REFUSED$/);
    await expect(startServer("salon", process.execPath, step("server"), dir, { PATH: process.env.PATH ?? "" }, "READY")).rejects.toThrow(/^STAGING_ENV_FILE_REFUSED$/);
    expect(existsSync(ran("seed")) || existsSync(ran("server")), "a step started").toBe(false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/** A throwaway git checkout holding the runner's scripts, the package manifest and the dependencies. */
function salonFixture(root: string, withEnvFile = false, firstImport?: string) {
  const salon = join(root, "salon");
  mkdirSync(salon, { recursive: true });
  cpSync(join(repo, "scripts"), join(salon, "scripts"), { recursive: true });
  cpSync(join(repo, "package.json"), join(salon, "package.json"));
  symlinkSync(join(repo, "node_modules"), join(salon, "node_modules"), "dir");
  if (withEnvFile) writeFileSync(join(salon, ".env"), "# fictional, empty\n");
  // Test-only code evaluated before everything else the runner imports, in this copy only (the
  // runner refuses any preload but tsx, so it cannot come from the command line).
  if (firstImport) {
    const runner = join(salon, "scripts/staging-consent/run.mts");
    writeFileSync(join(salon, "scripts/staging-consent/fixture-probe.mjs"), firstImport);
    writeFileSync(runner, `import "./fixture-probe.mjs";\n${readFileSync(runner, "utf8")}`);
  }
  const git = (...args: string[]) => execFileSync("git", ["-C", salon, "-c", "user.name=Fictional", "-c", "user.email=fictional@example.test", ...args], { encoding: "utf8" });
  git("init", "-q"); writeFileSync(join(salon, ".gitignore"), "node_modules\n.env\n"); git("add", "-A"); git("commit", "-q", "-m", "fixture");
  return salon;
}

function runPreflight(root: string, salon: string, extra: Record<string, string> = {}) {
  const checkout = join(root, "gateway"), runTmp = join(root, "tmp");
  if (existsSync(checkout)) rmSync(checkout, { recursive: true, force: true });
  mkdirSync(checkout, { recursive: true }); mkdirSync(runTmp, { recursive: true });
  const git = (...args: string[]) => execFileSync("git", ["-C", checkout, "-c", "user.name=Fictional", "-c", "user.email=fictional@example.test", ...args], { encoding: "utf8" }).trim();
  git("init", "-q"); writeFileSync(join(checkout, "README"), "fictional\n"); git("add", "README"); git("commit", "-q", "-m", "fictional");
  const result = spawnSync(process.execPath, ["--import", "tsx", join(salon, "scripts/staging-consent/run.mts")], {
    cwd: salon, encoding: "utf8", timeout: 60_000,
    env: { PATH: process.env.PATH ?? "", HOME: root, TMPDIR: runTmp, GATEWAY_CHECKOUT: checkout, STAGING_GATEWAY_REVISION: git("rev-parse", "HEAD"),
      STAGING_PG_ADMIN_URL: "postgresql://booking:fictional-pass@127.0.0.1:5432/postgres?host=/tmp/elsewhere", ...extra } as unknown as NodeJS.ProcessEnv,
  });
  return { output: `${result.stdout}${result.stderr}`, status: result.status, leftovers: readdirSync(runTmp).filter(name => name.startsWith("cresavo-staging-")) };
}

describe.skipIf(process.platform === "win32")("runner preflight in a child process", () => {
  it("refuses database settings the runner and its children could resolve differently, leaving no run directory", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      const salon = salonFixture(root);
      // A `host` parameter (node-postgres would follow it, Prisma would not), a URL that leaves the
      // port to PGPORT, and connection defaults in the runner's own environment.
      for (const [extra, code] of [
        [{}, "STAGING_PG_ADMIN_URL_INCOMPLETE"],
        [{ STAGING_PG_ADMIN_URL: "postgresql://booking:fictional-pass@127.0.0.1/postgres" }, "STAGING_PG_ADMIN_URL_INCOMPLETE"],
        [{ STAGING_PG_ADMIN_URL: "postgresql://booking:fictional-pass@127.0.0.1/postgres", PGPORT: "5433" }, "STAGING_PG_ENVIRONMENT_REFUSED"],
        [{ STAGING_PG_ADMIN_URL: "postgresql://booking:fictional-pass@127.0.0.1:5432/postgres", PGPORT: "5433" }, "STAGING_PG_ENVIRONMENT_REFUSED"],
        [{ STAGING_PG_ADMIN_URL: "postgresql://booking:fictional-pass@127.0.0.1:5432/postgres", PGPASSWORD: "fictional-pass" }, "STAGING_PG_ENVIRONMENT_REFUSED"],
      ] as const) {
        const { output, status, leftovers } = runPreflight(root, salon, extra);
        expect(status, code).not.toBe(0);
        expect(output.includes(code), `${JSON.stringify(Object.keys(extra))}: ${code} is reported`).toBe(true);
        expect(output.includes("fictional-pass"), "the password is printed").toBe(false);
        expect(leftovers).toEqual([]);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 90_000);

  it("refuses diagnostics before Playwright loads: an existing DEBUG_FILE is left byte-identical", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      // Playwright's debug logger opens DEBUG_FILE for writing as it loads.
      const sentinel = join(root, "operator-debug.log"), content = "operator's own log, must stay as it is\n";
      writeFileSync(sentinel, content);
      const before = statSync(sentinel);
      // Playwright opens the file asynchronously, so an early exit can hide the write: a probe,
      // imported first by the fixture's copy of the runner, records at exit whether any Playwright
      // module was loaded at all.
      const loaded = join(root, "loaded.json");
      const probe = `import { createRequire } from "node:module"; import { writeFileSync } from "node:fs";
        const cache = createRequire(import.meta.url).cache;
        process.on("exit", () => writeFileSync(${JSON.stringify(loaded)}, JSON.stringify(Object.keys(cache).some(key => /[\\\\/]playwright(-core)?[\\\\/]/.test(key)))));`;
      const { output, status } = runPreflight(root, salonFixture(root, false, probe), { DEBUG_FILE: sentinel });
      expect(readFileSync(loaded, "utf8"), "Playwright was loaded before the diagnostics check").toBe("false");
      expect(status).not.toBe(0);
      expect(output.includes("STAGING_DIAGNOSTICS_REFUSED"), "the refusal code is reported").toBe(true);
      expect(readFileSync(sentinel, "utf8")).toBe(content);
      expect(statSync(sentinel).mtimeMs).toBe(before.mtimeMs);
      expect(readdirSync(root).filter(name => name.startsWith("cresavo-staging-"))).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 90_000);

  it("never echoes a misconfigured value before the error handlers exist", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      const salon = salonFixture(root), secret = "fictional-leaked-credential-9q7";
      // A credential (or a URL carrying one) pasted where the gateway revision belongs.
      for (const [extra, code] of [
        [{ STAGING_GATEWAY_REVISION: `postgresql://booking:${secret}@127.0.0.1/x` }, "STAGING_GATEWAY_REVISION_INVALID"],
        [{ STAGING_GATEWAY_REVISION: secret }, "STAGING_GATEWAY_REVISION_INVALID"],
        [{ NODE_TLS_REJECT_UNAUTHORIZED: "0" }, "STAGING_TLS_VERIFY_REFUSED"],
        [{ GATEWAY_CHECKOUT: join(root, `missing-${secret}`) }, "STAGING_GATEWAY_CHECKOUT_INVALID"],
        [{ STAGING_GATEWAY_HOST: `${secret}.cresavo.test`, STAGING_SALON_HOST: `${secret}.cresavo.test` }, "STAGING_HOSTS_MUST_DIFFER"],
      ] as const) {
        const { output, status } = runPreflight(root, salon, extra);
        expect(status, code).not.toBe(0);
        expect(output.includes(secret), `${code}: the value appears in the output`).toBe(false);
        expect(output.includes(code), `the code ${code} is reported`).toBe(true);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 120_000);

  it("runs from its own fixture: a .env in a checkout is refused there, and only there", () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      // The fixture with a .env gives the env-file refusal; the clean one (above) the database refusal.
      const { output } = runPreflight(root, salonFixture(root, true));
      expect(output.includes("STAGING_ENV_FILE_REFUSED"), "the fixture's .env decides, not the developer's").toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 90_000);
});
