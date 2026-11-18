import type { PortName } from "../core";
import type { PortMap } from "../ports";
import { simulatedAdapters } from "../simulated/adapters";
import { createOutbox, type Outbox } from "../simulated/outbox";
import { providerDefinition, type ProviderDefinition } from "../providers";
import { configFromEnv, type ConnectionConfig } from "./config";
import type { Fetcher } from "./http";
import { envSecretStore, type SecretStore } from "./secrets";

// Picks the adapter for one port of one business, like ai/router.ts picks a
// model. Every path that is not explicitly live returns the simulated adapter,
// and the reason says why, so a settings page can explain it.

export type ResolutionReason = "public-demo" | "live-off" | "not-selected" | "unknown-provider" | "missing-secret" | "missing-setting" | "interface-only" | "live";

export interface Resolution<P extends PortName> {
  adapter: PortMap[P];
  live: boolean;
  reason: ResolutionReason;
  /** The provider that was asked for, also when it fell back. Only a known provider id, never a raw setting. */
  selected?: string;
  /** Names (never values) of secrets or settings that are missing. */
  missing?: string[];
}

export interface RegistryOptions {
  configFor?: (business: string) => ConnectionConfig;
  secrets?: SecretStore;
  fetch?: Fetcher;
  outbox?: Outbox;
}

const serverOutbox = createOutbox();

export function createRegistry(options: RegistryOptions = {}) {
  const configFor = options.configFor ?? (() => configFromEnv());
  const secrets = options.secrets ?? envSecretStore();
  const outbox = options.outbox ?? serverOutbox;
  const simulated = simulatedAdapters({ outbox });

  async function resolve<P extends PortName>(port: P, business: string): Promise<Resolution<P>> {
    const config = configFor(business);
    const choice = config.ports[port];
    const definition = choice ? (providerDefinition(port, choice.provider) as ProviderDefinition<P> | undefined) : undefined;
    // An unknown value is never echoed: it could be a credential pasted into the wrong variable.
    const fallback = (reason: ResolutionReason, extra: Partial<Resolution<P>> = {}): Resolution<P> => ({ adapter: simulated[port], live: false, reason, ...(definition ? { selected: definition.info.provider } : {}), ...extra });
    if (config.publicDemo) return fallback("public-demo");
    if (!choice) return fallback("not-selected");
    if (!config.live) return fallback("live-off");
    if (!definition) return fallback("unknown-provider");
    const values: Record<string, string> = {};
    const missing: string[] = [];
    for (const name of definition.secrets) {
      const value = await secrets.get(business, name);
      if (value) values[name] = value;
      else missing.push(name);
    }
    for (const name of definition.optionalSecrets ?? []) {
      const value = await secrets.get(business, name);
      if (value) values[name] = value;
    }
    if (missing.length) return fallback("missing-secret", { missing });
    const settings = Object.fromEntries(definition.settings.map((name) => [name, choice.settings[name]?.trim() || undefined]));
    const missingSettings = definition.missingSettings?.(settings) ?? [];
    if (missingSettings.length) return fallback("missing-setting", { missing: missingSettings });
    const adapter = definition.create({ secrets: values, settings, fetch: options.fetch ?? globalThis.fetch });
    const live = definition.info.kind === "live";
    return { adapter, live, reason: live ? "live" : "interface-only", selected: choice.provider };
  }

  return { resolve, outbox };
}
