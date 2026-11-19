import { cachedGitHub } from "./github-cache";

export interface RepositorySummary {
  stars: number | null;
  /** When code was last pushed, as an ISO timestamp. */
  pushedAt: string | null;
}

export const getRepositorySummary = cachedGitHub<RepositorySummary>("", (body) => {
  const { stargazers_count: count, pushed_at: pushed } = (body ?? {}) as Record<string, unknown>;
  const stars = Number.isSafeInteger(count) && (count as number) >= 0 ? count as number : null;
  const pushedAt = typeof pushed === "string" && !Number.isNaN(Date.parse(pushed)) ? pushed : null;
  return stars === null && pushedAt === null ? null : { stars, pushedAt };
});

export async function getStarCount(): Promise<number | null> {
  return (await getRepositorySummary())?.stars ?? null;
}
