import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeModel } from "../src/concept/ai/router";
import { callModel } from "../src/concept/ai/client";
import { tasks } from "../src/concept/ai/registry";
import { InvalidTaskInput, runTask } from "../src/concept/ai/run-task";
import { clearCostLog, estimateCost, getCostLog, logCost } from "../src/concept/ai/cost-log";
import { validateOutput } from "../src/concept/ai/task";
import { POST } from "../src/app/api/concept/ai/[task]/route";

const inputs = {
  "interpret-command": { text: "Order more foot cream", context: { customers: [], staff: [], services: [], bookings: [], now: "2026-11-17T09:00:00Z" } },
  "structure-journal": { transcript: "Foot treatment completed. Observed dry skin. Recommend cream. Next visit in six weeks." },
  "write-post": { offer: "20% off massage", channel: "instagram" },
  "suggest-campaign": { occasion: "Father's Day", service: "Massage", priceSek: 800 },
  "stock-forecast": { product: "Foot cream", quantity: 10, dailyUsage: 2, leadTimeDays: 3 },
  "reply-customer": { customerName: "Anna", message: "Can I book tomorrow?" },
  "daily-summary": { revenueSek: 2400, visits: 4, noShows: 1, newCustomers: 2, missingJournals: 1, tomorrowFirstCustomer: "Erik" },
  "answer-help": { question: "How do I book a customer?", articles: [{ id: "new-booking", title: "Book a customer by hand", keywords: ["new booking", "book a customer"], body: "Open Calendar and tap New booking." }, { id: "stock", title: "Stock", keywords: ["order products"], body: "Stock shows what is left." }] },
  "assistant-reply": { message: "How did last month compare with last year?", draft: "Revenue last month: +8%.", facts: ["+8%"], thread: [], memory: ["Lena Berg prefers Erik"] },
  "phrase-brief": { kind: "morning", items: [{ id: "bookings", text: "8 bookings today.", priority: 4 }, { id: "inbox", text: "2 customers wait.", priority: 5 }] },
  "summarize-customer": { sinceYear: 2024, regular: true, visits: 9, service: "Medical foot care", intervalWeeks: 6, traits: ["sensitive skin"], prefersStaff: "Anna", timeOfDay: "afternoons", note: null },
} as const;
const names = Object.keys(tasks) as (keyof typeof tasks)[];
beforeEach(() => clearCostLog());
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("model router", () => {
  it.each(["fast", "smart", "image", "speech"] as const)("no key: %s", tier => expect(routeModel(tier, {})).toBeNull());
  it.each(["openai", "openrouter", "anthropic"] as const)("routes %s", provider => {
    const route = routeModel("fast", { [`${provider.toUpperCase()}_API_KEY`]: "fake" });
    expect(route).toMatchObject({ provider, tier: "fast", apiKey: "fake" });
  });
  it("prefers OpenRouter", () => expect(routeModel("smart", { OPENROUTER_API_KEY: "a", OPENAI_API_KEY: "b", ANTHROPIC_API_KEY: "c" })?.provider).toBe("openrouter"));
  it("overrides provider and model in one place", () => expect(routeModel("smart", { CONCEPT_AI_SMART_PROVIDER: "anthropic", CONCEPT_AI_SMART_MODEL: "custom", ANTHROPIC_API_KEY: "fake" })).toMatchObject({ provider: "anthropic", model: "custom" }));
  it("does not silently change an explicit unavailable provider", () => expect(routeModel("fast", { CONCEPT_AI_FAST_PROVIDER: "anthropic", OPENAI_API_KEY: "fake" })).toBeNull());
  it("rejects invalid provider", () => expect(routeModel("fast", { CONCEPT_AI_FAST_PROVIDER: "__proto__", OPENAI_API_KEY: "fake" })).toBeNull());
  it("ignores blank keys", () => expect(routeModel("fast", { OPENAI_API_KEY: " " })).toBeNull());
  it.each(["image", "speech"] as const)("Anthropic has no %s model", tier => expect(routeModel(tier, { ANTHROPIC_API_KEY: "fake" })).toBeNull());
});

