// The ceiling of one call. Whoever holds the audio connection enforces it: the
// browser for a test call, the server once a phone transport is connected.

export interface CallLimits {
  maxSeconds: number;
  maxCostUsd: number;
}

export const DEFAULT_LIMITS: CallLimits = { maxSeconds: 300, maxCostUsd: 0.5 };

/** Seconds before the time limit at which the receptionist is asked to round off. */
export const WRAP_UP_SECONDS = 25;
/** Share of the cost limit at which she is asked to round off. */
export const WRAP_UP_COST_SHARE = 0.85;

function bounded(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return value && Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

/** PHONE_RECEPTIONIST_MAX_SECONDS (30 to 900) and PHONE_RECEPTIONIST_MAX_COST_USD (0.05 to 5) replace the defaults. */
export function limitsFrom(env: Record<string, string | undefined>): CallLimits {
  return {
    maxSeconds: Math.round(bounded(env.PHONE_RECEPTIONIST_MAX_SECONDS, DEFAULT_LIMITS.maxSeconds, 30, 900)),
    maxCostUsd: bounded(env.PHONE_RECEPTIONIST_MAX_COST_USD, DEFAULT_LIMITS.maxCostUsd, 0.05, 5),
  };
}

/** Token counts of one model response, as the Realtime API reports them in `response.done`. */
export interface RealtimeUsage {
  input_token_details?: { text_tokens?: number; audio_tokens?: number; cached_tokens?: number; cached_tokens_details?: { text_tokens?: number; audio_tokens?: number } };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}

/** USD per million tokens. */
export interface Rates {
  textIn: number;
  textCachedIn: number;
  textOut: number;
  audioIn: number;
  audioCachedIn: number;
  audioOut: number;
}

// List prices of the mini model when this was written; an estimate for the
// call ceiling and the owner's overview, not the bill. Transcription of the
// caller's speech is billed separately and is not counted here.
const MINI_RATES: Rates = { textIn: 0.6, textCachedIn: 0.06, textOut: 2.4, audioIn: 10, audioCachedIn: 0.3, audioOut: 20 };
// The full models (gpt-realtime-2, gpt-realtime-2.1), list prices on 26 Nov 2026.
const FULL_RATES: Rates = { textIn: 4, textCachedIn: 0.4, textOut: 24, audioIn: 32, audioCachedIn: 0.4, audioOut: 64 };

/** The list prices of a Realtime model: the mini rates for a mini model, the full ones otherwise (the safe side). */
export function ratesFor(model: string): Rates {
  return /mini/.test(model) ? MINI_RATES : FULL_RATES;
}

const count = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

/** Estimated USD cost of one response; 0 when no usage was reported. */
export function estimateResponseCost(usage: RealtimeUsage | undefined, rates: Rates = MINI_RATES): number {
  if (!usage) return 0;
  const input = usage.input_token_details ?? {};
  const cachedText = count(input.cached_tokens_details?.text_tokens);
  const cachedAudio = count(input.cached_tokens_details?.audio_tokens);
  const text = Math.max(0, count(input.text_tokens) - cachedText);
  const audio = Math.max(0, count(input.audio_tokens) - cachedAudio);
  const output = usage.output_token_details ?? {};
  const total =
    text * rates.textIn + cachedText * rates.textCachedIn + audio * rates.audioIn + cachedAudio * rates.audioCachedIn +
    count(output.text_tokens) * rates.textOut + count(output.audio_tokens) * rates.audioOut;
  return total / 1_000_000;
}
