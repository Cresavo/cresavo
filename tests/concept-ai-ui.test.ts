import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Segmented } from "@/concept/ui/controls";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAiTask } from "@/concept/ai/api-client";
import { clearCostLog, logCost } from "@/concept/ai/cost-log";
import { describeAi } from "@/concept/ai/overview";
import { tasks } from "@/concept/ai/registry";
import { formatUsd } from "@/concept/i18n/format";
import { suggestedWeeks } from "@/concept/customers/next-visit";

afterEach(() => clearCostLog());

describe("describeAi", () => {
  it("lists every task on rules when no key is set", () => {
    const overview = describeAi({});
    expect(overview.configured).toBe(false);
    expect(overview.tasks.map((task) => task.name).sort()).toEqual(Object.keys(tasks).sort());
    expect(overview.tasks.every((task) => task.provider === null && task.model === null)).toBe(true);
  });

  it("shows provider and model per tier once a key exists", () => {
    const overview = describeAi({ OPENAI_API_KEY: "sk-test" });
    expect(overview.configured).toBe(true);
    const interpret = overview.tasks.find((task) => task.name === "interpret-command")!;
    expect(interpret).toMatchObject({ tier: "fast", provider: "openai", model: "gpt-4.1-mini" });
    expect(JSON.stringify(overview)).not.toContain("sk-test");
  });

  it("summarises the cost log, newest first", () => {
    const base = { task: "interpret-command", version: 1, inputTokens: 100, outputTokens: 20 };
    logCost({ ...base, provider: "rules", model: "rules", source: "rules", reason: "no-key", costUsd: 0 });
    logCost({ ...base, provider: "openai", model: "gpt-4.1-mini", source: "ai", costUsd: 0.0002 });
    logCost({ ...base, provider: "openai", model: "unknown-model", source: "ai", costUsd: null });
    const { totals, costLog } = describeAi({});
    expect(totals).toEqual({ calls: 3, aiCalls: 2, costUsd: 0.0002, unknownCosts: 1 });
    expect(costLog[0].model).toBe("unknown-model");
  });
});

describe("formatUsd", () => {
  it("keeps tiny costs readable and marks unknown ones", () => {
    expect(formatUsd(0.0004)).toBe("$0.0004");
    expect(formatUsd(1.234)).toBe("$1.23");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(null)).toBe("unknown");
  });
});

describe("suggestedWeeks", () => {
  it.each([
    ["Next visit in 6 weeks.", 6],
    ["return in 6-8 weeks", 6],
    ["come back after two months", 8],
    ["see her in a week", 1],
    ["Next visit: 3 months", 12],
  ])("reads %s", (text, weeks) => expect(suggestedWeeks(text)).toBe(weeks));

  it("returns nothing when no interval is stated", () => {
    expect(suggestedWeeks("")).toBeUndefined();
    expect(suggestedWeeks("when the heel heals")).toBeUndefined();
  });
});

it("provider segmented controls never submit the enclosing key form", () => {
  const html = renderToStaticMarkup(createElement(Segmented, { value: "openai", options: [{ value: "openai", label: "OpenAI" }, { value: "anthropic", label: "Anthropic" }], label: "Provider", onChange: () => {} }));
  expect(html.match(/type="button"/g)).toHaveLength(2);
});

describe("runAiTask against a read-only server", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs the task's own rules in the browser when the server refuses the write", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "denied" }), { status: 403 }));
    const { output, log } = await runAiTask<{ treatment: string; nextVisit: string }>("structure-journal", { transcript: "Did the usual foot care. Next visit in 6 weeks." }, false);
    expect(output.treatment).toBe("Did the usual foot care.");
    expect(output.nextVisit).toBe("Next visit in 6 weeks.");
    expect(log).toMatchObject({ source: "rules", costUsd: 0 });
  });

  it("still reports a real server failure", async () => {
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    await expect(runAiTask("structure-journal", { transcript: "Anything." }, false)).rejects.toThrow();
  });
});
