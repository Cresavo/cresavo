import { assertTestDatabase } from "../../../../scripts/test-db-guard.mjs";
import { AgentApiError } from "../errors";

export const SANDBOX_DELIVERY = "sandbox-demo-phone";
export const SANDBOX_CHANNEL = "sandbox-demo-phone-v1";
export const SANDBOX_CUSTOMER = Object.freeze({ name: "Salong Eko Test Customer", email: "sandbox-customer@example.test" });
export const MAX_SANDBOX_BOOKINGS = 20;
export const MAX_SANDBOX_SESSIONS = 24;
export const MAX_HOSTED_SANDBOX_SESSIONS = 8;
export const MAX_SANDBOX_REQUESTS_PER_SESSION = 256;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
const REVISION = 1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const incompatibleFlags = [
  "BOOKING_CONSENT_LAB", "AGENT_OAUTH", "PUBLIC_READONLY",
  "ASSISTANT_PAIRING", "BOOKING_PUBLIC_DEMO", "NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO",
] as const;
const incompatibleSettings = [
  "BOOKING_CONSENT_INBOX_DIR", "BOOKING_CONSENT_ORIGIN", "CONCEPT_MCP_TOKEN", "CONCEPT_KEY_SECRET",
  "CONCEPT_AI_API_KEY", "CONCEPT_AI_BASE_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY",
] as const;

export function sandboxRequested(env = process.env) {
  return env.BOOKING_CONSENT_DELIVERY === SANDBOX_DELIVERY ||
    [env.BOOKING_SANDBOX, env.BOOKING_SANDBOX_DB_ID, env.BOOKING_SANDBOX_ORIGIN, env.BOOKING_SANDBOX_IP_KEY,
      env.BOOKING_SANDBOX_PROJECT_ID, env.BOOKING_SANDBOX_RESET_DATABASE_URL]
      .some(value => value !== undefined);
}

function httpsOrigin(value: string | undefined) {
  const url = URL.parse(value ?? "");
  return url && url.protocol === "https:" && !url.username && !url.password &&
    !url.search && !url.hash && url.pathname === "/" ? url.origin : null;
}

export function isVerifiedHostedDatabaseUrl(value: string | undefined) {
  const url = URL.parse(value ?? "");
  return !!url && ["postgres:", "postgresql:"].includes(url.protocol) && !!url.hostname &&
    !!url.username && url.pathname.length > 1 && url.searchParams.getAll("sslmode").join(",") === "verify-full" &&
    ![...url.searchParams.keys()].some(key => ["host", "hostaddr", "ssl", "sslnegotiation"].includes(key.toLowerCase()));
}

export function sandboxConfig(env = process.env) {
  const origin = httpsOrigin(env.BOOKING_SANDBOX_ORIGIN);
  const gatewayOrigin = httpsOrigin(env.BOOKING_PUBLIC_ORIGIN);
  const installation = env.BOOKING_SANDBOX_DB_ID;
  if (env.BOOKING_SANDBOX !== "1" || env.BOOKING_CONSENT_DELIVERY !== SANDBOX_DELIVERY ||
      env.BOOKING_SERVICE_ROLE !== "salon" || !/^[a-f0-9]{64}$/.test(env.GATEWAY_SERVICE_TOKEN ?? "") ||
      !installation || !uuid.test(installation) || !origin || !gatewayOrigin || origin === gatewayOrigin ||
      (env.SESSION_SECRET?.length ?? 0) < 32 ||
      incompatibleFlags.some(key => env[key] !== undefined && env[key] !== "0") ||
      incompatibleSettings.some(key => env[key] !== undefined)) {
    throw new AgentApiError("provider_configuration_invalid");
  }
  if (env.BOOKING_RUNTIME === "vercel") {
    if (env.VERCEL !== "1" || env.VERCEL_ENV !== "production" || env.RATE_LIMIT_STORE !== "postgres" ||
        !/^prj_[A-Za-z0-9]+$/.test(env.BOOKING_SANDBOX_PROJECT_ID ?? "") ||
        env.VERCEL_PROJECT_ID !== env.BOOKING_SANDBOX_PROJECT_ID ||
        !isVerifiedHostedDatabaseUrl(env.DATABASE_URL))
      throw new AgentApiError("provider_configuration_invalid");
  } else {
    try {
      if (env.BOOKING_RUNTIME !== "local" || env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL) throw new Error();
      assertTestDatabase(env.DATABASE_URL);
      if (!new URL(env.DATABASE_URL!).pathname.endsWith("_test")) throw new Error();
    } catch {
      throw new AgentApiError("provider_configuration_invalid");
    }
  }
  const sessionLimit = env.BOOKING_RUNTIME === "vercel" ? MAX_HOSTED_SANDBOX_SESSIONS : MAX_SANDBOX_SESSIONS;
  return { origin, gatewayOrigin, installation, revision: REVISION, sessionLimit };
}

export function sandboxHost(request: Request, origin: string) {
  return request.headers.get("host") === new URL(origin).host;
}

export function sandboxCronHost(request: Request, origin: string, env = process.env) {
  const actual = new URL(request.url).origin;
  if (actual === origin && sandboxHost(request, origin)) return true;
  if (env.BOOKING_RUNTIME !== "vercel" || env.VERCEL_ENV !== "production") return false;
  return [env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL].some(host =>
    !!host && /^[a-z0-9-]+\.vercel\.app$/.test(host) && actual === "https://" + host && sandboxHost(request, actual));
}