describe("task contracts and deterministic rules", () => {
  it.each(names)("%s has a versioned prompt, schema and valid fallback", async name => {
    const fetcher = vi.fn();
    const result = await runTask(name, inputs[name], { env: {}, fetcher });
    expect(tasks[name].version).toBe(name === "daily-summary" ? 2 : 1);
    expect(tasks[name].prompt.length).toBeGreaterThan(40);
    expect(tasks[name].schema).toHaveProperty("$schema");
    expect(validateOutput(tasks[name].output, result.output).success).toBe(true);
    expect(result.log).toMatchObject({ task: name, source: "rules", costUsd: 0, reason: "no-key" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await runTask(name, inputs[name], { env: {} })).toMatchObject({ output: result.output });
  });
  it.each(names)("%s rejects invalid input before fetch", async name => {
    const fetcher = vi.fn();
    await expect(runTask(name, {}, { env: { OPENAI_API_KEY: "fake" }, fetcher })).rejects.toBeInstanceOf(InvalidTaskInput);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(names)("%s rejects invalid output", name => expect(validateOutput(tasks[name].output, { injected: true }).success).toBe(false));
  it("forecasts reorder quantity", async () => expect((await runTask("stock-forecast", inputs["stock-forecast"], { env: {} })).output).toMatchObject({ daysRemaining: 5, orderQuantity: 10 }));
  it("handles zero usage", async () => expect((await runTask("stock-forecast", { ...inputs["stock-forecast"], dailyUsage: 0 }, { env: {} })).output).toMatchObject({ daysRemaining: null, orderQuantity: 0 }));
  it("preserves dictated facts and no fabricated diagnosis", async () => expect((await runTask("structure-journal", inputs["structure-journal"], { env: {} })).output).toEqual({ treatment: "Foot treatment completed.", observations: "Observed dry skin.", recommendation: "Recommend cream.", nextVisit: "Next visit in six weeks." }));
  it("files sentences with body-part words under treatment when they describe the work done (#9)", async () => {
    const { output } = await runTask("structure-journal", { transcript: "Treated both feet and removed hard skin from the heels. Trimmed the nails. Noticed a dry heel." }, { env: {} });
    expect(output).toMatchObject({ treatment: "Treated both feet and removed hard skin from the heels. Trimmed the nails.", observations: "Noticed a dry heel." });
  });
  it("handles a day with no next booking", async () => expect((await runTask("daily-summary", { ...inputs["daily-summary"], tomorrowFirstCustomer: null }, { env: {} })).output.highlights).toContain("No bookings tomorrow."));
});

describe("provider clients", () => {
  it.each(["openai", "openrouter", "anthropic"] as const)("mocked %s transport and usage", async provider => {
    const route = routeModel("fast", { [`${provider.toUpperCase()}_API_KEY`]: "fake-only" })!;
    const payload = provider === "anthropic" ? { content: [{ type: "text", text: '{"text":"Draft"}' }], usage: { input_tokens: 20, output_tokens: 10 } } : { choices: [{ message: { content: '{"text":"Draft"}' } }], usage: { prompt_tokens: 20, completion_tokens: 10 } };
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload));
    expect(await callModel(route, "Write JSON", {}, {}, fetcher)).toMatchObject({ output: { text: "Draft" }, inputTokens: 20, outputTokens: 10 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain(provider === "anthropic" ? "api.anthropic.com" : provider === "openrouter" ? "openrouter.ai" : "api.openai.com");
    expect(JSON.parse(init.body).model).toBe(route.model);
    expect(init.headers[provider === "anthropic" ? "x-api-key" : "Authorization"]).toContain("fake-only");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
  it.each(["http", "network", "json", "schema", "empty"])("falls back on %s errors", async failure => {
    const fetcher = vi.fn();
    if (failure === "network") fetcher.mockRejectedValue(new Error("fake-key-do-not-log"));
    else if (failure === "http") fetcher.mockResolvedValue(new Response("secret error", { status: 429 }));
    else fetcher.mockResolvedValue(Response.json({ choices: [{ message: { content: failure === "json" ? "not JSON" : failure === "schema" ? '{"wrong":true}' : null } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }));
    const result = await runTask("reply-customer", inputs["reply-customer"], { env: { OPENAI_API_KEY: "fake-key-do-not-log" }, fetcher });
    expect(result.log.source).toBe("rules");
    expect(result.log.reason).toBe(failure === "schema" ? "invalid-output" : "provider-error");
    expect(result.output.text).toContain("Hello Anna");
    expect(JSON.stringify(getCostLog())).not.toContain("fake-key-do-not-log");
    if (failure === "schema") expect(result.log.costUsd).toBeGreaterThan(0);
  });
  it("accepts valid AI output and logs provider-reported cost", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"text":"Hello Anna, here is a suggestion."}' } }], usage: { prompt_tokens: 20, completion_tokens: 10, cost: 0.002 } }));
    const result = await runTask("reply-customer", inputs["reply-customer"], { env: { OPENROUTER_API_KEY: "fake" }, fetcher });
    expect(result.log).toMatchObject({ source: "ai", costUsd: 0.002, inputTokens: 20, outputTokens: 10 });
  });
  it.each([
    { action: "book", params: {}, summary: "Book", confidence: 1 },
    { action: "cancel", params: { bookingId: "invented" }, summary: "Cancel", confidence: 1 },
    { action: "revenue", params: { start: "2026-12-01", end: "2026-11-01" }, summary: "Revenue", confidence: 1 },
  ])("rejects incomplete or invented intent: $action", async output => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { tool_calls: [{ type: "function", function: { name: "propose_command", arguments: JSON.stringify({ proposal: output }) } }] } }] }));
    const result = await runTask("interpret-command", inputs["interpret-command"], { env: { OPENAI_API_KEY: "fake" }, fetcher });
    expect(result.log.reason).toBe("invalid-output"); expect(result.output.action).toBe("order-stock");
  });
});

