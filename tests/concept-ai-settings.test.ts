import { mkdtempSync, readFileSync, rmSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { businessKey, removeBusinessKey, saveBusinessKey } from "@/concept/ai/business-settings";
import { DEMO_BUSINESS, readBusinessAi, updateBusinessAi } from "@/concept/ai/demo-store";
import { describeAi } from "@/concept/ai/overview";
import { groupedCosts, logCost } from "@/concept/ai/cost-log";
import { runTask } from "@/concept/ai/run-task";
import { tasks } from "@/concept/ai/registry";
import { evaluationCases } from "@/concept/ai/evals/cases";
import { evaluateCases } from "@/concept/ai/evals/evaluate";
import { DELETE, GET, PUT } from "@/app/api/concept/ai/route";

const env = { CONCEPT_KEY_SECRET: "fictional-encryption-secret-for-tests-only", OPENAI_API_KEY: "platform-fake" };
let dir: string;
beforeEach(() => {
  mkdirSync(".data", { recursive: true });
  dir = mkdtempSync(join(process.cwd(), ".data", "ai-test-"));
  vi.stubEnv("CONCEPT_AI_STORE_DIR", dir);
  vi.stubEnv("CONCEPT_KEY_SECRET", env.CONCEPT_KEY_SECRET);
  for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "PUBLIC_READONLY"]) vi.stubEnv(key, "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); rmSync(dir, { recursive: true, force: true }); });
const request = (data: unknown, origin = "http://localhost") => new Request("http://localhost/api/concept/ai", { method: "PUT", headers: { origin }, body: JSON.stringify(data) });

describe("encrypted business settings", () => {
  it("persists only AES-GCM ciphertext, binds it to a business and exposes only last four", () => {
    const key = "fictional-business-key-1234";
    saveBusinessKey(DEMO_BUSINESS, "anthropic", key, env);
    const disk = readFileSync(join(dir, `${DEMO_BUSINESS}.json`), "utf8");
    expect(disk).not.toContain(key);
    expect(statSync(join(dir, `${DEMO_BUSINESS}.json`)).mode & 0o777).toBe(0o600);
    expect(businessKey(DEMO_BUSINESS, env)).toEqual({ provider: "anthropic", apiKey: key });
    expect(describeAi(env).ownKey).toEqual({ provider: "anthropic", last4: "1234", usable: true });
    expect(JSON.stringify(describeAi(env))).not.toContain(key);
    updateBusinessAi("other-business", data => { data.key = readBusinessAi().key; });
    expect(businessKey("other-business", env)).toBeNull();
    expect(businessKey(DEMO_BUSINESS, {})).toBeNull();
    expect(businessKey(DEMO_BUSINESS, { CONCEPT_KEY_SECRET: "wrong-secret-which-is-at-least-32-characters" })).toBeNull();
    updateBusinessAi(DEMO_BUSINESS, data => { data.key!.tag = Buffer.alloc(16).toString("base64"); });
    expect(businessKey(DEMO_BUSINESS, env)).toBeNull();
  });
  it("gives the business provider priority and persists task tier overrides", async () => {
    saveBusinessKey(DEMO_BUSINESS, "anthropic", "fictional-own-key", env);
    updateBusinessAi(DEMO_BUSINESS, data => { data.tiers["reply-customer"] = "smart"; });
    const fetcher = vi.fn().mockResolvedValue(Response.json({ content: [{ type: "text", text: '{"text":"Draft only"}' }], usage: { input_tokens: 12, output_tokens: 5 } }));
    const result = await runTask("reply-customer", { customerName: "Demo", message: "Hello" }, { env, fetcher });
    expect(result.log).toMatchObject({ source: "ai", model: "claude-sonnet-4-5", provider: "anthropic" });
    expect(fetcher.mock.calls[0][1].headers["x-api-key"]).toBe("fictional-own-key");
    expect(describeAi(env).tasks.find(task => task.name === "reply-customer")?.tier).toBe("smart");
    expect(describeAi(env, "unrelated").tasks.find(task => task.name === "reply-customer")?.provider).toBe("openai");
    removeBusinessKey();
    expect(businessKey(DEMO_BUSINESS, env)).toBeNull();
    expect(describeAi(env).tasks.find(task => task.name === "reply-customer")?.provider).toBe("openai");
  });
  it("retains costs across module reloads, groups months and tasks, counts uncertain fallback charges", async () => {
    logCost({ task: "reply-customer", version: 1, model: "unknown", provider: "openai", source: "rules", reason: "provider-error", inputTokens: 0, outputTokens: 0, costUsd: null });
    updateBusinessAi(DEMO_BUSINESS, data => { data.costs[0].timestamp = "2026-10-01T12:00:00Z"; });
    logCost({ task: "write-post", version: 1, model: "known", provider: "openai", source: "ai", inputTokens: 5, outputTokens: 5, costUsd: 0.04 });
    vi.resetModules();
    const reloaded = await import("@/concept/ai/overview");
    expect(reloaded.describeAi({}).totals).toEqual({ calls: 2, aiCalls: 1, costUsd: 0.04, unknownCosts: 1 });
    expect(reloaded.describeAi({}, "other-business").totals.calls).toBe(0);
    expect(groupedCosts(readBusinessAi().costs, "month")).toContainEqual(expect.objectContaining({ name: "2026-10", calls: 1, unknownCosts: 1 }));
    expect(describeAi({}).byTask).toContainEqual(expect.objectContaining({ name: "write-post", costUsd: 0.04 }));
  });
});

describe("settings HTTP validation", () => {
  it("saves/replaces/removes keys without returning any plaintext", async () => {
    const response = await PUT(request({ provider: "openrouter", key: "fictional-key-1234" }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ownKey).toMatchObject({ provider: "openrouter", last4: "1234" });
    expect(JSON.stringify(data)).not.toContain("fictional-key");
    expect(GET().headers.get("cache-control")).toBe("no-store");
    expect((await PUT(request({ provider: "openai", key: "replaced-fake-5678" }))).status).toBe(200);
    expect((await DELETE(new Request("http://localhost/api/concept/ai", { method: "DELETE", headers: { origin: "http://localhost" } }))).status).toBe(200);
    expect(describeAi({}).ownKey).toBeNull();
  });
  it("rejects invalid providers, tasks, tiers, cross-origin mutations and missing secrets", async () => {
    for (const input of [{ provider: "evil", key: "fictional-key" }, { task: "unknown", tier: "smart" }, { task: "write-post", tier: "image" }, { provider: "openai", key: "short" }]) expect((await PUT(request(input))).status).toBe(400);
    expect((await PUT(request({ task: "write-post", tier: "smart" }, "https://evil.example"))).status).toBe(403);
    vi.stubEnv("CONCEPT_KEY_SECRET", "");
    expect((await PUT(request({ provider: "openai", key: "fictional-key" }))).status).toBe(503);
    expect((await PUT(request({ task: "write-post", tier: "smart" }))).status).toBe(200);
    vi.stubEnv("PUBLIC_READONLY", "1");
    expect((await PUT(request({ task: "write-post", tier: "fast" }))).status).toBe(403);
  });
});

it.each(["openai", "openrouter", "anthropic"] as const)("all eval tasks pass with mocked %s, including structured command calls", async provider => {
  const fetcher = vi.fn(async (_url: unknown, init: RequestInit | undefined) => {
    const body = JSON.parse(String(init?.body));
    const input = JSON.parse(body.messages.at(-1).content);
    const test = evaluationCases.find(test => JSON.stringify(tasks[test.task].input.parse(test.input)) === JSON.stringify(input))!;
    const task = tasks[test.task];
    const output = task.fallback(input as never);
    if (test.task === "interpret-command") {
      expect(body.tools).toHaveLength(1);
      expect(body.tool_choice).toBeDefined();
      return Response.json(provider === "anthropic" ? { content: [{ type: "tool_use", name: "propose_command", input: { proposal: output } }] } : { choices: [{ message: { tool_calls: [{ type: "function", function: { name: "propose_command", arguments: JSON.stringify({ proposal: output }) } }] } }] });
    }
    return Response.json(provider === "anthropic" ? { content: [{ type: "text", text: JSON.stringify(output) }] } : { choices: [{ message: { content: JSON.stringify(output) } }] });
  });
  const report = await evaluateCases(evaluationCases, { mode: "live", env: { [`${provider.toUpperCase()}_API_KEY`]: "fictional-only" }, fetcher: fetcher as typeof fetch });
  expect(report.results.filter(result => !result.passed)).toEqual([]);
  expect(fetcher).toHaveBeenCalledTimes(evaluationCases.length);
});
