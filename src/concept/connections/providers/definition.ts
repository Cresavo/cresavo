import type { PortName } from "../core";
import type { PortMap } from "../ports";
import type { Fetcher } from "../server/http";

export interface ProviderInput {
  /** Values for `secrets` (all present) and any `optionalSecrets` that are set. */
  secrets: Record<string, string>;
  /** Only the non-secret settings the definition names. */
  settings: Record<string, string | undefined>;
  fetch: Fetcher;
}

/** One entry per real provider. See docs/integrations/README.md, "Add a new provider". */
export interface ProviderDefinition<P extends PortName = PortName> {
  info: PortMap[P]["info"] & { port: P };
  /** Required secret names; the registry falls back to simulated when one is missing. */
  secrets: readonly string[];
  optionalSecrets?: readonly string[];
  /** Non-secret configuration read from the business configuration. */
  settings: readonly string[];
  /** Names of settings still missing (e.g. a sender), so the registry does not report a provider live that cannot work. */
  missingSettings?(settings: Record<string, string | undefined>): string[];
  create(input: ProviderInput): PortMap[P];
}
