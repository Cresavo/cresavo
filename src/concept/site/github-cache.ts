import { PROJECT_REPOSITORY } from "../brand";

const apiUrl = "https://api.github.com/repos" + new URL(PROJECT_REPOSITORY).pathname;
const hour = 60 * 60 * 1000;

/**
 * Reads one public GitHub API path for the product site, shares in-flight requests and caches the answer
 * for an hour. Failures give `null` with a short cooldown so each visit needn't wait for GitHub.
 */
export function cachedGitHub<T>(path: string, parse: (body: unknown) => T | null): () => Promise<T | null> {
  let cached: { value: T | null; expires: number } | undefined;
  let pending: Promise<T | null> | undefined;
  async function load(): Promise<T | null> {
    try {
      const response = await fetch(apiUrl + path, { signal: AbortSignal.timeout(2000) });
      return response.ok ? parse(await response.json()) : null;
    } catch {
      return null;
    }
  }
  return () => {
    if (cached && Date.now() < cached.expires) return Promise.resolve(cached.value);
    pending ??= load().then((value) => {
      cached = { value, expires: Date.now() + (value === null ? 60_000 : hour) };
      pending = undefined;
      return value;
    });
    return pending;
  };
}
