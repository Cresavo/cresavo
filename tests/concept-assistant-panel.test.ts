import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyContext, type Message, type Reply } from "@/concept/assistant/thread";
import type { Proposal } from "@/concept/command/proposal";

// The assistant panel's card rules, without React: a model's late reading
// never overrides what the owner already did, Undo is only offered (and only
// reported) when the store accepts it, Edit retires the old proposal, and the
// activity log tells spoken from typed commands.

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
      { id, from: "assistant", text: "New price", reply: { source: "rules", text: "New price", card, request: "raise the price", input: "typed", ...reply }, at: 1 },
    ];
    thread.addMessages(messages, { customerIds: [], date: "2026-11-18" });
    return id;
  };
  const reply = (id: string) => thread.replyOf(id)!;
  const approve = (id: string) => actions.approveReply(id, (reply(id).card as Extract<Proposal, { kind: "change" }>).action);
  return { store, thread, actions, service, ask, reply, approve };
}

beforeEach(() => vi.unstubAllGlobals());

describe("model refinement (Codex #3)", () => {
  const aiReading = { source: "ai" as const, text: "AI reading", card: { kind: "choose" as const, title: "AI", choices: [] } };

  it("replaces the reply and the context together while it is pending and the turn is current", async () => {
    const { thread, ask, reply } = await setup();
    const id = ask({ refining: true });
    expect(thread.refineReply(id, aiReading, { ...emptyContext(), date: "2026-11-20" })).toBe(true);
    expect(reply(id)).toMatchObject({ source: "ai", text: "AI reading", request: "raise the price", input: "typed" });
    expect(reply(id).refining).toBeUndefined();
    expect(JSON.parse(storage.get("salong-eko-assistant")!).context.date).toBe("2026-11-20");
  });

  it("is discarded after the owner picks a choice or approves", async () => {
    const { thread, actions, ask, reply, approve } = await setup();
    const picked = ask({ refining: true });
    const choice: Proposal = { kind: "change", title: "Picked", rows: [], toast: "", action: { type: "inbox/read-all" } };
    actions.pickReply(picked, { label: "Picked", proposal: choice });
    expect(thread.refineReply(picked, aiReading, { ...emptyContext(), date: "2030-01-01" })).toBe(false);
    expect(reply(picked).card).toEqual(choice);
    expect(JSON.parse(storage.get("salong-eko-assistant")!).context.date).toBe("2026-11-18");

    const approved = ask({ refining: true });
    await approve(approved);
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

describe("undo on a reply (Codex #4)", () => {
  it("reports Undone only when the store accepted it", async () => {
    const { actions, ask, reply, store, service, approve } = await setup();
    const id = ask();
    await approve(id);
    expect(actions.replyUndoable(reply(id))).toBe(true);
    expect(await actions.undoReply(id, reply(id).undoId!)).toBe(true);
    expect(reply(id)).toMatchObject({ status: "undone", undoId: undefined });
    expect(store.currentState()!.services[0].price).toBe(service.price);
  });

  it("withdraws Undo, without claiming success, after a later edit to the same record", async () => {
    const { actions, ask, reply, store, service, approve } = await setup();
    const id = ask();
    await approve(id);
    const undoId = reply(id).undoId!;
    store.dispatch({ type: "service/price", id: service.id, price: service.price + 99 });
    expect(actions.replyUndoable(reply(id))).toBe(false);
    expect(await actions.undoReply(id, undoId)).toBe(false);
    expect(reply(id)).toMatchObject({ status: "approved", undoId: undefined });
    expect(store.currentState()!.services[0].price).toBe(service.price + 99);
  });

  it("is not offered when the log entry is gone", async () => {
    const { actions, ask, reply } = await setup();
    expect(actions.replyUndoable({ ...reply(ask()), undoId: "l-does-not-exist" })).toBe(false);
  });

  it("refuses an approved action that would change nothing, and writes no log entry", async () => {
    const { actions, ask, reply, store, service } = await setup();
    const earlier = store.dispatchWithLog({ type: "customer/note", id: store.currentState()!.customers[0].id, note: "Earlier edit" });
    expect(earlier).toEqual(expect.any(String));
    const action = { type: "service/price", id: service.id, price: service.price } as const;
    const id = ask({ card: { kind: "change", title: "Same price", rows: [], toast: "", action } });

    // The commit API refuses a change that holds the same data as before (the legacy dispatch saved it).
    expect(await actions.applyReply(id, action, { actor: "ai", source: "assistant" })).toBe(false);
    expect(reply(id)).toMatchObject({ status: "failed" });
    expect(reply(id).undoId).toBeUndefined();
    expect(store.currentState()!.log[0].id).toBe(earlier);
  });
});

it("isolates owner replies from staff and rechecks permissions before dispatch", async () => {
  const { actions, ask, thread, store, service, approve } = await setup();
  const { setRole } = await import("@/concept/ops/role");
  const action = { type: "service/price", id: service.id, price: service.price + 50 } as const;
  const ownerCard = ask({ text: "Owner-only answer" });
  setRole("staff");
  expect(thread.replyOf(ownerCard)).toBeUndefined();
  expect(await actions.applyReply(ownerCard, action, { actor: "ai" })).toBe(false);

  const staffCard = ask();
  expect(await approve(staffCard)).toBe(false);
  expect(store.currentState()!.services[0].price).toBe(service.price);
  setRole("owner");
  expect(thread.replyOf(staffCard)).toBeUndefined();
  expect(thread.replyOf(ownerCard)?.text).toBe("Owner-only answer");
  expect(await approve(ownerCard)).toBe(true);
});

it("blocks a staff approval when another tab reassigned the booking", async () => {
  const { ask, approve, store } = await setup();
  const { setRole } = await import("@/concept/ops/role");
  setRole("staff");
  const state = store.currentState()!;
  const booking = state.bookings.find((item) => item.staffId === state.staff[1].id && item.status === "booked")!;
  const id = ask({ card: { kind: "change", title: "Cancel", rows: [], toast: "", action: { type: "booking/cancel", id: booking.id } } });
  storage.set("salong-eko-demo", JSON.stringify({ ...state, bookings: state.bookings.map((item) => item === booking ? { ...item, staffId: state.staff[0].id } : item) }));
  expect(await approve(id)).toBe(false);
  expect(store.currentState()!.bookings.find((item) => item.id === booking.id)).toMatchObject({ status: "booked", staffId: state.staff[0].id });
});

describe("edit and provenance (Codex #5)", () => {
  it("Edit returns the owner's words and retires the proposal", async () => {
    const { actions, ask, reply } = await setup();
    const id = ask({ refining: true });
    expect(actions.editReply(id)).toBe("raise the price");
    expect(reply(id)).toMatchObject({ status: "edited" });
    expect(reply(id).refining).toBeUndefined();
  });

  it("logs an approved spoken command as voice and a typed one as the assistant", async () => {
    const { actions, ask, store, service, approve } = await setup();
    await approve(ask({ input: "voice" }));
    expect(store.currentState()!.log[0]).toMatchObject({ actor: "ai", source: "voice", type: "service/price" });
    expect(store.dispatch({ type: "service/price", id: service.id, price: service.price })).toBe(true);
    await approve(ask({ input: "typed" }));
    expect(store.currentState()!.log[0]).toMatchObject({ actor: "ai", source: "assistant", type: "service/price" });
    expect(actions.sourceFor(undefined)).toBe("assistant");
  });
});
