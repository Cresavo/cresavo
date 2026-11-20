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
