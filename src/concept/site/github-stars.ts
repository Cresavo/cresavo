import { PROJECT_REPOSITORY } from "../brand";

const apiUrl = "https://api.github.com/repos" + new URL(PROJECT_REPOSITORY).pathname;
const hour = 60 * 60 * 1000;
let cached: { count: number | null; expires: number } | undefined;
let pending: Promise<number | null> | undefined;

async function fetchCount(): Promise<number | null> {
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return null;
    const { stargazers_count: count } = await response.json();
    return Number.isSafeInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

export function getStarCount(): Promise<number | null> {
  if (cached && Date.now() < cached.expires) return Promise.resolve(cached.count);
  pending ??= fetchCount().then((count) => {
    // Give transient failures a short cooldown so each visit needn't wait for GitHub.
    cached = { count, expires: Date.now() + (count === null ? 60_000 : hour) };
    pending = undefined;
    return count;
  });
  return pending;
}
