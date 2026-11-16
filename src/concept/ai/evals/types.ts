import type { CostEntry } from "../cost-log";
import type { TaskName } from "../registry";

export interface EvaluationCase {
  id: string;
  task: TaskName;
  input: unknown;
  /** Dot paths map to expected values; strings in contains are matched case-insensitively. */
  expected?: Record<string, unknown>;
  contains?: Record<string, string>;
}
export interface EvaluationResult {
  id: string; task: TaskName; passed: boolean; durationMs: number;
  failures: string[]; log?: CostEntry;
}
export interface EvaluationReport {
  mode: "rules" | "live";
  total: number; passed: number; accuracy: number; durationMs: number;
  /** Null if any provider charge is unknown. knownCostUsd is only the known subtotal. */
  costUsd: number | null; knownCostUsd: number; unknownCosts: number;
  results: EvaluationResult[];
}
