import type { CostEntry } from "./cost-log";
import type { AiOverview } from "./overview";
import type { TaskName } from "./registry";

// Browser side of the AI layer: plain HTTP calls to /api/concept/ai.

/**
 * The read-only public demo (flag inlined at build, see vercel.json) refuses every
 * write, AI tasks included. Each task carries its own rule-based fallback, so the
 * browser runs that instead: the studio keeps working and nothing is sent.
 */
export const PUBLIC_DEMO = process.env.NEXT_PUBLIC_CONCEPT_PUBLIC_DEMO === "1";

async function runLocally<Output>(task: TaskName, input: unknown): Promise<{ output: Output; log: CostEntry; requestId: string | null }> {
  const { tasks } = await import("./registry");
  const definition = tasks[task];
  const output = definition.output.parse(definition.fallback(definition.input.parse(input) as never)) as Output;
  const log: CostEntry = { task, version: definition.version, provider: "rules", model: "rules", source: "rules", reason: "no-key", inputTokens: 0, outputTokens: 0, costUsd: 0, timestamp: new Date().toISOString() };
  return { output, log, requestId: null };
}

export async function runAiTask<Output>(task: TaskName, input: unknown): Promise<{ output: Output; log: CostEntry; requestId: string | null }> {
  if (PUBLIC_DEMO) return runLocally(task, input);
  const response = await fetch(`/api/concept/ai/${task}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  // A server that only reads (PUBLIC_READONLY set at runtime) answers 403: same fallback.
  if (response.status === 403) return runLocally(task, input);
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
