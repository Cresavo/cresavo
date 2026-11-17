import { describe, expect, it, vi } from "vitest";
import { reduce } from "@/concept/actions";
import { runTask } from "@/concept/ai/run-task";
import { routeModel } from "@/concept/ai/router";
import { applyPhrasing, closingBrief, currentBrief, eventReactions, morningBrief, weeklyBrief } from "@/concept/assistant/briefs";
import { replyRequest, respond, type EngineInput } from "@/concept/assistant/engine";
import { memoryRejection, noticedFact, preferredStaffOf, rememberRequest, searchMemory, type MemoryItem } from "@/concept/assistant/memory";
import { runRoutine } from "@/concept/assistant/outreach";
import { dueRun, latestSlot, newRoutine, suggestedRoutines, toSkillMd } from "@/concept/assistant/routines";
import { emptyContext, resolveReferences, threadSummary, type Message, type ThreadContext } from "@/concept/assistant/thread";
import { buildIntentContext } from "@/concept/command/intent-context";
import { proposalFor } from "@/concept/command/proposal";
import { createDemoState } from "@/concept/data/generate";
import { addDays, formatTime } from "@/concept/data/dates";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { DemoState, Service } from "@/concept/data/types";
import { interpretCommand } from "@/concept/intent";
import { applyAction } from "@/concept/log/capture";
import { undoEntry } from "@/concept/log/undo";
import { fullName } from "@/concept/selectors";

// Tuesday 17 November 2026, 09:00. The demo is generated for this day.
const today = "2026-11-17";
const clock = { today, minutes: 9 * 60 };
const base = createDemoState(today);

/** A conversation: each message gets the context the previous reply left. */
function converse(start: DemoState, messages: string[], role: EngineInput["role"] = "owner") {
  let state = start;
  let context: ThreadContext = emptyContext();
  const replies = messages.map((text) => {
    const result = respond({ state, text, context, clock, role, viewer: "erik", examples: ["What have I earned this month?"] });
    for (const effect of result.effects) state = reduce(state, effect);
    context = result.context;
    return result;
  });
  return { state, context, replies };
}

const lenaBerg = base.customers.find((c) => fullName(c) === "Lena Berg")!;

/** A day and time from tomorrow when both Anna and Erik are free for the service. */
function bothFree(state: DemoState, service: Service) {
  for (let i = 1; i < 30; i++) {
    const date = addDays(today, i);
    const anna = new Set(freeStarts(state, "anna", date, needOf(service)));
    const start = freeStarts(state, "erik", date, needOf(service)).find((s) => anna.has(s));
    if (start !== undefined) return { date, start };
  }
  throw new Error("No time when both are free");
}

describe("thread context", () => {
  it("fills in her, that day and the same as last time from the conversation", () => {
    const last = base.bookings.filter((b) => b.customerId === lenaBerg.id && b.status !== "cancelled").sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start)[0];
    const service = base.services.find((s) => s.id === last.serviceId)!.name;
    const staff = base.staff.find((s) => s.id === last.staffId)!.firstName;
    const context = { customerIds: [lenaBerg.id], date: "2026-11-20" };
    expect(resolveReferences("Book her the same as last time that day", context, base)).toBe(`Book Lena Berg ${service} with ${staff} on 2026-11-20`);
    expect(resolveReferences("Move him to 14:00", emptyContext(), base)).toBe("Move him to 14:00");
  });

  it("carries the customers of a list into the next message", () => {
    const { replies } = converse(base, ["Which customers haven't been here since summer?", "Send them an offer"]);
    expect(replies[0].reply.card).toMatchObject({ kind: "customers" });
    const total = (replies[0].reply.card as { total: number }).total;
    expect(replies[1].context.customerIds).toHaveLength(total);
    expect(replies[1].reply.card).toMatchObject({ kind: "change", action: { type: "customers/message" } });
  });

  it("knows who a booking proposal was for, so a follow-up can say her", () => {
    const { replies } = converse(base, ["Remember Lena Berg prefers Erik", "Book her for a relaxing massage tomorrow"]);
    expect(replies[1].understood).toBe("Book Lena Berg for a relaxing massage tomorrow");
  });

  it("summarises a finished thread from its topics only", () => {
    const messages: Message[] = [
      { id: "1", from: "owner", text: "Lena's number is 070-123 45 67", at: 0 },
      { id: "2", from: "assistant", text: "x", reply: { source: "rules", text: "x", topic: "Offer to 12 customers" }, at: 0 },
      { id: "3", from: "assistant", text: "y", reply: { source: "rules", text: "y", topic: "Book Lena for medical foot care" }, at: 0 },
    ];
    expect(threadSummary(messages)).toBe("Offer to 12 customers");
    expect(threadSummary([])).toBeNull();
  });
});

