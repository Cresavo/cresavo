import { getCostLog, type CostEntry } from "./cost-log";
import { tasks, type TaskName } from "./registry";
import { routeModel, type AiEnvironment } from "./router";
import type { ModelTier } from "./task";

export interface TaskOverview {
  name: TaskName;
  tier: ModelTier;
  version: number;
  /** Null when no key is configured: the task runs its rule-based fallback. */
  provider: string | null;
  model: string | null;
}

export interface AiOverview {
  configured: boolean;
  tasks: TaskOverview[];
  /** Newest first. */
  costLog: CostEntry[];
  totals: { calls: number; aiCalls: number; costUsd: number; unknownCosts: number };
}

const LOG_ROWS = 20;

/** What the "Your data & AI" page shows: which task runs where, and what calls cost so far. */
export function describeAi(env: AiEnvironment = process.env): AiOverview {
  const overview = (Object.keys(tasks) as TaskName[]).map((name) => {
    const { tier, version } = tasks[name];
    const route = routeModel(tier, env);
    return { name, tier, version, provider: route?.provider ?? null, model: route?.model ?? null };
  });
  const log = getCostLog();
  return {
    configured: overview.some((task) => task.provider),
    tasks: overview,
    costLog: log.slice(-LOG_ROWS).reverse(),
    totals: {
      calls: log.length,
      aiCalls: log.filter((entry) => entry.source === "ai").length,
      costUsd: log.reduce((sum, entry) => sum + (entry.costUsd ?? 0), 0),
      unknownCosts: log.filter((entry) => entry.source === "ai" && entry.costUsd === null).length,
    },
  };
}
