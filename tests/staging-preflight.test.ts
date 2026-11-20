// The staging runner's preflight, in a child process with a throwaway checkout and TMPDIR.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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

describe.skipIf(process.platform === "win32")("runner preflight in a child process", () => {
  it("leaves no run directory behind when the database configuration is refused", () => {
    const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "cresavo-preflight-test-")));
    try {
      // A minimal git checkout standing in for the gateway, so the revision checks pass and the
      // runner reaches its database configuration.
      const checkout = join(sandbox, "gateway"), runTmp = join(sandbox, "tmp");
      mkdirSync(checkout, { recursive: true }); mkdirSync(runTmp, { recursive: true });
      const git = (...args: string[]) => execFileSync("git", ["-C", checkout, "-c", "user.name=Fictional", "-c", "user.email=fictional@example.test", ...args], { encoding: "utf8" }).trim();
      git("init", "-q");
      writeFileSync(join(checkout, "README"), "fictional\n");
      git("add", "README"); git("commit", "-q", "-m", "fictional");
      const revision = git("rev-parse", "HEAD");
      const result = spawnSync(process.execPath, ["--import", "tsx", join(repo, "scripts/staging-consent/run.mts")], {
        cwd: repo, encoding: "utf8", timeout: 60_000,
        env: { PATH: process.env.PATH ?? "", HOME: sandbox, TMPDIR: runTmp, GATEWAY_CHECKOUT: checkout, STAGING_GATEWAY_REVISION: revision,
          STAGING_PG_ADMIN_URL: "postgresql://booking:fictional-pass@127.0.0.1:5432/postgres?host=/tmp/elsewhere" } as unknown as NodeJS.ProcessEnv,
      });
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`.includes("STAGING_DATABASE_REFUSED"), "the refusal code is reported").toBe(true);
      expect(`${result.stdout}${result.stderr}`.includes("fictional-pass"), "the password is printed").toBe(false);
      expect(readdirSync(runTmp).filter(name => name.startsWith("cresavo-staging-"))).toEqual([]);
    } finally { rmSync(sandbox, { recursive: true, force: true }); }
  }, 90_000);
});