describe("rule-based answers for the goal's questions", () => {
  it("compares last month with last year as a number and a chart", () => {
    const { replies } = converse(base, ["How did last month compare with last year?"]);
    const { reply } = replies[0];
    expect(reply.source).toBe("rules");
    expect(reply.card).toMatchObject({ kind: "insight", title: "October 2026 compared with October 2025", chart: { type: "columns" } });
    expect(reply.text).toMatch(/^October 2026 compared with October 2025: [+−]\d+%/);
  });

  it("drafts an offer to customers not seen since summer and sends it only when approved", () => {
    const { replies } = converse(base, ["Send an offer to the customers who haven't been here since summer"]);
    const card = replies[0].reply.card!;
    expect(card.kind).toBe("change");
    if (card.kind !== "change" || card.action.type !== "customers/message") throw new Error("expected an offer");
    expect(card.action.texts.length).toBeGreaterThan(5);
    const approved = applyAction(base, card.action, { actor: "ai", source: "assistant", at: 1 });
    expect(approved.inbox.length).toBe(base.inbox.length + card.action.texts.length);
    expect(approved.log[0]).toMatchObject({ actor: "ai", source: "assistant", type: "customers/message" });
    expect(approved.log[0].summary).not.toContain("miss you");
  });

  it("remembers a preference, asks which Lena first, and books her with Erik next time", () => {
    const shared = { ...base, services: base.services.map((s) => (s.id === "classic-60" ? { ...s, staffIds: ["anna" as const, "erik" as const] } : s)) };
    const customer = { ...lenaBerg, preferredStaff: "anna" as const };
    const state = { ...shared, customers: shared.customers.map((c) => (c.id === customer.id ? customer : c)) };
    const { replies, state: after } = converse(state, ["Remember Lena prefers Erik"]);
    expect(replies[0].reply.card).toMatchObject({ kind: "choose", title: "Which Lena do you mean?" });
    const choice = (replies[0].reply.card as { choices: { label: string; text: string }[] }).choices[0];
    expect(choice.label).toBe("Lena Berg");
    const saved = converse(after, [choice.text]).state;
    expect(saved.memory).toHaveLength(1);
    expect(saved.memory[0]).toMatchObject({ text: "Lena Berg prefers Erik", kind: "preference", customerId: customer.id, staffId: "erik", source: "owner" });
    expect(preferredStaffOf(saved, customer)).toBe("erik");
    const service = saved.services.find((s) => s.id === "classic-60")!;
    const { date, start } = bothFree(saved, service);
    const text = `Book Lena Berg for classic massage 60 min on ${date} at ${formatTime(start)}`;
    const proposal = proposalFor(saved, interpretCommand(text, buildIntentContext(saved, today, clock.minutes)), text, clock, []);
    expect(proposal).toMatchObject({ kind: "change", action: { type: "booking/create", staffId: "erik" } });
    expect((proposal as { rows: { label: string; after: string }[] }).rows).toContainEqual({ label: "Remembered", after: "Lena Berg prefers Erik" });
    const before = proposalFor(state, interpretCommand(text, buildIntentContext(state, today, clock.minutes)), text, clock, []);
    expect(before).toMatchObject({ action: { staffId: "anna" } });
  });

  it("answers who is coming through the list_bookings tool, and keeps finance from staff", () => {
    const { replies } = converse(base, ["Who is coming tomorrow?"]);
    expect(replies[0].reply.card).toMatchObject({ kind: "bookings" });
    const staff = converse(base, ["Who is coming tomorrow?", "How did last month compare with last year?", "Remember Lena Berg prefers Erik"], "staff").replies;
    const items = (staff[0].reply.card as { items: { detail: string }[] }).items;
    expect(items.every((item) => item.detail.endsWith("Erik"))).toBe(true);
    expect(staff[1].reply.card).toBeUndefined();
    expect(staff[1].reply.text).toMatch(/for the owner/);
    expect(staff[2].effects).toEqual([]);
  });

  it("labels every rule reply and offers examples when it does not understand", () => {
    const { replies } = converse(base, ["Tell me a joke about penguins"]);
    expect(replies[0].reply).toMatchObject({ source: "rules", followUps: ["What have I earned this month?"] });
  });
});

