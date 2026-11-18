import { DEMO_BUSINESS, readBusinessAi } from "./demo-store";
import { businessKey, canStoreKey } from "./business-settings";
import { getCostHistory, costTotals, groupedCosts, type CostEntry } from "./cost-log";
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
  keyStorageAvailable: boolean;
  ownKey: { provider: string; last4: string; usable: boolean } | null;
  byTask: ReturnType<typeof groupedCosts>;
  byMonth: ReturnType<typeof groupedCosts>;
  tasks: TaskOverview[];
  /** Newest first. */
  costLog: CostEntry[];
  totals: { calls: number; aiCalls: number; costUsd: number; unknownCosts: number };
}

const LOG_ROWS = 20;

/** What the "Your data & AI" page shows: which task runs where, and what calls cost so far. */
export function describeAi(env: AiEnvironment = process.env, business = DEMO_BUSINESS): AiOverview {
  const settings = readBusinessAi(business);
  const ownKey = businessKey(business, env);
  const overview = (Object.keys(tasks) as TaskName[]).map((name) => {
    const { version } = tasks[name];
    const tier = settings.tiers[name] ?? tasks[name].tier;
    const route = routeModel(tier, env, ownKey);
    return { name, tier, version, provider: route?.provider ?? null, model: route?.model ?? null };
  });
  const log = getCostHistory(business);
  return {
    configured: overview.some((task) => task.provider),
    tasks: overview,
    costLog: log.slice(-LOG_ROWS).reverse(),
    keyStorageAvailable: canStoreKey(env),
    ownKey: settings.key ? { provider: settings.key.provider, last4: settings.key.last4, usable: !!ownKey } : null,
    totals: costTotals(log), byTask: groupedCosts(log, "task"), byMonth: groupedCosts(log, "month"),
  };
}
