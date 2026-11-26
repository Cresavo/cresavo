import { businessKey } from "../../ai/business-settings";
import { DEMO_BUSINESS } from "../../ai/demo-store";
import { receptionistEnabled } from "../flag";
import { limitsFrom, type CallLimits } from "../limits";
import { realtimeModel } from "../realtime-config";

// The phone receptionist is off unless the deployment switches it on, and it
// only ever serves the sample salon: there is no tenant argument anywhere on
// its routes.

type Env = Record<string, string | undefined>;

export { receptionistEnabled };

/**
 * The OpenAI key a call is billed to. Never leaves the server. First the receptionist's own key
 * (PHONE_RECEPTIONIST_OPENAI_API_KEY, e.g. a separate OpenAI project with its own budget cap), then the
 * sample salon's saved key, then the platform's OPENAI_API_KEY.
 */
export function realtimeKey(env: Env = process.env): string | null {
  const dedicated = env.PHONE_RECEPTIONIST_OPENAI_API_KEY?.trim();
  if (dedicated) return dedicated;
  const own = businessKey(DEMO_BUSINESS, env);
  if (own?.provider === "openai") return own.apiKey;
  return env.OPENAI_API_KEY?.trim() || null;
}

export interface ReceptionistStatus {
  enabled: boolean;
  /** A key is set, so a test call can start. */
  configured: boolean;
  limits: CallLimits;
  model: string;
}

/** What the studio may know. No key material. */
export function receptionistStatus(env: Env = process.env): ReceptionistStatus {
  const enabled = receptionistEnabled(env);
  return { enabled, configured: enabled && realtimeKey(env) !== null, limits: limitsFrom(env), model: realtimeModel(env) };
}
