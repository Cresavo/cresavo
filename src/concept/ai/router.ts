import type { ModelTier } from "./task";
export type Provider = "openai" | "openrouter" | "anthropic";
export type AiEnvironment = Record<string, string | undefined>;
export interface ModelRoute { provider: Provider; model: string; apiKey: string; tier: ModelTier }
const keys = { openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
const models: Record<Provider, Record<ModelTier, string>> = {
  openai: { fast: "gpt-4.1-mini", smart: "gpt-4.1", image: "gpt-image-1", speech: "gpt-4o-mini-transcribe" },
  openrouter: { fast: "openai/gpt-4.1-mini", smart: "anthropic/claude-sonnet-4", image: "openai/gpt-image-1", speech: "openai/gpt-4o-mini-transcribe" },
  anthropic: { fast: "claude-haiku-4-5", smart: "claude-sonnet-4-5", image: "", speech: "" },
};
/** CONCEPT_AI_FAST_PROVIDER / CONCEPT_AI_FAST_MODEL (and SMART/IMAGE/SPEECH) override defaults. */
export function routeModel(tier: ModelTier, env: AiEnvironment = process.env, ownKey?: { provider: Provider; apiKey: string } | null): ModelRoute | null {
  if (ownKey) {
    const model = models[ownKey.provider][tier];
    return model ? { ...ownKey, model, tier } : null;
  }
  const preferred = env[`CONCEPT_AI_${tier.toUpperCase()}_PROVIDER`];
  if (preferred && !Object.hasOwn(keys, preferred)) return null;
  const providers: Provider[] = preferred ? [preferred as Provider] : ["openrouter", "openai", "anthropic"];
  for (const provider of providers) {
    const apiKey = env[keys[provider]]?.trim();
    const model = env[`CONCEPT_AI_${tier.toUpperCase()}_MODEL`]?.trim() || models[provider][tier];
    if (apiKey && model) return { provider, model, apiKey, tier };
  }
  return null;
}
