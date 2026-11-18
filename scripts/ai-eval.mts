import { evaluationCases } from "../src/concept/ai/evals/cases.js";
import { evaluateCases } from "../src/concept/ai/evals/evaluate.js";
import { isTaskName } from "../src/concept/ai/registry.js";

const args = process.argv.slice(2);
let mode: "rules" | "live" = "rules";
let json = false;
let task: string | undefined;
try {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--live") mode = "live";
    else if (args[i] === "--json") json = true;
    else if (args[i] === "--task" && args[i + 1] && isTaskName(args[i + 1])) task = args[++i];
    else throw new Error("Usage: npm run ai:eval -- [--json] [--task <task-name>] [--live]");
  }
  const report = await evaluateCases(evaluationCases.filter(test => !task || test.task === task), { mode });
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    console.table(report.results.map(result => ({ case: result.id, task: result.task, passed: result.passed, ms: Math.round(result.durationMs * 100) / 100, model: result.log?.model ?? "none", costUsd: result.log?.costUsd ?? "unknown", failures: result.failures.join(", ") })));
    console.log(`${report.passed}/${report.total} passed (${(report.accuracy * 100).toFixed(1)}%); ${report.durationMs.toFixed(1)} ms; cost USD ${report.costUsd ?? `unknown (known subtotal ${report.knownCostUsd})`}; mode ${report.mode}.`);
  }
  if (report.passed !== report.total) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Evaluation failed");
  process.exitCode = 1;
}
