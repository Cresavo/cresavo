export interface CostEntry {
  task: string; version: number; model: string; provider: string; source: "ai" | "rules";
  reason?: "no-key" | "provider-error" | "invalid-output"; inputTokens: number; outputTokens: number;
  /** Demo estimate, not a billing record. Null when the model's tariff is unknown. */
  costUsd: number | null; timestamp: string;
}
const entries: CostEntry[] = [];
export function logCost(entry: Omit<CostEntry, "timestamp">): CostEntry {
  const record = { ...entry, timestamp: new Date().toISOString() };
  entries.push(record);
  if (entries.length > 1000) entries.shift();
  return { ...record };
}
export function getCostLog(): CostEntry[] { return entries.map(entry => ({ ...entry })); }
export function clearCostLog(): void { entries.length = 0; }
export function estimateCost(model: string, input: number, output: number): number | null {
  const rates: Record<string, [number, number]> = { "gpt-4.1-mini": [0.4, 1.6], "gpt-4.1": [2, 8], "claude-haiku-4-5": [1, 5], "claude-sonnet-4-5": [3, 15], "claude-sonnet-4": [3, 15] };
  const rate = rates[model.replace(/^(openai|anthropic)\//, "")];
  return rate ? (input * rate[0] + output * rate[1]) / 1_000_000 : null;
}
