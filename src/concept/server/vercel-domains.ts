import { checkDomain, type DomainStatus } from "../page/domain";

// Own domains for real: adds the business's domain to the Vercel project and
// reads back whether its DNS record and certificate are in place. Off unless
// CONCEPT_DOMAINS_ENABLED=1 and the three Vercel variables are set; the demo
// simulates the same three statuses. The token is only ever sent to Vercel
// in an Authorization header: it is not logged, returned or put in an error.

const API = "https://api.vercel.com";
const TIMEOUT_MS = 8000;

export interface DomainsConfig {
  token: string;
  projectId: string;
  teamId?: string;
}

export type DomainsEnv = Record<string, string | undefined>;

export type DomainsResult =
  | { ok: true; status: DomainStatus }
  | { ok: false; error: "disabled" | "invalid" | "rejected" | "unavailable" };

type Fetch = typeof fetch;

export function domainsConfig(env: DomainsEnv = process.env): DomainsConfig | null {
  const token = env.VERCEL_API_TOKEN;
  const projectId = env.VERCEL_PROJECT_ID;
  if (env.CONCEPT_DOMAINS_ENABLED !== "1" || !token || !projectId) return null;
  return { token, projectId, teamId: env.VERCEL_TEAM_ID || undefined };
}

/** Misconfigured DNS wins; a found record without a finished verification is still "verifying". */
export function statusFrom(domain: { verified?: boolean }, config: { misconfigured?: boolean }): DomainStatus {
  if (config.misconfigured !== false) return "waiting-dns";
  return domain.verified ? "secure" : "verifying";
}

interface Reply {
  status: number;
  body: { verified?: boolean; misconfigured?: boolean };
}

async function call(config: DomainsConfig, fetchImpl: Fetch, method: string, path: string, body?: unknown): Promise<Reply | null> {
  const query = config.teamId ? `?${new URLSearchParams({ teamId: config.teamId })}` : "";
  try {
    const response = await fetchImpl(`${API}${path}${query}`, {
      method,
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } catch {
    return null;
  }
}

const failure = (reply: Reply | null): DomainsResult => ({ ok: false, error: !reply || reply.status >= 500 ? "unavailable" : "rejected" });

const project = (config: DomainsConfig, host: string) => `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(host)}`;

async function readStatus(config: DomainsConfig, fetchImpl: Fetch, host: string): Promise<DomainsResult> {
  const domain = await call(config, fetchImpl, "GET", project(config, host));
  if (!domain || domain.status >= 400) return failure(domain);
  const dns = await call(config, fetchImpl, "GET", `/v6/domains/${encodeURIComponent(host)}/config`);
  if (!dns || dns.status >= 400) return failure(dns);
  return { ok: true, status: statusFrom(domain.body, dns.body) };
}

function prepare(env: DomainsEnv, input: string): { config: DomainsConfig; host: string } | DomainsResult {
  const config = domainsConfig(env);
  if (!config) return { ok: false, error: "disabled" };
  const check = checkDomain(input);
  return check.ok ? { config, host: check.host } : { ok: false, error: "invalid" };
}

/** Adds the domain to the project and reports where it stands. A conflict is read as "already added": if the domain belongs to someone else, reading its status is refused. */
export async function connectDomain(input: string, env: DomainsEnv = process.env, fetchImpl: Fetch = fetch): Promise<DomainsResult> {
  const ready = prepare(env, input);
  if ("ok" in ready) return ready;
  const added = await call(ready.config, fetchImpl, "POST", `/v10/projects/${encodeURIComponent(ready.config.projectId)}/domains`, { name: ready.host });
  const alreadyThere = added?.status === 409;
  if (!added || (added.status >= 400 && !alreadyThere)) return failure(added);
  return readStatus(ready.config, fetchImpl, ready.host);
}

export async function domainStatus(input: string, env: DomainsEnv = process.env, fetchImpl: Fetch = fetch): Promise<DomainsResult> {
  const ready = prepare(env, input);
  return "ok" in ready ? ready : readStatus(ready.config, fetchImpl, ready.host);
}

export async function disconnectDomain(input: string, env: DomainsEnv = process.env, fetchImpl: Fetch = fetch): Promise<DomainsResult> {
  const ready = prepare(env, input);
  if ("ok" in ready) return ready;
  const removed = await call(ready.config, fetchImpl, "DELETE", project(ready.config, ready.host));
  return removed && removed.status < 400 ? { ok: true, status: "waiting-dns" } : failure(removed);
}
