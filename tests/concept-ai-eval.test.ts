import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { evaluationCases } from "../src/concept/ai/evals/cases";
import { checkExpectation, evaluateCases } from "../src/concept/ai/evals/evaluate";
import { tasks } from "../src/concept/ai/registry";
import type { EvaluationCase } from "../src/concept/ai/evals/types";

const replyCase: EvaluationCase = { id: "reply", task: "reply-customer", input: { customerName: "Anna", message: "When do you close?", facts: "We close at 17:00." }, contains: { text: "17:00" } };

describe("semantic evaluation cases", () => {
  it("covers every task with valid inputs and unique case IDs", () => {
    expect(new Set(evaluationCases.map(test => test.task))).toEqual(new Set(Object.keys(tasks)));
    expect(new Set(evaluationCases.map(test => test.id)).size).toBe(evaluationCases.length);
    for (const test of evaluationCases) expect(tasks[test.task].input.safeParse(test.input).success).toBe(true);
  });
  it.each(evaluationCases)("rules pass $id", async test => {
    const fetcher = vi.fn().mockRejectedValue(new Error("Network calls forbidden in rules mode"));
    const report = await evaluateCases([test], { env: { OPENAI_API_KEY: "fake-not-to-be-used" }, fetcher });
    expect(report).toMatchObject({ total: 1, passed: 1, accuracy: 1, mode: "rules", costUsd: 0, unknownCosts: 0 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports numerical mismatches without customer text", () => {
    const test = { ...replyCase, expected: { "params.priceSek": 640 } };
    expect(checkExpectation(test, { params: { priceSek: 641 }, text: "17:00" })).toEqual(["expected:params.priceSek"]);
  });
  it("checks array length and nested semantic objects", () => {
    const test = { ...replyCase, contains: {}, expected: { highlights: ["a", "b"], proposal: { action: "book" } } };
    expect(checkExpectation(test, { highlights: ["a"], proposal: { action: "cancel" } })).toEqual(["expected:highlights", "expected:proposal"]);
    expect(checkExpectation(test, { highlights: ["a", "b"], proposal: { action: "book", summary: "Allowed extra field" } })).toEqual([]);
  });
  it("checks case-insensitive strings and string arrays", () => expect(checkExpectation({ ...replyCase, contains: { text: "anna", highlights: "ERIK" } }, { text: "Hello Anna", highlights: ["Tomorrow starts with Erik"] })).toEqual([]));
  it("does not coerce non-text values or match inherited paths", () => {
    expect(checkExpectation(replyCase, { text: 1700 })).toEqual(["contains:text"]);
    expect(checkExpectation({ ...replyCase, contains: {}, expected: { "constructor.name": "Object" } }, {})).toEqual(["expected:constructor.name"]);
  });
});

describe("evaluation execution and billing", () => {
  it("reports accuracy and nonnegative timings", async () => {
    let tick = 0;
    const report = await evaluateCases([replyCase, { ...replyCase, id: "wrong", expected: { text: "Wrong" } }], { now: () => tick++ });
    expect(report).toMatchObject({ total: 2, passed: 1, accuracy: 0.5, durationMs: 5 });
    expect(report.results.map(result => result.durationMs)).toEqual([1, 1]);
  });
  it("live mode accepts mocked valid provider output and its cost", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"text":"We close at 17:00."}' } }], usage: { cost: 0.004, prompt_tokens: 10, completion_tokens: 10 } }));
    const report = await evaluateCases([replyCase], { mode: "live", env: { OPENAI_API_KEY: "fake" }, fetcher });
    expect(report).toMatchObject({ passed: 1, costUsd: 0.004, knownCostUsd: 0.004, unknownCosts: 0 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("live mode never counts fallback as a successful model evaluation", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("provider payload must stay private"));
    const report = await evaluateCases([replyCase], { mode: "live", env: { OPENAI_API_KEY: "fake-secret" }, fetcher });
    expect(report).toMatchObject({ passed: 0, costUsd: null, knownCostUsd: 0, unknownCosts: 1 });
    expect(report.results[0].failures).toEqual(["unexpected-fallback"]);
    expect(JSON.stringify(report)).not.toMatch(/fake-secret|provider payload|When do you close/);
  });
  it("live mode without a key fails visibly without making requests", async () => {
    const fetcher = vi.fn();
    const report = await evaluateCases([replyCase], { mode: "live", env: {}, fetcher });
    expect(report).toMatchObject({ passed: 0, accuracy: 0, costUsd: 0 });
    expect(report.results[0].failures).toContain("unexpected-fallback"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not label unknown model prices as free", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"text":"17:00"}' } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
    const report = await evaluateCases([replyCase], { mode: "live", env: { OPENAI_API_KEY: "fake", CONCEPT_AI_FAST_MODEL: "custom" }, fetcher });
    expect(report).toMatchObject({ passed: 1, costUsd: null, knownCostUsd: 0, unknownCosts: 1 });
  });
  it("continues after an invalid case without leaking its input", async () => {
    const report = await evaluateCases([{ ...replyCase, id: "bad", input: { private: "do-not-print" } }, replyCase]);
    expect(report).toMatchObject({ total: 2, passed: 1 });
    expect(report.results[0].failures).toEqual(["task-error"]); expect(JSON.stringify(report)).not.toContain("do-not-print");
  });
  it("rejects empty selections, duplicate IDs and assertion-free cases", async () => {
    await expect(evaluateCases([])).rejects.toThrow("No evaluation cases");
    await expect(evaluateCases([replyCase, replyCase])).rejects.toThrow("unique");
    await expect(evaluateCases([{ ...replyCase, contains: undefined }])).rejects.toThrow("semantic expectation");
  });
});

describe("evaluation CLI", () => {
  it("exports JSON and selects one task without using configured keys", () => {
    const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/ai-eval.mts", "--task", "stock-forecast", "--json"], { encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "fake-never-used" }, timeout: 15000 });
    const report = JSON.parse(output);
    expect(report).toMatchObject({ total: 3, passed: 3, mode: "rules", costUsd: 0 });
    expect(output).not.toContain("fake-never-used");
  });
  it("returns nonzero for invalid arguments", () => {
    const child = spawnSync(process.execPath, ["--import", "tsx", "scripts/ai-eval.mts", "--task", "invalid"], { encoding: "utf8", timeout: 15000 });
    expect(child.status).toBe(1); expect(child.stderr).toContain("Usage:");
  });
});
