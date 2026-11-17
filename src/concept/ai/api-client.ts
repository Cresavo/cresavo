import type { CostEntry } from "./cost-log";
import type { AiOverview } from "./overview";
import type { TaskName } from "./registry";

// Browser side of the AI layer: plain HTTP calls to /api/concept/ai.

export async function runAiTask<Output>(task: TaskName, input: unknown): Promise<{ output: Output; log: CostEntry; requestId: string | null }> {
  const response = await fetch(`/api/concept/ai/${task}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`AI task ${task} failed`);
  return { ...(await response.json()), requestId: response.headers.get("x-request-id") };
}

export async function fetchAiOverview(): Promise<AiOverview> {
  const response = await fetch("/api/concept/ai");
  if (!response.ok) throw new Error("AI overview failed");
  return response.json();
}

/** Recheck after settings changes, including edits in another tab. */
export function isAiConfigured(): Promise<boolean> {
  return fetchAiOverview().then(overview => overview.configured, () => false);
}
export async function saveAiSettings(settings: { provider: string; key: string } | { task: TaskName; tier: "fast" | "smart" } | null): Promise<AiOverview> {
  const response = await fetch("/api/concept/ai", {
    method: settings ? "PUT" : "DELETE", headers: { "content-type": "application/json" },
    ...(settings ? { body: JSON.stringify(settings) } : {}),
  });
  if (!response.ok) throw new Error("AI settings failed");
  window.dispatchEvent(new Event("concept-ai-settings"));
  return response.json();
}
