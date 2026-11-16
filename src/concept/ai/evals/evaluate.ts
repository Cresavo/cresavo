import { performance } from "node:perf_hooks";
import { runTask } from "../run-task";
import type { AiEnvironment } from "../router";
import type { EvaluationCase, EvaluationReport, EvaluationResult } from "./types";

function atPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => current && typeof current === "object" && Object.hasOwn(current, key) ? (current as Record<string, unknown>)[key] : undefined, value);
}
function equal(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => equal(actual[index], value));
  if (expected && typeof expected === "object") return !!actual && typeof actual === "object" && Object.entries(expected).every(([key, value]) => Object.hasOwn(actual, key) && equal((actual as Record<string, unknown>)[key], value));
  return false;
}

export function checkExpectation(test: EvaluationCase, output: unknown): string[] {
  const failures: string[] = [];
  for (const [path, value] of Object.entries(test.expected ?? {})) if (!equal(atPath(output, path), value)) failures.push(`expected:${path}`);
  for (const [path, value] of Object.entries(test.contains ?? {})) {
    const actual = atPath(output, path);
    const text = Array.isArray(actual) && actual.every(item => typeof item === "string") ? actual.join(" ") : actual;
    if (typeof text !== "string" || !text.toLowerCase().includes(value.toLowerCase())) failures.push(`contains:${path}`);
  }
  return failures;
}

export async function evaluateCases(cases: EvaluationCase[], options: { mode?: "rules" | "live"; env?: AiEnvironment; fetcher?: typeof fetch; now?: () => number } = {}): Promise<EvaluationReport> {
  if (!cases.length) throw new Error("No evaluation cases selected");
  if (new Set(cases.map(test => test.id)).size !== cases.length) throw new Error("Evaluation IDs must be unique");
  if (cases.some(test => !Object.keys(test.expected ?? {}).length && !Object.keys(test.contains ?? {}).length)) throw new Error("Each evaluation needs a semantic expectation");
  const mode = options.mode ?? "rules";
  const now = options.now ?? (() => performance.now());
  const started = now();
  const results: EvaluationResult[] = [];
  // Sequential calls keep usage predictable and avoid creating provider bursts.
  for (const test of cases) {
    const before = now();
    try {
      const result = await runTask(test.task, test.input, { env: mode === "rules" ? {} : options.env, fetcher: options.fetcher });
      const failures = checkExpectation(test, result.output);
      if (mode === "live" && result.log.source !== "ai") failures.push("unexpected-fallback");
      results.push({ id: test.id, task: test.task, passed: failures.length === 0, failures, durationMs: Math.max(0, now() - before), log: result.log });
    } catch {
      // Report only case IDs and failure categories; never payloads, prompts or provider errors.
      results.push({ id: test.id, task: test.task, passed: false, failures: ["task-error"], durationMs: Math.max(0, now() - before) });
    }
  }
  const passed = results.filter(result => result.passed).length;
  const unknownCosts = results.filter(result => !result.log || result.log.costUsd === null).length;
  const knownCostUsd = results.reduce((sum, result) => sum + (result.log?.costUsd ?? 0), 0);
  return { mode, total: results.length, passed, accuracy: passed / results.length, durationMs: Math.max(0, now() - started), costUsd: unknownCosts ? null : knownCostUsd, knownCostUsd, unknownCosts, results };
}
