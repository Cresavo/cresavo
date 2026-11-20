// Preflight parsing for the staging runner. These run before any secret is registered
// for redaction, so a failure throws a static code only: never the input, which may be
// a connection string with a password.
export const DEFAULT_ADMIN_URL = "postgresql://booking:booking@127.0.0.1:5432/postgres";

export function loopbackAdminUrl(value: string | undefined) {
  const url = URL.parse(value ?? DEFAULT_ADMIN_URL);
  if (!url || !["postgresql:", "postgres:"].includes(url.protocol)) throw new Error("STAGING_PG_ADMIN_URL_INVALID");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("STAGING_DATABASE_MUST_BE_LOOPBACK");
  return url;
}

// Diagnostic settings that make libraries in this process (Playwright's driver and API log, the
// `debug` package, Node's own debug output) print URLs, including approval links with their
// secret, to stderr outside the runner's sanitizer and output scan. Refused, not filtered.
const DIAGNOSTIC_SETTINGS = ["DEBUG", "DEBUG_FILE", "PWDEBUG", "PW_DEBUG", "NODE_DEBUG", "PLAYWRIGHT_DEBUG", "DEBUG_COLORS"];
export function refuseDiagnostics(env: Record<string, string | undefined>) {
  for (const name of DIAGNOSTIC_SETTINGS) if (env[name]) throw new Error("STAGING_DIAGNOSTICS_REFUSED");
  if (/--(?:inspect|trace-|cpu-prof|heap-prof)/.test(env.NODE_OPTIONS ?? "")) throw new Error("STAGING_DIAGNOSTICS_REFUSED");
}