describe("memory", () => {
  it.each([
    ["Karin has diabetes", "health"],
    ["Lisa is allergic to nuts", "health"],
    ["Erik's back pain is better", "health"],
    ["Lena's number is 070-123 45 67", "contact"],
    ["Write to lena@example.com", "contact"],
    ["Maria lives at Odengatan 12", "contact"],
    ["", "empty"],
  ])("rejects %j as %s", (text, reason) => expect(memoryRejection(text)).toBe(reason));

  it("rejects text copied from a journal entry", () => {
    const entry = base.journals.find((j) => j.observations.length > 20)!;
    expect(memoryRejection(`Remember: ${entry.observations}`, base)).not.toBeNull();
  });

  it.each(["Lena Berg prefers Erik", "Anna never takes bookings before 10", "Erik works late on Thursdays"])("keeps %j", (text) => expect(memoryRejection(text, base)).toBeNull());

  it("never saves rejected text, even when the store is asked directly", () => {
    const item = { text: "Karin has diabetes", kind: "fact" as const, savedOn: today, source: "owner" as const };
    expect(reduce(base, { type: "memory/add", item })).toBe(base);
    const saved = reduce(base, { type: "memory/add", item: { ...item, text: "Karin likes tea" } });
    expect(reduce(saved, { type: "memory/edit", id: saved.memory[0].id, text: "Karin: 070-123 45 67" })).toBe(saved);
  });

  it("remembers immediately, forgets on request, and both can be undone from the log", () => {
    const { state, replies } = converse(base, ["Remember Anna never takes bookings before 10"]);
    expect(replies[0].effects).toHaveLength(1);
    expect(state.memory.map((m) => m.text)).toEqual(["Anna never takes bookings before 10"]);
    expect(state.memory[0].staffId).toBe("anna");
    const logged = applyAction(base, replies[0].effects[0], { actor: "owner", source: "assistant", at: 1 });
    expect(logged.log[0]).toMatchObject({ type: "memory/add", source: "assistant" });
    expect(logged.log[0].summary).not.toContain("Anna");
    expect(undoEntry(logged, logged.log[0].id).memory).toEqual([]);
    const forgotten = converse(state, ["Forget that Anna never takes bookings before 10"]).state;
    expect(forgotten.memory).toEqual([]);
  });

  it("proposes, rather than saves, a fact it noticed", () => {
    expect(noticedFact("Lena Svensson always wants mornings")).toBe("Lena Svensson always wants mornings");
    expect(noticedFact("Who always comes on Fridays?")).toBeNull();
    const { replies, state } = converse(base, ["Lena Svensson always wants mornings"]);
    expect(replies[0].reply.card).toMatchObject({ kind: "memory-offer", item: { source: "assistant" } });
    expect(state.memory).toEqual([]);
  });

  it("parses remember requests and searches notes", () => {
    expect(rememberRequest("Please remember that Lena prefers Erik.")).toBe("Lena prefers Erik");
    expect(rememberRequest("Lena prefers Erik")).toBeNull();
    const items = [{ id: "1", text: "Lena Berg prefers Erik" }, { id: "2", text: "Anna never before 10" }] as MemoryItem[];
    expect(searchMemory(items, "lena erik").map((i) => i.id)).toEqual(["1"]);
    expect(searchMemory(items, "")).toHaveLength(2);
  });

  it("sends only filtered notes to the model", () => {
    const state = { ...base, memory: [
      { id: "a", text: "Lena Berg prefers Erik", kind: "preference", savedOn: today, source: "owner" },
      { id: "b", text: "Karin has diabetes", kind: "fact", savedOn: today, source: "owner" },
      { id: "c", text: "Offer to 12 customers", kind: "thread", savedOn: today, source: "assistant" },
    ] as MemoryItem[] };
    const request = replyRequest(state, [{ id: "1", from: "owner", text: "Call 070-123 45 67", at: 0 }], "Hello", { source: "rules", text: "Hi" });
    expect(request.memory).toEqual(["Lena Berg prefers Erik"]);
    expect(request.thread).toEqual([]);
  });
});

