import { DOMAIN_STEPS, type DomainStatus } from "../../page/domain";

async function call(method: "GET" | "POST" | "PATCH" | "DELETE", host?: string): Promise<{ enabled: boolean; status?: DomainStatus } | null> {
  try {
    const response = await fetch("/api/concept/domains", {
      method,
      headers: { "Content-Type": "application/json" },
      body: host === undefined ? undefined : JSON.stringify({ host }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { enabled?: boolean; status?: DomainStatus } | null;
    if (typeof data?.enabled !== "boolean") return null;
    return { enabled: data.enabled, status: data.status && DOMAIN_STEPS.includes(data.status) ? data.status : undefined };
  } catch {
    return null;
  }
}

export const liveDomainsEnabled = async () => (await call("GET"))?.enabled ?? null;

async function liveStatus(method: "POST" | "PATCH" | "DELETE", host: string): Promise<DomainStatus | undefined> {
  const result = await call(method, host);
  return result?.enabled ? result.status : undefined;
}

export const addLiveDomain = (host: string) => liveStatus("POST", host);
export const checkLiveDomain = (host: string) => liveStatus("PATCH", host);
export const removeLiveDomain = async (host: string) => !!await liveStatus("DELETE", host);
