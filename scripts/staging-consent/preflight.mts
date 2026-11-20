import { existsSync } from "node:fs";
import { join } from "node:path";
// Preflight parsing for the staging runner. These run before any secret is registered
// for redaction, so a failure throws a static code only: never the input, which may be
// a connection string with a password.
export const DEFAULT_ADMIN_URL = "postgresql://booking:booking@127.0.0.1:5432/postgres";

const QUERY_CREDENTIALS = ["user", "password", "passfile", "sslpassword", "sslkey", "sslcert", "sslrootcert", "sslcrl", "service", "servicefile", "krbsrvname"];

export function loopbackAdminUrl(value: string | undefined) {
  const url = URL.parse(value ?? DEFAULT_ADMIN_URL);
  if (!url || !["postgresql:", "postgres:"].includes(url.protocol)) throw new Error("STAGING_PG_ADMIN_URL_INVALID");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("STAGING_DATABASE_MUST_BE_LOOPBACK");
  // Credentials only in the URL's user info, where the runner registers them for the output scan.
  // A query parameter can override it (the driver prefers a `password` parameter) or point at
  // credentials elsewhere: refused, not tracked.
  if ([...url.searchParams.keys()].some(key => QUERY_CREDENTIALS.includes(key.toLowerCase())))
    throw new Error("STAGING_PG_ADMIN_URL_CREDENTIAL_PARAMETER");
  // The runner's own client (node-postgres) and the migration and seed children (Prisma) must reach
  // the same server as the same role. node-postgres fills an omitted port, user, password or
  // database from PG* variables and lets a `host`/`port`/`db` parameter override the URL, which
  // Prisma does not: so every part is required in the URL itself and those parameters are refused.
  if (!url.port || !url.username || !url.password || !/^\/[^/]+$/.test(url.pathname) ||
      [...url.searchParams.keys()].some(key => CONNECTION_PARAMETERS.includes(key.toLowerCase())))
    throw new Error("STAGING_PG_ADMIN_URL_INCOMPLETE");
  return url;
}

const CONNECTION_PARAMETERS = ["host", "hostaddr", "port", "dbname", "database", "db"];
/**
 * libpq and node-postgres connection defaults (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE,
 * PGSERVICE, PGSSLMODE, PGOPTIONS, ...). The children get a closed environment without them, so
 * the runner refuses them in its own: both sides then connect with the URL and nothing else.
 * PGDATA is the server's data directory, which no client reads.
 */
export function refusePgEnvironment(env: Record<string, string | undefined>) {
  if (Object.keys(env).some(name => /^PG[A-Z_]+$/.test(name) && name !== "PGDATA")) throw new Error("STAGING_PG_ENVIRONMENT_REFUSED");
}

// Diagnostic settings that make libraries in this process (Playwright's driver and API log, the
// `debug` package, Node's own debug output) print URLs, including approval links with their
// secret, to stderr outside the runner's sanitizer and output scan. Refused, not filtered.
// TLS session-key logging (`SSLKEYLOGFILE` for Chromium, `--tls-keylog` for Node) writes keys that
// decrypt every TLS connection of the run to a file outside the run directory and its output scan.
const DIAGNOSTIC_SETTINGS = ["DEBUG", "DEBUG_FILE", "PWDEBUG", "PW_DEBUG", "NODE_DEBUG", "PLAYWRIGHT_DEBUG", "DEBUG_COLORS", "SSLKEYLOGFILE"];
const DIAGNOSTIC_FLAGS = /^--(?:inspect(?:-|$)|trace-|cpu-prof|heap-prof|tls-keylog$)/;
/**
 * Node option names as Node itself reads them: the name before any `=value`, with underscores and
 * hyphens equivalent (`--tls_keylog` is `--tls-keylog`) and letter case ignored.
 */
export function nodeOptionNames(values: readonly string[]) {
  return values.flatMap(value => value.split(/\s+/)).filter(token => token.startsWith("-"))
    .map(token => token.startsWith("--") ? `--${token.slice(2).split("=")[0].replace(/_/g, "-").toLowerCase()}` : token.split("=")[0]);
}

/**
 * The only Node options the runner accepts, in NODE_OPTIONS or its own command line. Everything else
 * is refused: Node keeps adding modes that write process state to disk (reports, heap snapshots,
 * diagnostic directories) outside the run directory and the output scan. The CA options choose which
 * certificates to trust. Preloads are not on the list: see TSX_LOADER.
 */
