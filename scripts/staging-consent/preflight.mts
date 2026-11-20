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
  return url;
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
  return values.flatMap(value => value.split(/\s+/)).filter(token => token.startsWith("--"))
    .map(token => `--${token.slice(2).split("=")[0].replace(/_/g, "-").toLowerCase()}`);
}
/** Checks the environment and this process's own Node flags (`node --tls-keylog=... run.mts`). */
export function refuseDiagnostics(env: Record<string, string | undefined>, execArgv: readonly string[] = process.execArgv) {
  for (const name of DIAGNOSTIC_SETTINGS) if (env[name]) throw new Error("STAGING_DIAGNOSTICS_REFUSED");
  // Node reads quoted and escaped values in NODE_OPTIONS (`--tls-keylog="/a b"`). Rather than
  // re-implement that syntax, any quote or backslash is refused: the check then reads exactly
  // the options Node reads.
  if (/["'\\]/.test(env.NODE_OPTIONS ?? "")) throw new Error("STAGING_NODE_OPTIONS_AMBIGUOUS");
  if (nodeOptionNames([env.NODE_OPTIONS ?? "", ...execArgv]).some(flag => DIAGNOSTIC_FLAGS.test(flag)))
    throw new Error("STAGING_DIAGNOSTICS_REFUSED");
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
