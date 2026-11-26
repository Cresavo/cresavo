import { pairingDb } from "../../pairing/db";
import { realtimeKey } from "../server/config";
import { webCallEnabled, webCallLimits } from "./config";
import { ledgerFor, type CallLedger, type SqlClient } from "./ledger";
import { tokenSecret } from "./page-token";

// What a web-call request needs from the deployment, in one place: the switch,
// the API key, the token secret and the ledger. Server only.

type Env = Record<string, string | undefined>;

export interface WebCallRuntime {
  apiKey: string;
  secret: string;
  ledger: CallLedger;
}

/** Why the web call cannot run here. "off" is the kill switch; the others are missing configuration. */
export type Unavailable = "off" | "no_key" | "no_secret" | "no_store";

export function webCallRuntime(env: Env = process.env): WebCallRuntime | Unavailable {
  if (!webCallEnabled(env)) return "off";
  const apiKey = realtimeKey(env);
  if (!apiKey) return "no_key";
  const secret = tokenSecret(env);
  if (!secret) return "no_secret";
  const ledger = ledgerFor(env, () => pairingDb() as unknown as SqlClient);
  if (!ledger) return "no_store";
  return { apiKey, secret, ledger };
}

/** The runtime with the switch ignored: used to hang up running calls once the switch is turned off. */
export function cleanupRuntime(env: Env = process.env): WebCallRuntime | null {
  const runtime = webCallRuntime({ ...env, PHONE_RECEPTIONIST_ENABLED: "1", PHONE_RECEPTIONIST_WEB_CALL: "1" });
  return typeof runtime === "string" ? null : runtime;
}

/** What the page may know. No key material. */
export interface WebCallStatus {
  available: boolean;
  reason?: Unavailable;
  maxSeconds: number;
}

export function webCallStatus(env: Env = process.env): WebCallStatus {
  const runtime = webCallRuntime(env);
  const maxSeconds = webCallLimits(env).maxSeconds;
  return typeof runtime === "string" ? { available: false, reason: runtime, maxSeconds } : { available: true, maxSeconds };
}
