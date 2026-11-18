import { PORTS, type PortName } from "../core";
import { PROVIDERS } from "../providers";
import type { ResolutionReason } from "./registry";
import { createRegistry } from "./registry";

// What GET /api/concept/connections returns: per port the adapter in use and
// why, plus the provider catalogue. Secret names may appear (so an operator
// knows what to set); secret values never do.

export interface PortOverview {
  port: PortName;
  provider: string;
  kind: "simulated" | "live" | "interface";
  live: boolean;
  reason: ResolutionReason;
  selected?: string;
  missing?: string[];
  capabilities: readonly string[];
}

export interface ConnectionsOverview {
  ports: PortOverview[];
  providers: { port: PortName; provider: string; kind: string; region?: string; capabilities: readonly string[]; secrets: readonly string[] }[];
}

export async function describeConnections(business: string, registry = createRegistry()): Promise<ConnectionsOverview> {
  const ports: PortOverview[] = [];
  for (const port of PORTS) {
    const resolution = await registry.resolve(port, business);
    const { info } = resolution.adapter;
    ports.push({
      port,
      provider: info.provider,
      kind: info.kind,
      live: resolution.live,
      reason: resolution.reason,
      ...(resolution.selected ? { selected: resolution.selected } : {}),
      ...(resolution.missing ? { missing: resolution.missing } : {}),
      capabilities: info.capabilities,
    });
  }
  return {
    ports,
    providers: PROVIDERS.map(({ info }) => ({ port: info.port, provider: info.provider, kind: info.kind, ...(info.region ? { region: info.region } : {}), capabilities: info.capabilities, secrets: info.secrets })),
  };
}
