import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyContext, type Message, type Reply } from "@/concept/assistant/thread";
import type { Proposal } from "@/concept/command/proposal";

// The assistant panel's card rules, without React: a model's late reading
// never overrides what the owner already did.

const storage = new Map<string, string>();

async function setup() {
  vi.resetModules();
  storage.clear();
  vi.stubGlobal("window", {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => void storage.set(key, value) },
  });
  const store = await import("@/concept/store");
  const thread = await import("@/concept/studio/assistant/thread-store");
  const actions = await import("@/concept/studio/assistant/reply-actions");
  const service = store.currentState()!.services[0];
  /** An owner message and an assistant reply proposing a new price, as the panel adds them. */
  const ask = (reply: Partial<Reply> = {}, id = `r-${Math.random()}`) => {
    const card: Proposal = { kind: "change", title: "New price", rows: [], toast: "Price changed", action: { type: "service/price", id: service.id, price: service.price + 50 } };
    const messages: Message[] = [
      { id: `q-${id}`, from: "owner", text: "raise the price", at: 1 },
      { id, from: "assistant", text: "New price", reply: { source: "rules", text: "New price", card, ...reply }, at: 1 },
    ];
    thread.addMessages(messages, { customerIds: [], date: "2026-11-18" });
    return id;
  };
  const reply = (id: string) => thread.replyOf(id)!;
  return { store, thread, actions, service, ask, reply };
}

beforeEach(() => vi.unstubAllGlobals());

describe("model refinement (Codex #3)", () => {
  const aiReading = { source: "ai" as const, text: "AI reading", card: { kind: "choose" as const, title: "AI", choices: [] } };

  it("replaces the reply and the context together while it is pending and the turn is current", async () => {
    const { thread, ask, reply } = await setup();
    const id = ask({ refining: true });
    expect(thread.refineReply(id, aiReading, { ...emptyContext(), date: "2026-11-20" })).toBe(true);
    expect(reply(id)).toMatchObject({ source: "ai", text: "AI reading" });
    expect(reply(id).refining).toBeUndefined();
    expect(JSON.parse(storage.get("salong-eko-assistant")!).context.date).toBe("2026-11-20");
  });

  it("is discarded after the owner picks a choice or approves", async () => {
    const { thread, actions, ask, reply } = await setup();
    const picked = ask({ refining: true });
    const choice: Proposal = { kind: "change", title: "Picked", rows: [], toast: "", action: { type: "inbox/read-all" } };
    actions.pickReply(picked, { label: "Picked", proposal: choice });
    expect(thread.refineReply(picked, aiReading, { ...emptyContext(), date: "2030-01-01" })).toBe(false);
    expect(reply(picked).card).toEqual(choice);
    expect(JSON.parse(storage.get("salong-eko-assistant")!).context.date).toBe("2026-11-18");

    const approved = ask({ refining: true });
    actions.approveReply(approved, (reply(approved).card as Extract<Proposal, { kind: "change" }>).action);
    expect(thread.refineReply(approved, aiReading)).toBe(false);
    expect(reply(approved)).toMatchObject({ status: "approved", source: "rules" });
  });

  it("is discarded once the owner has moved on to another message", async () => {
    const { thread, ask, reply } = await setup();
    const first = ask({ refining: true });
    ask();
    expect(thread.refineReply(first, aiReading, { ...emptyContext(), date: "2030-01-01" })).toBe(false);
    expect(reply(first)).toMatchObject({ source: "rules", text: "New price" });
    expect(reply(first).refining).toBeUndefined();
  });
});
