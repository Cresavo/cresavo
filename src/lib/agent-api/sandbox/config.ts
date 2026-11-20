import { assertTestDatabase } from "../../../../scripts/test-db-guard.mjs";
import { AgentApiError } from "../errors";

export const SANDBOX_DELIVERY = "sandbox-demo-phone";
export const SANDBOX_CHANNEL = "sandbox-demo-phone-v1";
export const SANDBOX_CUSTOMER = Object.freeze({ name: "Salong Eko Test Customer", email: "sandbox-customer@example.test" });
export const MAX_SANDBOX_BOOKINGS = 20;
export const MAX_SANDBOX_SESSIONS = 24;
export const MAX_SANDBOX_REQUESTS_PER_SESSION = 256;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;
const REVISION = 1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const incompatible = [
  "BOOKING_CONSENT_LAB", "BOOKING_SMS_OTP_LAB", "BOOKING_OAUTH_LAB", "BOOKING_CONSENT_INBOX_DIR",
  "BOOKING_CONSENT_ORIGIN", "PUBLIC_READONLY", "ASSISTANT_PAIRING", "BOOKING_PUBLIC_DEMO",
  "CONCEPT_MCP_TOKEN", "CONCEPT_KEY_SECRET", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY",
] as const;

export function sandboxRequested(env = process.env) {
  return env.BOOKING_CONSENT_DELIVERY === SANDBOX_DELIVERY ||
    [env.BOOKING_SANDBOX, env.BOOKING_SANDBOX_DB_ID, env.BOOKING_SANDBOX_ORIGIN, env.BOOKING_SANDBOX_IP_KEY]
      .some(value => value !== undefined);
}

function httpsOrigin(value: string | undefined) {
  const url = URL.parse(value ?? "");
  return url && url.protocol === "https:" && !url.username && !url.password &&
    !url.search && !url.hash && url.pathname === "/" ? url.origin : null;
}

export function sandboxConfig(env = process.env) {
  const origin = httpsOrigin(env.BOOKING_SANDBOX_ORIGIN);
  const gatewayOrigin = httpsOrigin(env.BOOKING_PUBLIC_ORIGIN);
  const installation = env.BOOKING_SANDBOX_DB_ID;
  if (env.BOOKING_SANDBOX !== "1" || env.BOOKING_CONSENT_DELIVERY !== SANDBOX_DELIVERY ||
      env.BOOKING_SERVICE_ROLE !== "salon" || !/^[a-f0-9]{64}$/.test(env.GATEWAY_SERVICE_TOKEN ?? "") ||
      !installation || !uuid.test(installation) || !origin || !gatewayOrigin || origin === gatewayOrigin ||
      (env.SESSION_SECRET?.length ?? 0) < 32 ||
      incompatible.some(key => env[key] !== undefined && env[key] !== "0")) {
    throw new AgentApiError("provider_configuration_invalid");
  }
  if (env.BOOKING_RUNTIME === "vercel") {
    if (env.VERCEL !== "1" || env.VERCEL_ENV !== "production" || env.RATE_LIMIT_STORE !== "postgres")
      throw new AgentApiError("provider_configuration_invalid");
  } else {
    try {
      if (env.BOOKING_RUNTIME !== "local" || env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL) throw new Error();
      assertTestDatabase(env.DATABASE_URL);
    } catch {
      throw new AgentApiError("provider_configuration_invalid");
    }
  }
  return { origin, gatewayOrigin, installation, revision: REVISION };
}

export function sandboxHost(request: Request, origin: string) {
  return request.headers.get("host") === new URL(origin).host;
}