describe("cost log", () => {
  it("estimates known tariffs and marks unknown ones", () => { expect(estimateCost("gpt-4.1-mini", 1_000_000, 1_000_000)).toBe(2); expect(estimateCost("custom", 1, 1)).toBeNull(); });
  it("bounds memory and returns copies", () => {
    for (let i = 0; i < 1002; i++) logCost({ task: String(i), version: 1, model: "rules", provider: "rules", source: "rules", inputTokens: 0, outputTokens: 0, costUsd: 0 });
    const log = getCostLog(); expect(log).toHaveLength(1000); expect(log[0].task).toBe("2"); log[0].task = "mutated"; expect(getCostLog()[0].task).toBe("2");
  });
});

describe("HTTP task route", () => {
  const invoke = (task: string, body: string) => POST(new Request("http://localhost/api/concept/ai/" + task, { method: "POST", body }), { params: Promise.resolve({ task }) });
  beforeEach(() => { for (const key of ["OPENAI_API_KEY", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY"]) vi.stubEnv(key, ""); });
  it("returns a validated fallback with no keys", async () => { const response = await invoke("write-post", JSON.stringify(inputs["write-post"])); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ log: { source: "rules", costUsd: 0 } }); });
  it("returns 404 for unknown tasks", async () => expect((await invoke("constructor", "{}")).status).toBe(404));
  it("returns 400 for malformed JSON", async () => expect((await invoke("write-post", "{")).status).toBe(400));
  it("returns 400 for invalid task input", async () => expect((await invoke("write-post", "{}")).status).toBe(400));
});
