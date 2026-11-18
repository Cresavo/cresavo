import type { ModelTier } from "./task";
export type Provider = "openai" | "openrouter" | "anthropic" | "compatible";
export type AiEnvironment = Record<string, string | undefined>;
export interface ModelRoute { provider: Provider; model: string; apiKey: string; tier: ModelTier; baseUrl?: string }
const keys = { openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
const models: Record<Exclude<Provider, "compatible">, Record<ModelTier, string>> = {
  openai: { fast: "gpt-4.1-mini", smart: "gpt-4.1", image: "gpt-image-1", speech: "gpt-4o-mini-transcribe" },
  openrouter: { fast: "openai/gpt-4.1-mini", smart: "anthropic/claude-sonnet-4", image: "openai/gpt-image-1", speech: "openai/gpt-4o-mini-transcribe" },
  anthropic: { fast: "claude-haiku-4-5", smart: "claude-sonnet-4-5", image: "", speech: "" },
};

/** An http(s) base URL without a trailing slash, or null. */
function baseUrlOf(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? text.replace(/\/+$/, "") : null;
  } catch { return null; }
}

/**
 * Any OpenAI-compatible server (e.g. local Ollama at http://localhost:11434/v1)
 * through CONCEPT_AI_BASE_URL. The model comes from CONCEPT_AI_<TIER>_MODEL,
 * else CONCEPT_AI_FAST_MODEL; CONCEPT_AI_API_KEY is optional. Text tiers only.
 */
function compatibleRoute(tier: ModelTier, env: AiEnvironment): ModelRoute | null {
  const baseUrl = baseUrlOf(env.CONCEPT_AI_BASE_URL);
  const model = env[`CONCEPT_AI_${tier.toUpperCase()}_MODEL`]?.trim() || env.CONCEPT_AI_FAST_MODEL?.trim();
  if (!baseUrl || !model || tier === "image" || tier === "speech") return null;
  return { provider: "compatible", model, apiKey: env.CONCEPT_AI_API_KEY?.trim() ?? "", tier, baseUrl };
}

/** CONCEPT_AI_FAST_PROVIDER / CONCEPT_AI_FAST_MODEL (and SMART/IMAGE/SPEECH) override defaults. A base URL wins over platform keys unless a provider is named. */
export function routeModel(tier: ModelTier, env: AiEnvironment = process.env, ownKey?: { provider: Provider; apiKey: string } | null): ModelRoute | null {
  if (ownKey && ownKey.provider !== "compatible") {
    const model = models[ownKey.provider][tier];
    return model ? { ...ownKey, model, tier } : null;
  }
  const preferred = env[`CONCEPT_AI_${tier.toUpperCase()}_PROVIDER`];
  if (preferred === "compatible" || (!preferred && baseUrlOf(env.CONCEPT_AI_BASE_URL))) return compatibleRoute(tier, env);
  if (preferred && !Object.hasOwn(keys, preferred)) return null;
  const providers = (preferred ? [preferred] : ["openrouter", "openai", "anthropic"]) as (keyof typeof keys)[];
  for (const provider of providers) {
    const apiKey = env[keys[provider]]?.trim();
    const model = env[`CONCEPT_AI_${tier.toUpperCase()}_MODEL`]?.trim() || models[provider][tier];
    if (apiKey && model) return { provider, model, apiKey, tier };
  }
  return null;
}