describe("routines", () => {
  it("suggests a reminders routine when customers are overdue and a stock check when stock is low", () => {
    const ids = suggestedRoutines(base, clock).map((s) => s.routine.id);
    expect(ids).toEqual(["monday-reminders", "friday-stock"]);
    const kept = reduce(base, { type: "routine/add", routine: newRoutine("monday-reminders", clock) });
    expect(suggestedRoutines(kept, clock).map((s) => s.routine.id)).toEqual(["friday-stock"]);
    const dismissed = reduce(base, { type: "card/dismiss", id: "routine-friday-stock" });
    expect(suggestedRoutines(dismissed, clock).map((s) => s.routine.id)).toEqual(["monday-reminders"]);
  });

  it("notices when the owner keeps sending time suggestions", () => {
    const quiet = { ...base, customers: [] as DemoState["customers"], inbox: [{ id: "x1", kind: "system", recallServiceId: "classic-60", date: today, time: 0, title: "", body: "", read: true, handled: true }, { id: "x2", kind: "system", recallServiceId: "classic-60", date: today, time: 0, title: "", body: "", read: true, handled: true }] } as DemoState;
    expect(suggestedRoutines(quiet, clock)[0].reason).toBe("you sent time suggestions 2 times this month");
  });

  it("runs on its schedule, once per slot, and not for runs missed while off", () => {
    const routine = newRoutine("monday-reminders", { today: "2026-11-16", minutes: 7 * 60 });
    expect(latestSlot(routine, { today: "2026-11-16", minutes: 7 * 60 })).toBe("2026-11-09 08:00");
    expect(dueRun(routine, { today: "2026-11-16", minutes: 7 * 60 })).toBeNull();
    expect(dueRun(routine, { today: "2026-11-16", minutes: 8 * 60 })).toBe("2026-11-16 08:00");
    expect(dueRun({ ...routine, lastRun: "2026-11-16 08:00" }, { today: "2026-11-18", minutes: 0 })).toBeNull();
    expect(dueRun({ ...routine, enabled: false }, { today: "2026-11-23", minutes: 9 * 60 })).toBeNull();
    let state = reduce(base, { type: "routine/add", routine });
    state = reduce(state, { type: "routine/toggle", id: routine.id, at: "2026-11-16 09:00" });
    state = reduce(state, { type: "routine/toggle", id: routine.id, at: "2026-11-30 09:00" });
    expect(dueRun(state.routines[0], { today: "2026-11-30", minutes: 10 * 60 })).toBeNull();
  });

  it("only proposes when it runs", () => {
    const reminders = runRoutine(base, newRoutine("monday-reminders", clock), clock);
    expect(reminders).toMatchObject({ kind: "change", action: { type: "customers/message" } });
    const stock = runRoutine(base, newRoutine("friday-stock", clock), clock);
    expect(stock).toMatchObject({ kind: "change", action: { type: "stock/order" } });
  });

  it("is written out as a SKILL.md record", () => {
    const skill = toSkillMd(newRoutine("friday-stock", clock));
    expect(skill).toMatch(/^---\nname: friday-stock\ndescription: .+\nwhen: Friday at 09:00\ntools: get_stock, propose_stock_order\nenabled: true\n---\n\n# Friday stock check\n\n1\. /);
  });
});

describe("briefs", () => {
  it("builds the morning brief from rules, most important first", () => {
    const brief = morningBrief(base, clock);
    expect(brief.title).toBe("Morning brief");
    expect(brief.items.map((i) => i.id)).toContain("bookings");
    expect(brief.items.map((i) => i.priority)).toEqual([...brief.items.map((i) => i.priority)].sort((a, b) => b - a));
    expect(currentBrief(base, clock).kind).toBe("morning");
  });

  it("reacts to a cancellation, low stock and an upcoming holiday", () => {
    const ids = eventReactions(base, clock).map((i) => i.id.split("-")[0]);
    expect(ids).toEqual(expect.arrayContaining(["cancel", "stock", "holiday"]));
  });

  it("gives a weekly review on Monday mornings and a closing brief after the last booking", () => {
    const monday = { today: "2026-11-16", minutes: 8 * 60 };
    expect(currentBrief(createDemoState("2026-11-16"), monday).kind).toBe("weekly");
    expect(weeklyBrief(base, clock).items[0].id).toBe("revenue");
    expect(currentBrief(base, { today, minutes: 23 * 60 })).toMatchObject({ kind: "closing", title: "Closing brief" });
    expect(closingBrief(base, { today, minutes: 23 * 60 }).items[0].text).toMatch(/^Today's revenue/);
  });

  it("accepts an AI phrasing only when it keeps exactly the same items", () => {
    const brief = morningBrief(base, clock);
    const reordered = { headline: "Today", items: [...brief.items].reverse().map((i) => ({ id: i.id, text: `New ${i.id}` })) };
    expect(applyPhrasing(brief, reordered).items.map((i) => i.id)).toEqual(reordered.items.map((i) => i.id));
    expect(applyPhrasing(brief, { headline: "x", items: [{ id: "invented", text: "Lie" }] })).toBe(brief);
    expect(applyPhrasing(brief, { headline: "x", items: reordered.items.slice(1) })).toBe(brief);
  });
});

describe("models for the assistant", () => {
  const ollama = { CONCEPT_AI_BASE_URL: "http://localhost:11434/v1/", CONCEPT_AI_FAST_MODEL: "llama3.1" };

  it("routes any OpenAI-compatible base URL, ahead of platform keys", () => {
    expect(routeModel("smart", { ...ollama, OPENAI_API_KEY: "fake" })).toEqual({ provider: "compatible", model: "llama3.1", apiKey: "", tier: "smart", baseUrl: "http://localhost:11434/v1" });
    expect(routeModel("fast", { ...ollama, CONCEPT_AI_FAST_PROVIDER: "openai", OPENAI_API_KEY: "fake" })?.provider).toBe("openai");
    expect(routeModel("fast", { CONCEPT_AI_BASE_URL: "ftp://example", CONCEPT_AI_FAST_MODEL: "m" })).toBeNull();
    expect(routeModel("fast", { CONCEPT_AI_BASE_URL: "http://localhost:11434/v1" })).toBeNull();
    expect(routeModel("image", ollama)).toBeNull();
  });

  it("calls the base URL's chat endpoint, logs the cost and keeps the rules text on failure", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: '{"reply":"Up 4% on last year."}' } }], usage: { prompt_tokens: 30, completion_tokens: 8 } }));
    const input = { message: "How did last month go?", draft: "+4%", facts: [], thread: [], memory: [] };
    const result = await runTask("assistant-reply", input, { env: { ...ollama, CONCEPT_AI_API_KEY: "local" }, fetcher, useBusinessSettings: false });
    expect(result.output.reply).toBe("Up 4% on last year.");
    expect(result.log).toMatchObject({ task: "assistant-reply", provider: "compatible", model: "llama3.1", source: "ai", inputTokens: 30 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer local");
    const keyless = vi.fn().mockResolvedValue(new Response("down", { status: 500 }));
    const fallback = await runTask("assistant-reply", input, { env: ollama, fetcher: keyless, useBusinessSettings: false });
    expect(keyless.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fallback).toMatchObject({ output: { reply: "+4%" }, log: { source: "rules", reason: "provider-error" } });
  });

  it("refuses memory notes the filter rejects before any call", async () => {
    const fetcher = vi.fn();
    await expect(runTask("assistant-reply", { message: "Hi", draft: "Hi", facts: [], thread: [], memory: ["Karin has diabetes"] }, { env: ollama, fetcher })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
