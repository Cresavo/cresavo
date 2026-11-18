import { randomUUID } from "node:crypto";
import { DEMO_BUSINESS, readBusinessAi, updateBusinessAi } from "./demo-store";
export interface CostEntry {
  id?: string;
  task: string; version: number; model: string; provider: string; source: "ai" | "rules";
  reason?: "no-key" | "provider-error" | "invalid-output"; inputTokens: number; outputTokens: number;
  /** Demo estimate, not a billing record. Null when the model's tariff is unknown. */
  costUsd: number | null; timestamp: string;
}
export function logCost(entry: Omit<CostEntry, "timestamp">, business = DEMO_BUSINESS): CostEntry {
  const record = { ...entry, id: randomUUID(), timestamp: new Date().toISOString() };
  updateBusinessAi(business, data => { data.costs.push(record); });
  return { ...record };
}
export function getCostHistory(business = DEMO_BUSINESS): CostEntry[] { return readBusinessAi(business).costs; }
export function getCostLog(business = DEMO_BUSINESS): CostEntry[] { return getCostHistory(business).slice(-1000); }
export function clearCostLog(business = DEMO_BUSINESS): void { updateBusinessAi(business, data => { data.costs = []; }); }
export function costTotals(log: CostEntry[]) {
  return {
    calls: log.length, aiCalls: log.filter(entry => entry.source === "ai").length,
    costUsd: log.reduce((sum, entry) => sum + (entry.costUsd ?? 0), 0),
    unknownCosts: log.filter(entry => entry.costUsd === null).length,
  };
}
export function groupedCosts(log: CostEntry[], group: "task" | "month") {
  const buckets = new Map<string, CostEntry[]>();
  for (const entry of log) {
    const key = group === "task" ? entry.task : entry.timestamp.slice(0, 7);
    buckets.set(key, [...(buckets.get(key) ?? []), entry]);
  }
  return [...buckets].map(([name, entries]) => ({ name, ...costTotals(entries) }));
}
export function estimateCost(model: string, input: number, output: number): number | null {
  const rates: Record<string, [number, number]> = { "gpt-4.1-mini": [0.4, 1.6], "gpt-4.1": [2, 8], "claude-haiku-4-5": [1, 5], "claude-sonnet-4-5": [3, 15], "claude-sonnet-4": [3, 15] };
  const rate = rates[model.replace(/^(openai|anthropic)\//, "")];
  return rate ? (input * rate[0] + output * rate[1]) / 1_000_000 : null;
}