const ALLOWED_NODE_OPTIONS = new Set(["--use-openssl-ca", "--use-bundled-ca", "--use-system-ca", "--max-old-space-size",
  "--enable-source-maps", "--no-warnings", "--no-deprecation", "--experimental-strip-types", "--no-experimental-strip-types"]);
/**
 * The one preload the runner accepts: tsx, exactly as `npm run test:staging-consent` passes it
 * (`node --import tsx run.mts`). Any other `--import` runs code before the preflight, so it is
 * refused, and so is any `--import` in NODE_OPTIONS (which every child Node would inherit too).
 */
function refusePreloads(nodeOptions: string, execArgv: readonly string[]) {
  if (nodeOptionNames([nodeOptions]).includes("--import")) throw new Error("STAGING_NODE_OPTION_REFUSED");
  for (let i = 0; i < execArgv.length; i++) {
    if (nodeOptionNames([execArgv[i]])[0] !== "--import") continue;
    if (execArgv[i] !== "--import" || execArgv[i + 1] !== "tsx") throw new Error("STAGING_NODE_OPTION_REFUSED");
    i++;
  }
}
/** Checks the environment and this process's own Node flags (`node --tls-keylog=... run.mts`). */
export function refuseDiagnostics(env: Record<string, string | undefined>, execArgv: readonly string[] = process.execArgv) {
  for (const name of DIAGNOSTIC_SETTINGS) if (env[name]) throw new Error("STAGING_DIAGNOSTICS_REFUSED");
  // Node reads quoted and escaped values in NODE_OPTIONS (`--tls-keylog="/a b"`). Rather than
  // re-implement that syntax, any quote or backslash is refused: the check then reads exactly
  // the options Node reads.
  if (/["'\\]/.test(env.NODE_OPTIONS ?? "")) throw new Error("STAGING_NODE_OPTIONS_AMBIGUOUS");
  const names = nodeOptionNames([env.NODE_OPTIONS ?? "", ...execArgv]);
  if (names.some(flag => DIAGNOSTIC_FLAGS.test(flag))) throw new Error("STAGING_DIAGNOSTICS_REFUSED");
  refusePreloads(env.NODE_OPTIONS ?? "", execArgv);
  if (names.some(flag => flag !== "--import" && !ALLOWED_NODE_OPTIONS.has(flag))) throw new Error("STAGING_NODE_OPTION_REFUSED");
}

// Settings that make Playwright drive a browser somewhere else: a Selenium grid
// (`SELENIUM_REMOTE_URL` and its companions) or a remote endpoint (`PW_TEST_CONNECT_*`), or attach to
// another browser. The runner would then send approval links, secret included, off this machine,
// and a hosted grid could be an unapproved cloud resource. Refused before any browser exists.
const REMOTE_BROWSER_PREFIXES = ["SELENIUM_REMOTE_", "PW_TEST_CONNECT_"];
const REMOTE_BROWSER_SETTINGS = ["PW_CHROMIUM_ATTACH_TO_OTHER", "PW_TEST_REUSE_CONTEXT"];
export function refuseRemoteBrowsers(env: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(env))
    if (value && (REMOTE_BROWSER_SETTINGS.includes(name) || REMOTE_BROWSER_PREFIXES.some(prefix => name.toUpperCase().startsWith(prefix))))
      throw new Error("STAGING_REMOTE_BROWSER_REFUSED");
}

/**
 * The run's own database, derived from the admin URL and validated before anything is acquired:
 * a refused configuration (for example a `host` query parameter that would send the connection
 * elsewhere) must fail here, before the private run directory exists. Static codes only.
 */
export function stagingDatabase(adminUrl: URL, suffix: string, guard: (url: string) => void) {
  const dbName = `staging_consent_${suffix}_test`;
  const databaseUrl = new URL(adminUrl);
  databaseUrl.pathname = `/${dbName}`;
  try { guard(databaseUrl.href); } catch { throw new Error("STAGING_DATABASE_REFUSED"); }
  let password: string;
  try { password = decodeURIComponent(adminUrl.password); } catch { throw new Error("STAGING_PG_ADMIN_URL_INVALID"); }
  return { dbName, databaseUrl, password };
}

// Files Next.js and Prisma (prisma.config.ts) load on their own from a working directory.
export const ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local", ".env.development", ".env.development.local"];
/** Refuses with a static code if any of these directories holds an env file. Never reads one. */
export function refuseEnvFiles(dirs: readonly string[]) {
  for (const dir of dirs) for (const name of ENV_FILES)
    if (existsSync(join(dir, name))) throw new Error("STAGING_ENV_FILE_REFUSED");
}
