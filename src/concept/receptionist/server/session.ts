import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { limitsFrom, type CallLimits } from "../limits";
import { realtimeModel, realtimeSession } from "../realtime-config";
import { MAX_GREETING } from "../types";

// Creates the short-lived client secret a browser test call connects with.
// The API key stays here. The secret can only start a session in the next
// minute, with the model, rules and tools this server chose.

const CLIENT_SECRETS_URL = "https://api.openai.com/v1/realtime/client_secrets";
/** Seconds the secret can be used to start a call. The call itself is ended by the call session's ceiling. */
const SECRET_SECONDS = 60;
const TIMEOUT_MS = 10_000;

/** The little the browser tells the server about the salon: what the receptionist says first, and in which language. */
export const sessionInput = z.object({
  salonName: z.string().trim().min(1).max(80),
  language: z.enum(["sv", "en"]),
  greeting: z.string().max(MAX_GREETING),
}).strict();

export type SessionInput = z.infer<typeof sessionInput>;

export interface MintedSession {
  callId: string;
  clientSecret: string;
  /** Epoch seconds after which the secret no longer starts a call. */
  expiresAt: number;
  model: string;
  limits: CallLimits;
}

export type MintResult = { ok: true; session: MintedSession } | { ok: false; reason: "provider" };

/** A stable, non-identifying label for the provider's abuse monitoring. */
const safetyIdentifier = (client: string) => createHash("sha256").update(`receptionist:${client}`).digest("hex").slice(0, 32);

export async function mintSession(
  input: SessionInput,
  options: { apiKey: string; client: string; env?: Record<string, string | undefined>; fetch?: typeof fetch },
): Promise<MintResult> {
  const env = options.env ?? process.env;
  const model = realtimeModel(env);
  const call = options.fetch ?? fetch;
  try {
    const response = await call(CLIENT_SECRETS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json", "OpenAI-Safety-Identifier": safetyIdentifier(options.client) },
      body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: SECRET_SECONDS }, session: realtimeSession({ ...input, model }) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: "provider" };
    const body = (await response.json()) as { value?: unknown; expires_at?: unknown };
    if (typeof body.value !== "string" || !body.value) return { ok: false, reason: "provider" };
    const expiresAt = typeof body.expires_at === "number" ? body.expires_at : Math.floor(Date.now() / 1000) + SECRET_SECONDS;
    return { ok: true, session: { callId: `call-${randomUUID()}`, clientSecret: body.value, expiresAt, model, limits: limitsFrom(env) } };
  } catch {
    // The provider's message could quote the request; nothing of it is passed on or logged.
    return { ok: false, reason: "provider" };
  }
}
