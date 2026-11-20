#!/usr/bin/env node
// Prepares a fresh, dedicated sandbox database and the two projects' production settings.
// Run from a Cresavo checkout on the owner's own machine. See docs/DEPLOY_SANDBOX.md.
//
// It never prints a secret. Credentials reach psql, Prisma and the Vercel CLI only through
// environment variables or stdin, never through process arguments.
import { spawnSync } from "node:child_process";
import { closeSync, lstatSync, mkdirSync, mkdtempSync, openSync, rmSync, unlinkSync, writeSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  RESET_ROLE, RUNTIME_ROLE, createLoginSql, envFile, hexSecret, libpqEnv, loginUrl, newInstallationId,
  parseMigrationUrl, productionSettings, scramVerifier,
} from "./bootstrap-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const usage = `Usage: node scripts/sandbox/bootstrap.mjs [options]

Reads the migration owner's URL from SANDBOX_MIGRATION_DATABASE_URL. The URL must point
at a new, empty database dedicated to the sandbox. Set it without echo or shell history:

  read -rs SANDBOX_MIGRATION_DATABASE_URL && export SANDBOX_MIGRATION_DATABASE_URL

  --runtime-host <host>   Host for the provider login (default: the migration host)
  --reset-host <host>     Host for the reset login; use the direct, unpooled endpoint
                          (default: the migration host)
  --project-id <prj_…>    The cresavo-sandbox project's ID, added to the settings
  --out <dir>             Where to write the settings files
                          (default: ~/.cresavo-sandbox, mode 700, files mode 600)
  --push-vercel           Also store the settings in both Vercel projects (Production)
  --scope <team>          Vercel team (default: niclasvestlund-3367s-projects)
  --sandbox-project <n>   Vercel sandbox project (default: cresavo-sandbox)
  --gateway-project <n>   Vercel gateway project (default: cresavo-gateway)
  --sandbox-origin <url>  default: https://sandbox.cresavo.com
  --gateway-origin <url>  default: https://gateway.cresavo.com
