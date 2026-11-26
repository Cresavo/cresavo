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
import { servedBy } from "@/concept/ops/access";
import { fullName } from "@/concept/selectors";
import { balanceOf } from "@/concept/giftcards/cards";
import { t } from "@/concept/i18n";
import { formatDayLong, formatMoney } from "@/concept/i18n/format";

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
    // "Last time" is the last finished visit, never a booking still to come.
    const last = base.bookings.filter((b) => b.customerId === lenaBerg.id && b.status === "completed").sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start)[0];
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
    state = reduce(state, { type: "routine/toggle", id: routine.id, at: "2026-11-16 09:00" }, Date.parse("2026-11-16T08:00:00Z"));
    state = reduce(state, { type: "routine/toggle", id: routine.id, at: "2026-11-30 09:00" }, Date.parse("2026-11-30T08:00:00Z"));
    expect(dueRun(state.routines[0], { today: "2026-11-30", minutes: 10 * 60 })).toBeNull();
  });

  it("never keeps a run stamp later than the store's clock from switching on or adding a routine", () => {
    // 2026-11-16 09:00 in Stockholm (08:00 UTC).
    const now = Date.parse("2026-11-16T08:00:00Z");
    const routine = { ...newRoutine("monday-reminders", { today: "2026-11-09", minutes: 7 * 60 }), lastRun: "2030-01-01 08:00" };
    const added = reduce(base, { type: "routine/add", routine }, now);
    expect(added.routines[0].lastRun).toBe("2026-11-16 09:00");
    const off = reduce(added, { type: "routine/toggle", id: routine.id, at: "2026-11-16 09:00" }, now);
    const on = reduce(off, { type: "routine/toggle", id: routine.id, at: "2030-01-01 08:00" }, now);
    expect(on.routines[0].lastRun).toBe("2026-11-16 09:00");
    expect(dueRun(on.routines[0], { today: "2026-11-23", minutes: 8 * 60 })).toBe("2026-11-23 08:00");
  });

  it("stamps a run only for the latest due slot by the store's clock, so a fast client clock cannot silence later runs", () => {
    const routine = newRoutine("monday-reminders", { today: "2026-11-09", minutes: 7 * 60 });
    const state = reduce(base, { type: "routine/add", routine });
    // 2026-11-16 09:00 in Stockholm (08:00 UTC): the Monday slot at 08:00 is due.
    const now = Date.parse("2026-11-16T08:00:00Z");
    const ran = (at: string, from = state) => reduce(from, { type: "routine/ran", id: routine.id, at }, now);
    const stamped = ran("2026-11-16 08:00");
    expect(stamped.routines[0].lastRun).toBe("2026-11-16 08:00");
    expect(ran("2030-01-01 08:00")).toBe(state);
    expect(ran("2026-11-23 08:00")).toBe(state);
    expect(ran("2026-11-09 08:00")).toBe(state);
    expect(ran("2026-11-16 08:00", stamped)).toBe(stamped);
    // The next Monday is still due after the honest stamp.
    expect(dueRun(stamped.routines[0], { today: "2026-11-23", minutes: 8 * 60 })).toBe("2026-11-23 08:00");
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
    expect(ids).toEqual(expect.arrayContaining(["cancel", "stock"]));
    expect(ids).not.toContain("holiday");
    const own = { ...base, industry: "foot" as const };
    expect(eventReactions(own, clock).map((i) => i.id.split("-")[0])).toEqual(expect.arrayContaining(["cancel", "stock", "holiday"]));
    const hair = eventReactions(createDemoState(today, { pack: "hair" }), clock).map((i) => i.id.split("-")[0]);
    expect(hair).toContain("holiday");
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


// Run the daily questions on a fixed clock. Each is answered
// from the data or declined in plain words, never met with a plausible wrong answer.
describe("read questions", () => {
  const at = { today, minutes: 10 * 60 };
  const ask = (text: string, context: ThreadContext = emptyContext(), role: EngineInput["role"] = "owner") =>
    respond({ state: base, text, context, clock: at, role, viewer: "erik", examples: ["What have I earned this month?"] });
  const name = (id: string) => fullName(base.customers.find((c) => c.id === id)!);
  const later = base.bookings.filter((b) => b.date === today && b.status === "booked" && b.start > at.minutes).sort((a, b) => a.start - b.start);
  const unique = later.find((b) => base.customers.filter((c) => fullName(c) === name(b.customerId)).length === 1)!;

  it("says who is next, with a link to the customer", () => {
    const { reply, context } = ask("Who's next?");
    expect(reply.text).toContain(`Next is ${name(later[0].customerId)} at ${formatTime(later[0].start)}.`);
    expect(reply.card).toMatchObject({ kind: "bookings" });
    const items = (reply.card as { items: { href?: string }[] }).items;
    expect(items.at(-1)!.href).toBe(`/studio/customers/${later[0].customerId}`);
    expect(context.customerIds).toEqual([later[0].customerId]);
    // Staff see their own day only.
    const mine = later.find((b) => b.staffId === "erik");
    if (mine) expect(ask("Who is next?", emptyContext(), "staff").reply.text).toContain(name(mine.customerId));
  });

  it("lists the day that was asked for, not always today", () => {
    const friday = ask("Who is coming on Friday?");
    expect(friday.context.date).toBe("2026-11-20");
    expect(friday.reply.text).toContain("Friday 20 November");
    expect(ask("Who was in yesterday?").context.date).toBe("2026-11-16");
    expect(ask("Who is coming today?").context.date).toBe(today);
  });

  it("looks up a named customer's next appointment instead of starting a booking", () => {
    const { reply, context } = ask(`When is ${name(unique.customerId)}'s next appointment?`);
    expect(reply.text).toBe(`${name(unique.customerId)} is booked Tuesday 17 November at ${formatTime(unique.start)}.`);
    expect(reply.card).toMatchObject({ kind: "bookings" });
    expect(context.customerIds).toEqual([unique.customerId]);
  });

  it("tells what the last visit was and leaves the notes in the journal", () => {
    const done = base.bookings.filter((b) => b.customerId === unique.customerId && b.status === "completed").sort((a, b) => b.date.localeCompare(a.date))[0];
    const { reply } = ask(`What did we do for ${name(unique.customerId)} last time?`);
    expect(reply.text).toContain(base.services.find((s) => s.id === done.serviceId)!.name);
    expect(reply.text).toContain("journal");
    expect(reply.card).toMatchObject({ kind: "message", link: { href: `/studio/customers/${unique.customerId}` } });
  });

  it("finds real free times for a treatment, or the next day that has some", () => {
    const service = base.services[0];
    const { reply, context } = ask(`Any room for ${service.name} tomorrow?`);
    expect(context.serviceId).toBe(service.id);
    const day = context.date!;
    expect(day >= addDays(today, 1)).toBe(true);
    const times = reply.text.match(/\b\d\d:\d\d\b/g)!;
    expect(times.length).toBeGreaterThan(0);
    const free = service.staffIds.flatMap((id) => freeStarts(base, id, day, needOf(service)).map(formatTime));
    for (const time of times) expect(free).toContain(time);
    // Two treatments fit "a 60-minute massage": it asks which.
    expect(ask("Any room for a 60-minute massage tomorrow afternoon?").reply.card).toMatchObject({ kind: "choose" });
  });

  it("answers price and duration from the price list, without touching prices", () => {
    const service = base.services[0];
    const { reply, effects } = ask(`What does ${service.name} cost, and how long does it take?`);
    expect(reply.text).toContain(service.name);
    expect(reply.text).toContain("795");
    expect(reply.card?.kind).toBe("message");
    expect(effects).toEqual([]);
    // A price change is still a proposal.
    expect(ask(`Change the price of ${service.name} to 900 SEK`).reply.card).toMatchObject({ kind: "change" });
  });

  it("shows what waits in the Inbox and who is due back", () => {
    const waiting = base.inbox.filter((i) => !i.handled && (i.kind === "request" || i.kind === "reschedule")).length;
    expect(ask("What's waiting in the inbox?").reply.text).toContain(String(waiting));
    const due = ask("Who's due back for foot care?");
    expect(due.reply.card).toMatchObject({ kind: "customers" });
    expect(due.context.customerIds.length).toBeGreaterThan(0);
  });

  it("answers a gift card question about gift cards, not stock", () => {
    const { reply } = ask("How much is left on gift card EKO-1234?");
    expect(reply.text).toBe("I could not find a gift card with the code EKO-1234.");
    const sold = reduce(base, { type: "giftcard/sell", amount: 500, recipient: "Nova Demo", message: "", date: today });
    const card = sold.giftCards[0];
    expect(respond({ state: sold, text: `How much is left on gift card ${card.code}?`, context: emptyContext(), clock: at, role: "owner", examples: [] }).reply.text).toContain(card.code);
  });

  it("drafts a running-late text for approval", () => {
    const { reply, effects } = ask(`Text ${name(unique.customerId)} that I'm running 15 minutes late.`);
    expect(effects).toEqual([]);
    expect(reply.card).toMatchObject({ kind: "change", action: { type: "customers/message", texts: [{ customerId: unique.customerId }] } });
    expect(reply.card).toMatchObject({ action: { texts: [{ body: expect.stringContaining("15 minutes late") }] } });
  });

  it("reads yesterday's revenue as one day and a stated discount as stated", () => {
    const intent = interpretCommand("What did I earn yesterday?", buildIntentContext(base, today, at.minutes));
    expect(intent).toMatchObject({ action: "revenue", params: { start: "2026-11-16", end: today } });
    const { replies } = converse(base, ["Which customers haven't been here since summer?", "Send them a 15% welcome-back offer."]);
    expect(replies[1].reply.card).toMatchObject({ action: { texts: expect.arrayContaining([
      expect.objectContaining({ body: expect.stringContaining("15% off") }),
    ]) } });
  });

  it("declines what it cannot do exactly, and changes nothing", () => {
    for (const text of ["Close the salon early tomorrow at 15:00", "Block 13:00 to 14:00 tomorrow for lunch.", `Mark ${name(unique.customerId)}'s 09:00 today as a no-show.`, `Put ${name(unique.customerId)} on the waiting list for a Saturday morning cut.`, `Save a journal note for ${name(unique.customerId)}: used a softer file.`]) {
      const { reply, effects } = ask(text);
      expect(reply.card?.kind, text).toBe("message");
      expect(effects, text).toEqual([]);
    }
    // A whole-day closure is still a proposal.
    expect(ask("Close the salon on Friday.").reply.card).toMatchObject({ kind: "change" });
  });

  describe("the staff view's role policy", () => {
    const erik = servedBy(base, "erik");
    const uniqueName = (id: string) => base.customers.filter((c) => fullName(c) === name(id)).length === 1;
    const other = base.customers.find((c) => !erik.has(c.id) && uniqueName(c.id) && base.bookings.some((b) => b.customerId === c.id && b.status === "booked" && b.date >= today))!;
    const own = base.customers.find((c) => erik.has(c.id) && uniqueName(c.id) && base.bookings.some((b) => b.customerId === c.id && b.status === "completed" && b.staffId === "erik"))!;

    it("does not tell staff about a colleague's customer", () => {
      expect(other).toBeDefined();
      for (const text of [`When is ${fullName(other)}'s next appointment?`, `What did we do for ${fullName(other)} last time?`]) {
        const { reply } = ask(text, emptyContext(), "staff");
        expect(reply.text, text).toBe(t("assistant.lookup.notServed"));
        expect(reply.card, text).toBeUndefined();
        expect(JSON.stringify(reply), text).not.toContain(other.lastName);
      }
      // The owner still gets the answer.
      expect(ask(`When is ${fullName(other)}'s next appointment?`).reply.card).toBeDefined();
    });

    it("answers staff about their own customers from their own bookings only", () => {
      const { reply } = ask(`What did we do for ${fullName(own)} last time?`, emptyContext(), "staff");
      expect(reply.text).toContain("Erik");
      expect(reply.text).not.toMatch(/with (?!Erik)\w+\./);
    });

    it("keeps owner-only pages' answers from staff", () => {
      const service = base.services[0];
      for (const text of ["What's waiting in the inbox?", `What does ${service.name} cost?`, "How much is left on gift card EKO-1234?", "Who's due back for foot care?"]) {
        const { reply } = ask(text, emptyContext(), "staff");
        expect(reply.text, text).toBe(t("command.ownerOnly"));
        expect(reply.card, text).toBeUndefined();
      }
    });
  });

  it("asks who to text when the named recipient cannot be found, and texts the next customer only when asked to", () => {
    const unknown = ask("Text Zorro Nobodysson that I'm running 15 minutes late.");
    expect(unknown.reply.card?.kind).toBe("message");
    expect(unknown.reply.text).toContain("could not find Zorro Nobodysson");
    expect(ask("Text her that I'm running late.").reply.card?.kind).toBe("message");
    const next = ask("Text the next customer that I'm running 10 minutes late.");
    expect(next.reply.card).toMatchObject({ kind: "change", action: { type: "customers/message" } });
  });

  it("checks a stated time exactly and labels other times as alternatives", () => {
    const service = base.services.find((s) => s.staffIds.length === 1)!;
    let day = addDays(today, 1);
    while (!freeStarts(base, service.staffIds[0], day, needOf(service)).length) day = addDays(day, 1);
    const free = new Set(freeStarts(base, service.staffIds[0], day, needOf(service)));
    const open = [...free][0];
    let busy = 8 * 60;
    while (free.has(busy) && busy < 20 * 60) busy += 15;
    const yes = ask(`Can we fit ${service.name} on ${day} at ${formatTime(open)}?`);
    expect(yes.reply.text).toMatch(new RegExp(`^Yes: .*fits .* at ${formatTime(open)}`));
    const no = ask(`Can we fit ${service.name} on ${day} at ${formatTime(busy)}?`);
    expect(no.reply.text).toContain(`does not fit ${formatDayLong(day)} at ${formatTime(busy)}.`);
    expect(no.reply.text).toContain("Other free times");
    expect(no.reply.text).not.toMatch(/^Yes/);
  });

  it("reads past weekdays and whole weeks", () => {
    const friday = ask("Who was here last Friday?");
    expect(friday.context.date).toBe("2026-11-13");
    expect(friday.reply.text).toContain("Friday 13 November");
    expect(ask("Who was in on Friday?").context.date).toBe("2026-11-13");
    expect(ask("Who is coming on Friday?").context.date).toBe("2026-11-20");
    const week = ask("Who is coming next week?");
    expect(week.context.date).toBe("2026-11-23");
    const items = (week.reply.card as { items: { detail: string }[] }).items;
    const expected = base.bookings.filter((b) => b.date >= "2026-11-23" && b.date <= "2026-11-29" && (b.status === "booked" || b.status === "completed"));
    expect(items.length).toBe(expected.length);
    expect(week.reply.text).toContain("Mon 23 Nov – Sun 29 Nov");
    expect(new Set(items.map((i) => i.detail.split(" · ")[0])).size).toBeGreaterThan(1);
  });

  it("reports the gift card balance the booking page shows, after a cancellation", () => {
    const sold = reduce(base, { type: "giftcard/sell", amount: 1000, recipient: "Nova Demo", message: "", date: today });
    const card = sold.giftCards[0];
    const booking = sold.bookings.find((b) => b.status === "booked" && b.date >= today)!;
    const redeemed = reduce(sold, { type: "giftcard/redeem", code: card.code, bookingId: booking.id, date: today });
    const cancelled = reduce(redeemed, { type: "booking/cancel", id: booking.id });
    expect(balanceOf(cancelled, cancelled.giftCards[0])).toBe(1000);
    const answer = respond({ state: cancelled, text: `How much is left on gift card ${card.code.toLowerCase()}?`, context: emptyContext(), clock: at, role: "owner", examples: [] }).reply.text;
    expect(answer).toContain(`has ${formatMoney(1000)} left of ${formatMoney(1000)}`);
  });

  it("reads the whole stated discount and asks when it is out of range", () => {
    const ask2 = (offer: string) => converse(base, ["Which customers haven't been here since summer?", offer]).replies[1].reply;
    const full = ask2("Send them a 100% welcome-back offer.");
    expect(full.card).toBeUndefined();
    expect(full.text).toBe(t("assistant.offer.percentRange", { min: 1, max: 90 }));
    expect(JSON.stringify(ask2("Send them a 12.5% welcome-back offer.").card)).toContain("12.5% off");
    expect(JSON.stringify(ask2("Send them a 25 percent offer.").card)).toContain("25% off");
  });

  it("keeps customer lookups local and redacts names from every provider-bound field", () => {
    const result = ask(`When is ${name(unique.customerId)}'s next appointment?`);
    expect(result.local).toBe(true);
    expect(ask("Who is coming tomorrow?").local).toBe(true);
    const customer = base.customers.find((c) => c.id === unique.customerId)!;
    const request = replyRequest(base, [{ id: "m1", from: "owner", text: `Is ${fullName(customer)} coming?`, at: 0 }], result.understood, result.reply);
    const sent = JSON.stringify(request);
    expect(sent).not.toContain(customer.firstName);
    expect(sent).not.toContain(customer.lastName);
    expect(request.message).toContain("the customer's next appointment");
  });

  it("does not mistake a colleague's name for a customer", () => {
    expect(ask("When is Anna working next?").reply.card?.kind).not.toBe("bookings");
  });
});

describe("everyday data questions", () => {
  it("reports Erik's Friday gaps and respects a day off", () => {
    const friday = "2026-11-20";
    const erik = base.staff.find((person) => person.id === "erik")!;
    const working = {
      ...base,
      bookings: [],
      exceptions: [{ id: "working-friday", staffId: erik.id, date: friday, kind: "shift" as const, start: 13 * 60, end: 15 * 60 }],
    };
    const { replies } = converse(working, ["Is Erik free on Friday?", "Is Erik free on Friday afternoon?"]);
    for (const answer of replies) {
      expect(answer.reply.text).toContain("13:00–15:00");
      expect(answer.context.date).toBe(friday);
    }
    const off = { ...working, exceptions: [{ id: "off-friday", staffId: erik.id, date: friday, kind: "off" as const, reason: "other" as const }] };
    expect(converse(off, ["Is Erik free on Friday?"]).replies[0].reply.text).toContain("Erik is off");
  });

  it.each(["What is running low?", "what is low in stock", "What is running low in stock?"])("answers %s from current stock", (question) => {
    const [product] = base.stock;
    const stock = [{ ...product, inStock: 0, onOrder: 0 }];
    expect(converse({ ...base, stock }, [question]).replies[0].reply.card).toMatchObject({
      kind: "stock", items: [{ id: product.id, left: "0", low: true }],
    });
    stock[0].inStock = product.reorderAt + 1;
    expect(converse({ ...base, stock }, [question]).replies[0].reply.text).toBe("Nothing is low in stock.");
  });

  it.each(["Are you open on Saturday?", "What are the opening hours on Saturday?"])("answers %s from the salon schedule and closures", (question) => {
    const saturday = "2026-11-21";
    const salon = { ...base.salon, hours: { ...base.salon.hours, 6: { open: 10 * 60, close: 14 * 60 } } };
    expect(converse({ ...base, salon }, [question]).replies[0].reply.text).toContain("10:00–14:00");
    salon.closures = [...salon.closures, { id: "closed-saturday", date: saturday, name: "Test closure" }];
    expect(converse({ ...base, salon }, [question]).replies[0].reply.text).toContain("We are closed");
  });

  it("removes a cancellation alert as soon as its time is occupied", () => {
    const cancelled = base.bookings.find((booking) => booking.date === today && booking.status === "cancelled")!;
    const id = `cancel-${cancelled.id}`;
    const brief = (state: DemoState) => morningBrief(state, clock).items.map((item) => item.id);
    expect(brief(base)).toContain(id);
    const booked = { ...base, bookings: [...base.bookings, { ...cancelled, id: "replacement", status: "booked" as const, start: cancelled.start - 15 }] };
    expect(brief(booked)).not.toContain(id);
  });
});
