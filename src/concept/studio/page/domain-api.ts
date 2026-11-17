import type { DomainStatus } from "../../page/domain";

// The studio's side of /api/concept/domains. When the live module is off the
// server says so and every call answers null: the caller then simulates.

async function call(method: "GET" | "POST" | "PATCH" | "DELETE", host?: string): Promise<{ enabled: boolean; status?: DomainStatus }> {
  try {
    const response = await fetch("/api/concept/domains", {
      method,
      headers: { "Content-Type": "application/json" },
      body: host === undefined ? undefined : JSON.stringify({ host }),
    });
    const data = (await response.json()) as { enabled?: boolean; status?: DomainStatus };
    return { enabled: !!data.enabled, status: data.status };
  } catch {
    return { enabled: false };
  }
}

export const liveDomainsEnabled = async () => (await call("GET")).enabled;
/** The real status after adding the domain, or null while domains are simulated. */
export const addLiveDomain = async (host: string) => (await call("POST", host)).status ?? null;
export const checkLiveDomain = async (host: string) => (await call("PATCH", host)).status ?? null;
export const removeLiveDomain = async (host: string) => void (await call("DELETE", host));