`;

const { values: opts } = parseArgs({ options: {
  "runtime-host": { type: "string" }, "reset-host": { type: "string" }, "project-id": { type: "string" },
  out: { type: "string" }, "push-vercel": { type: "boolean", default: false },
  scope: { type: "string", default: "niclasvestlund-3367s-projects" },
  "sandbox-project": { type: "string", default: "cresavo-sandbox" },
  "gateway-project": { type: "string", default: "cresavo-gateway" },
  "sandbox-origin": { type: "string", default: "https://sandbox.cresavo.com" },
  "gateway-origin": { type: "string", default: "https://gateway.cresavo.com" },
  help: { type: "boolean", default: false },
} });
if (opts.help) { process.stdout.write(usage); process.exit(0); }

const step = (/** @type {string} */ text) => console.log(`[bootstrap] ${text}`);
/** Settings files reserved before any database change; removed again if the run stops. */
/** @type {{ path: string, fd: number }[]} */
const reserved = [];
/** @param {string} code @param {string} [hint] @returns {never} */
function fail(code, hint) {
  for (const { path, fd } of reserved.splice(0)) { closeSync(fd); unlinkSync(path); }
  console.error(`[bootstrap] stopped: ${code}${hint ? `\n[bootstrap] ${hint}` : ""}`);
  process.exit(1);
}

/** Runs a command with output hidden; reports only the label and exit status. */
function run(/** @type {string} */ label, /** @type {string} */ cmd, /** @type {string[]} */ args,
  /** @type {{ env?: NodeJS.ProcessEnv, input?: string, cwd?: string }} */ options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd ?? root, input: options.input, encoding: "utf8",
    env: { ...process.env, ...options.env }, stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) {
    // psql and Prisma errors name objects and codes, not passwords; still keep it short.
    const reason = (result.stderr || result.stdout).split("\n").find(line => /ERROR|error|Error/.test(line));
    fail(`${label} failed`, reason?.slice(0, 300));
  }
  return result.stdout;
}

/** psql against a database, connection details only in the environment. */
function psql(/** @type {string} */ label, /** @type {URL} */ url,
  /** @type {{ file?: string, sql?: string, vars?: Record<string, string> }} */ query) {
  const args = ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1"];
  for (const [key, value] of Object.entries(query.vars ?? {})) args.push("-v", `${key}=${value}`);
  if (query.file) args.push("-f", join(root, query.file));
  return run(label, "psql", args, { env: libpqEnv(url), input: query.sql });
}

const outDir = resolve(opts.out ?? join(homedir(), ".cresavo-sandbox"));
const sandboxFile = join(outDir, "sandbox.production.env");
const gatewayFile = join(outDir, "gateway.production.env");
if (opts["project-id"] && !/^prj_[A-Za-z0-9]+$/.test(opts["project-id"])) fail("PROJECT_ID_INVALID");
for (const tool of ["psql", "npx", ...(opts["push-vercel"] ? ["vercel"] : [])])
  if (spawnSync(tool, ["--version"], { stdio: "ignore" }).status !== 0) fail(`${tool} not found`);
const migrationValue = process.env.SANDBOX_MIGRATION_DATABASE_URL;
if (!migrationValue) fail("SANDBOX_MIGRATION_DATABASE_URL is not set", "See --help.");

const parsed = (() => {
  try { return parseMigrationUrl(migrationValue); } catch (error) { return fail(String(/** @type {Error} */ (error).message)); }
})();
if (parsed.local) step("loopback database: generated URLs keep its TLS setting (local test only)");
else {
  // The read-only checks connect with sslmode=verify-full and the system CA store (libpq 16+).
  const major = Number(/(\d+)(?:\.\d+)?/.exec(run("psql version", "psql", ["--version"]))?.[1]);
  if (!(major >= 16)) fail("PSQL_16_REQUIRED", "Install PostgreSQL 16 or later client tools.");
}

// Reserve both files exclusively now, so a run never prepares a database it cannot record.
mkdirSync(outDir, { recursive: true, mode: 0o700 });
if (!lstatSync(outDir).isDirectory()) fail("SETTINGS_DIRECTORY_INVALID", `${outDir} must be a real directory.`);
for (const path of [sandboxFile, gatewayFile]) {
  try { reserved.push({ path, fd: openSync(path, "wx", 0o600) }); } catch {
    fail("SETTINGS_FILES_EXIST", `Move ${outDir} away first; this script never overwrites settings.`);
  }
}
step("checking that the sandbox logins do not exist yet");
const existing = psql("role check", parsed.url, { sql:
  `SELECT count(*) FROM pg_roles WHERE rolname IN ('${RUNTIME_ROLE}', '${RESET_ROLE}');\n` }).trim();
if (existing !== "0") fail("SANDBOX_LOGINS_EXIST", "Use a new database and remove the old sandbox logins first.");

const installation = newInstallationId();
step("marking the empty database (scripts/sandbox/mark.sql)");
psql("mark", parsed.url, { file: "scripts/sandbox/mark.sql", vars: { installation_id: installation } });

step("applying migrations (prisma migrate deploy)");
run("migrate", "npx", ["prisma", "migrate", "deploy"], { env: { DATABASE_URL: parsed.url.href } });

const runtimePassword = hexSecret();
const resetPassword = hexSecret();
step(`creating the logins ${RUNTIME_ROLE} and ${RESET_ROLE} (SCRAM verifiers only)`);
psql("create logins", parsed.url, { sql:
  "BEGIN;\n" + createLoginSql(RUNTIME_ROLE, scramVerifier(runtimePassword)) +
  createLoginSql(RESET_ROLE, scramVerifier(resetPassword)) + "COMMIT;\n" });

step("granting the provider login its runtime rights (scripts/sandbox/runtime-grants.sql)");
psql("runtime grants", parsed.url, { file: "scripts/sandbox/runtime-grants.sql", vars: { runtime_role: RUNTIME_ROLE } });
step("installing the reset routine for the reset login (scripts/sandbox/reset.sql)");
psql("reset routine", parsed.url, { file: "scripts/sandbox/reset.sql", vars: { reset_role: RESET_ROLE } });

const runtimeUrl = loginUrl(parsed.url, RUNTIME_ROLE, runtimePassword, opts["runtime-host"]);
const resetUrl = loginUrl(parsed.url, RESET_ROLE, resetPassword, opts["reset-host"]);

// Read-only checks with the new logins, over the same TLS mode the app will use.
step("verifying the provider login (read-only)");
const runtimeCheck = psql("provider login check", new URL(runtimeUrl), { sql:
  "SELECT id::text FROM cresavo_sandbox.installation;\n" +
  "SELECT has_table_privilege('public.\"SandboxSession\"', 'DELETE');\n" }).trim().split("\n");
if (runtimeCheck[0] !== installation || runtimeCheck[1] !== "f") fail("PROVIDER_LOGIN_CHECK_FAILED");
step("verifying the reset login (read-only)");
const resetCheck = psql("reset login check", new URL(resetUrl), { sql:
  "SELECT has_function_privilege('cresavo_sandbox.reset(uuid, integer)', 'EXECUTE');\n" +
  "SELECT has_table_privilege('public.\"SandboxSession\"', 'SELECT');\n" }).trim().split("\n");
if (resetCheck[0] !== "t" || resetCheck[1] !== "f") fail("RESET_LOGIN_CHECK_FAILED");

const settings = productionSettings({
  installation, runtimeUrl, resetUrl, projectId: opts["project-id"],
  sandboxOrigin: opts["sandbox-origin"], gatewayOrigin: opts["gateway-origin"],
});
for (const [{ fd }, entries] of /** @type {const} */ ([[reserved[0], settings.sandbox], [reserved[1], settings.gateway]])) {
  writeSync(fd, envFile(entries));
  closeSync(fd);
}
reserved.length = 0;
step(`wrote ${sandboxFile} and ${gatewayFile} (mode 600)`);
step(`installation ID (not secret): ${installation}`);

if (opts["push-vercel"]) {
  /** @param {string} project @param {[string, string, boolean][]} entries */
  const push = (project, entries) => {
    const cwd = mkdtempSync(join(tmpdir(), "cresavo-sandbox-vercel-"));
    try {
      for (const [name, value, secret] of entries) {
        run(`vercel env add ${name} (${project})`, "vercel", ["env", "add", name,
          "--environment", "production", "--project", project, "--scope", opts.scope,
          secret ? "--sensitive" : "--no-sensitive", "--force", "--yes"], { input: value, cwd });
        step(`${project}: ${name}${secret ? " (sensitive)" : ""}`);
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  };
  push(opts["sandbox-project"], settings.sandbox);
  push(opts["gateway-project"], settings.gateway);
}

step("done. Next: in Vercel, check the settings, then follow docs/DEPLOY_SANDBOX.md step 5 onwards.");
if (!opts["project-id"]) step("BOOKING_SANDBOX_PROJECT_ID is not set: add the project's prj_… ID in Vercel yourself (not secret).");
if (!opts["push-vercel"]) step("Settings were not pushed. Add them per project from the two files, or rerun with --push-vercel.");
