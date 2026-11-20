// Pure helpers for scripts/sandbox/bootstrap.mjs. No I/O, so they can be unit tested.
import { createHash, createHmac, pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";

export const RUNTIME_ROLE = "cresavo_sandbox_runtime";
export const RESET_ROLE = "cresavo_sandbox_reset";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
// Parameters the hosted sandbox refuses in its database URLs (see sandbox/config.ts).
const FORBIDDEN_PARAMS = ["host", "hostaddr", "ssl", "sslnegotiation"];

/** 32 random bytes as 64 lowercase hex characters. */
export const hexSecret = () => randomBytes(32).toString("hex");

/**
 * A SCRAM-SHA-256 verifier, so the plain password never reaches the server or its logs.
 * Only for ASCII passwords: the generated ones are hex, which needs no SASLprep.
 * @param {string} password @param {Buffer} [salt] @param {number} [iterations]
 */
export function scramVerifier(password, salt = randomBytes(16), iterations = 4096) {
  if (!/^[\x21-\x7e]+$/.test(password)) throw new Error("SCRAM_ASCII_PASSWORD_REQUIRED");
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

/** @param {string} value */
export function parseMigrationUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("MIGRATION_URL_INVALID"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password)
    throw new Error("MIGRATION_URL_INVALID");
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!database || database.includes("/") || ["postgres", "template0", "template1"].includes(database))
    throw new Error("MIGRATION_URL_DATABASE_REQUIRED");
  if ([...url.searchParams.keys()].some(key => ["host", "hostaddr"].includes(key.toLowerCase())))
    throw new Error("MIGRATION_URL_HOST_PARAMETER_REFUSED");
  const local = LOCAL_HOSTS.includes(url.hostname);
  const sslmode = url.searchParams.get("sslmode");
  if (!local && !["require", "verify-ca", "verify-full"].includes(sslmode ?? ""))
    throw new Error("MIGRATION_URL_TLS_REQUIRED");
  return { url, database, local };
}

/**
 * libpq environment for psql, so no credential appears in a process argument.
 * @param {URL} url
 */
export function libpqEnv(url) {
  const sslmode = url.searchParams.get("sslmode");
  return {
    PGHOST: url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(sslmode ? { PGSSLMODE: sslmode } : {}),
    // verify-full needs a root store; libpq 16+ accepts the system one.
    ...(sslmode === "verify-full" ? { PGSSLROOTCERT: "system" } : {}),
    PGCONNECT_TIMEOUT: "15",
  };
}

/**
 * A login URL for the sandbox runtime or reset role, on the given host.
 * Hosted URLs always carry sslmode=verify-full, as the sandbox requires.
 * @param {URL} migration @param {string} user @param {string} password @param {string} [host]
 */
export function loginUrl(migration, user, password, host) {
  const url = new URL(migration.href);
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(password);
  if (host) url.hostname = host;
  for (const key of [...url.searchParams.keys()])
    if (FORBIDDEN_PARAMS.includes(key.toLowerCase())) url.searchParams.delete(key);
  if (!LOCAL_HOSTS.includes(url.hostname)) url.searchParams.set("sslmode", "verify-full");
  return url.href;
}

/** @param {string} name */
const sqlIdent = name => {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) throw new Error("ROLE_NAME_INVALID");
  return `"${name}"`;
};

/**
 * A fresh login without any role membership or elevated attribute.
 * @param {string} name @param {string} verifier
 */
export function createLoginSql(name, verifier) {
  if (!/^SCRAM-SHA-256\$\d+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(verifier))
    throw new Error("SCRAM_VERIFIER_INVALID");
  return `CREATE ROLE ${sqlIdent(name)} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS ` +
    `PASSWORD '${verifier}';\n`;
}

/**
 * Production settings for the two Vercel projects. Values marked secret are stored as Sensitive.
 * @param {{ installation: string, runtimeUrl: string, resetUrl: string, projectId?: string,
 *   sandboxOrigin: string, gatewayOrigin: string }} input
 */
export function productionSettings(input) {
  const serviceToken = hexSecret();
  /** @type {[string, string, boolean][]} */
  const sandbox = [
    ["BOOKING_SANDBOX", "1", false],
    ["BOOKING_SANDBOX_DB_ID", input.installation, false],
    ["BOOKING_SANDBOX_ORIGIN", input.sandboxOrigin, false],
    ["BOOKING_RUNTIME", "vercel", false],
    ["BOOKING_SERVICE_ROLE", "salon", false],
    ["BOOKING_PUBLIC_ORIGIN", input.gatewayOrigin, false],
    ["BOOKING_CONSENT_DELIVERY", "sandbox-demo-phone", false],
    ["RATE_LIMIT_STORE", "postgres", false],
    ["DATABASE_URL", input.runtimeUrl, true],
    ["BOOKING_SANDBOX_RESET_DATABASE_URL", input.resetUrl, true],
    ["SESSION_SECRET", hexSecret(), true],
    ["BOOKING_SANDBOX_IP_KEY", hexSecret(), true],
    ["CRON_SECRET", hexSecret(), true],
    ["GATEWAY_SERVICE_TOKEN", serviceToken, true],
  ];
  if (input.projectId) sandbox.splice(1, 0, ["BOOKING_SANDBOX_PROJECT_ID", input.projectId, false]);
  /** @type {[string, string, boolean][]} */
  const gateway = [
    ["SALON_ORIGIN", input.sandboxOrigin, false],
    ["GATEWAY_SERVICE_TOKEN", serviceToken, true],
  ];
  return { sandbox, gateway };
}

/** @param {[string, string, boolean][]} entries */
export function envFile(entries) {
  return entries.map(([name, value]) => {
    if (/[\r\n]/.test(value)) throw new Error("ENV_VALUE_INVALID");
    return `${name}=${value}`;
  }).join("\n") + "\n";
}

export const newInstallationId = () => randomUUID();
