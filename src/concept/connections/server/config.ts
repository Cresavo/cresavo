import { PORTS, type PortName } from "../core";

// Which adapter each business uses. Today one configuration comes from the
// environment (a self-hoster runs one business); later a per-business row in
// the database (goal 11) returns the same shape.

export type Env = Record<string, string | undefined>;

export interface PortChoice {
  provider: string;
  /** Non-secret settings, e.g. a sender number. Secrets never go here. */
  settings: Record<string, string | undefined>;
}

export interface ConnectionConfig {
  /** Master switch. Off: every port is simulated whatever is selected. */
  live: boolean;
  /** Forced simulation for the public demo; wins over everything. */
  publicDemo: boolean;
  ports: Partial<Record<PortName, PortChoice>>;
}

export const LIVE_FLAG = "CONCEPT_CONNECTIONS_LIVE";
export const providerVariable = (port: PortName) => `CONCEPT_${port.toUpperCase()}_PROVIDER`;

// Read directly so Next inlines the build-time value (vercel.json sets it in the build command):
// no runtime setting, such as PUBLIC_READONLY=0, can turn a public-demo build live.
const PUBLIC_DEMO_BUILD = process.env.NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO === "1";

/** The public demo build or a read-only deployment never sends anything real. */
export function isPublicDemo(env: Env): boolean {
  return PUBLIC_DEMO_BUILD || env.NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO === "1" || env.PUBLIC_READONLY === "1";
}

export function configFromEnv(env: Env = process.env): ConnectionConfig {
  const ports: ConnectionConfig["ports"] = {};
  for (const port of PORTS) {
    const provider = env[providerVariable(port)]?.trim().toLowerCase();
    if (provider && provider !== "simulated") ports[port] = { provider, settings: env };
  }
  return { live: env[LIVE_FLAG] === "1", publicDemo: isPublicDemo(env), ports };
}
