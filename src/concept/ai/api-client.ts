import type { CostEntry } from "./cost-log";
import type { AiOverview } from "./overview";
import type { TaskName } from "./registry";

// Browser side of the AI layer: plain HTTP calls to /api/concept/ai.

export async function runAiTask<Output>(task: TaskName, input: unknown): Promise<{ output: Output; log: CostEntry }> {
  const response = await fetch(`/api/concept/ai/${task}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`AI task ${task} failed`);
  return response.json();
}

export async function fetchAiOverview(): Promise<AiOverview> {
  const response = await fetch("/api/concept/ai");
  if (!response.ok) throw new Error("AI overview failed");
  return response.json();
}

let configured: Promise<boolean> | null = null;

/** Whether the server has an AI provider key. Asked once per page load. */
export function isAiConfigured(): Promise<boolean> {
  configured ??= fetchAiOverview().then(
    (overview) => overview.configured,
    () => {
      configured = null;
      return false;
    },
  );
  return configured;
}
