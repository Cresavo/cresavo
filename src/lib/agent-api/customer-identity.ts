import { assertTestDatabase } from "../../../scripts/test-db-guard.mjs";
import { discoveryOrigin } from "./discovery";
import { AgentApiError } from "./errors";

/**
 * Customer consent runs only as a local lab: loopback origin, a guarded test database and no
 * cloud runtime. Replace delivery and customer verification together before any real deployment.
 */
export function requireConsentLab() {
  if (process.env.BOOKING_CONSENT_LAB !== "1" || process.env.BOOKING_RUNTIME === "vercel" ||
      process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL)
    throw new AgentApiError("mandate_denied");
  let origin: string;
  try { origin = discoveryOrigin(); }
  catch { throw new AgentApiError("mandate_denied"); }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname))
    throw new AgentApiError("mandate_denied");
  assertTestDatabase();
  return origin;
}
