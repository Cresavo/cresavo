import { businessKey } from "./business-settings";
import { DEMO_BUSINESS, readBusinessAi } from "./demo-store";
import { z } from "zod";
import { callModel } from "./client";
import { estimateCost, logCost, type CostEntry } from "./cost-log";
import { tasks, type TaskName } from "./registry";
import { routeModel, type AiEnvironment } from "./router";
import { intentContextSchema, intentOutputSchema } from "./tasks/interpret-command";
import { hasValidIntentReferences } from "./validate-intent";

export class InvalidTaskInput extends Error {}
export async function runTask<T extends TaskName>(name: T, rawInput: unknown, options: { env?: AiEnvironment; fetcher?: typeof fetch; business?: string; useBusinessSettings?: boolean; allowProvider?: boolean } = {}): Promise<{ output: z.infer<(typeof tasks)[T]["output"]>; log: CostEntry }> {
  const task = tasks[name];
  const parsed = task.input.safeParse(rawInput);
  if (!parsed.success) throw new InvalidTaskInput("Input does not match the task schema");
  const business = options.business ?? DEMO_BUSINESS;
  const settings = options.allowProvider === false || options.useBusinessSettings === false ? null : readBusinessAi(business);
  const route = options.allowProvider === false ? null : routeModel(settings?.tiers[name] ?? task.tier, options.env, settings ? businessKey(business, options.env) : null);
  let reason: CostEntry["reason"] = "no-key";
  let inputTokens = 0; let outputTokens = 0; let costUsd: number | null = 0;
  if (route) {
    try {
      const response = await callModel(route, task.prompt, task.schema, parsed.data, options.fetcher, name === "interpret-command");
      inputTokens = response.inputTokens; outputTokens = response.outputTokens;
      costUsd = response.costUsd ?? estimateCost(route.model, inputTokens, outputTokens);
      const valid = task.output.safeParse(response.output);
      const validReferences = name !== "interpret-command" || (valid.success && hasValidIntentReferences(intentOutputSchema.parse(valid.data), intentContextSchema.parse((parsed.data as { context: unknown }).context)));
      if (valid.success && validReferences) return { output: valid.data as z.infer<(typeof tasks)[T]["output"]>, log: logCost({ task: name, version: task.version, provider: route.provider, model: route.model, source: "ai", inputTokens, outputTokens, costUsd }, business) };
      reason = "invalid-output";
    } catch { reason = "provider-error"; costUsd = null; }
  }
  // The same registry entry validates its input before its fallback is invoked.
  const output = task.output.parse(task.fallback(parsed.data as never));
  const entry = { task: name, version: task.version, provider: route?.provider ?? "rules", model: route?.model ?? "rules", source: "rules" as const, reason, inputTokens, outputTokens, costUsd };
  const log = options.allowProvider === false ? { ...entry, timestamp: new Date().toISOString() } : logCost(entry, business);
  return { output: output as z.infer<(typeof tasks)[T]["output"]>, log };
}
