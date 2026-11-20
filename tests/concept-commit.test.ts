import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import type { DemoState } from "@/concept/data/types";

// The commit-result API beside the dispatch helpers (docs/design/BROWSER_STORE_IDB.md,
// PR 3), on the localStorage store. Fictional data only.

const { showToast, showActionFailure } = vi.hoisted(() => ({ showToast: vi.fn(), showActionFailure: vi.fn() }));
vi.mock("@/concept/ui/toast", () => ({ showToast, showActionFailure }));

const today = toKey(new Date());
let t: typeof import("@/concept/i18n").t;

/** One tab's storage, with a hook that runs before each save. */
function tab(initial: DemoState) {
  const items = new Map([["salong-eko-demo", JSON.stringify(initial)]]);
  const hooks = { beforeSave: undefined as (() => void) | undefined, refuse: undefined as ((key: string) => boolean) | undefined };
  const localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (hooks.refuse?.(key)) throw new DOMException("full", "QuotaExceededError");
      if (key === "salong-eko-demo") hooks.beforeSave?.();
      items.set(key, value);
    },
    removeItem: (key: string) => { items.delete(key); },
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  return { items, hooks, saved: () => JSON.parse(items.get("salong-eko-demo")!) as DemoState };
}

async function modules() {
  const store = await import("@/concept/store");
  const commit = await import("@/concept/store/commit");
  const toasts = await import("@/concept/studio/log/commit-toast");
  const { dispatchWithUndoToast } = await import("@/concept/studio/log/undo-toast");
  const { demoSentMessages } = await import("@/concept/connections/demo");
  ({ t } = await import("@/concept/i18n"));
  return { ...store, ...commit, ...toasts, dispatchWithUndoToast, sms: () => demoSentMessages("demo").list("sms") };
}

const upcoming = (state: DemoState) => state.bookings.find((b) => b.status === "booked" && b.date > today)!;
const remind = (state: DemoState) => ({ type: "booking-message/send" as const, bookingId: upcoming(state).id, channel: "sms" as const, kind: "reminder" as const, at: { date: today, time: 0 } });

beforeEach(() => {
  vi.resetModules();
  showToast.mockClear();
  showActionFailure.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

it("resolves with the state that was saved and the log entry it wrote", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitAction, currentTarget } = await modules();
  const booking = upcoming(state);
  const result = await commitAction(currentTarget()!, { type: "booking/cancel", id: booking.id });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.state).toEqual(storage.saved());
  expect(result.state.bookings.find((b) => b.id === booking.id)?.status).toBe("cancelled");
  expect(result.logId).toBe(storage.saved().log[0].id);
  expect(result.replayed).toBe(false);
});

it("reports refusals without saving: reducer, guard, stale version", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitAction, currentTarget } = await modules();
  const target = currentTarget()!;
  expect(await commitAction(target, { type: "booking/cancel", id: "no-such-booking" })).toMatchObject({ ok: false, reason: "rejected" });
  expect(await commitAction(target, { type: "card/dismiss", id: "x" }, { guard: () => false })).toMatchObject({ ok: false, reason: "rejected" });
  const moved = await commitAction(target, { type: "card/dismiss", id: "first" });
  expect(moved.ok).toBe(true);
  if (!moved.ok) return;
  expect(await commitAction(target, { type: "card/dismiss", id: "second" }, { expectedVersion: moved.version - 1 })).toMatchObject({ ok: false, reason: "conflict" });
  expect(storage.saved().dismissedCards).toEqual(["first"]);
});

it("refuses a command made for an earlier salon: a new sample business or a new day", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitAction, currentTarget, startBusiness } = await modules();
  const old = currentTarget()!;
  await startBusiness();
  const fresh = currentTarget()!;
  expect(fresh.epoch).not.toBe(old.epoch);
  const saved = storage.items.get("salong-eko-demo");
  expect(await commitAction(old, { type: "card/dismiss", id: "late" })).toMatchObject({ ok: false, reason: "replaced" });
  expect(storage.items.get("salong-eko-demo")).toBe(saved);
  expect((await commitAction(fresh, { type: "card/dismiss", id: "now" })).ok).toBe(true);
  // Yesterday's sample business has another lifetime than today's.
  expect(await commitAction({ workspace: "demo", epoch: fresh.epoch.replace(today, addDays(today, -1)) }, { type: "card/dismiss", id: "yesterday" })).toMatchObject({ ok: false, reason: "replaced" });
  // No trial salon is open: a command for one finds nothing.
  expect(await commitAction({ workspace: "own", epoch: "legacy" }, { type: "card/dismiss", id: "own" })).toMatchObject({ ok: false, reason: "not-found" });
});

it("never replays an idempotency key from a salon another tab replaced", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitAction, currentTarget } = await modules();
  const dismiss = { type: "card/dismiss" as const, id: "welcome" };
  expect((await commitAction(currentTarget()!, dismiss, { idempotencyKey: "k-1" })).ok).toBe(true);
  // Another tab starts a new sample business.
  storage.items.set("salong-eko-demo", JSON.stringify(createDemoState(today)));
  storage.items.set("salong-eko-demo-epoch", "another-tab");
  const target = currentTarget()!;
  const again = await commitAction(target, dismiss, { idempotencyKey: "k-1" });
  expect(again).toMatchObject({ ok: true, replayed: false });
  expect(storage.saved().dismissedCards).toEqual(["welcome"]);
  // A different action with that key is a new command in the new salon, not a mismatch.
  storage.items.set("salong-eko-demo", JSON.stringify(createDemoState(today)));
  storage.items.set("salong-eko-demo-epoch", "a-third-tab");
  expect(await commitAction(currentTarget()!, { type: "card/dismiss", id: "other" }, { idempotencyKey: "k-1" })).toMatchObject({ ok: true, replayed: false });
});

it("keeps a write another tab made while the commit was checking", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitAction, currentTarget } = await modules();
  let first = true;
  const guard = () => {
    if (first) storage.items.set("salong-eko-demo", JSON.stringify({ ...storage.saved(), dismissedCards: ["theirs"] }));
    first = false;
    return true;
  };
  expect((await commitAction(currentTarget()!, { type: "card/dismiss", id: "mine" }, { guard })).ok).toBe(true);
  expect(storage.saved().dismissedCards).toEqual(["theirs", "mine"]);
});

it("refuses yesterday's command after midnight in a tab left open, with storage unchanged", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    const day = "2026-11-20";
    vi.setSystemTime(new Date(`${day}T12:00:00`));
    const storage = tab(createDemoState(day));
    const { commitAction, currentTarget } = await modules();
    const yesterday = currentTarget()!;
    const before = storage.items.get("salong-eko-demo");
    vi.setSystemTime(new Date(`${addDays(day, 1)}T09:00:00`));
    expect(await commitAction(yesterday, { type: "card/dismiss", id: "late" })).toMatchObject({ ok: false, reason: "replaced" });
    expect(storage.items.get("salong-eko-demo")).toBe(before);
    const next = currentTarget()!;
    expect(next.epoch).not.toBe(yesterday.epoch);
    const result = await commitAction(next, { type: "card/dismiss", id: "now" });
    expect(result.ok && result.state.generatedFor).toBe(addDays(day, 1));
  } finally {
    vi.useRealTimers();
  }
});

it("saves a replacement's lifetime in the same write: another tab never sees the new salon with the old one", async () => {
  const storage = tab(createDemoState(today));
  const tabA = await modules();
  const old = tabA.currentTarget()!;
  await tabA.startBusiness();
  const fresh = tabA.currentTarget()!;
  expect(JSON.parse(storage.items.get("salong-eko-demo")!).epoch).toBe(fresh.epoch.split(":")[0]);
  // Another tab: its own store over the same storage.
  vi.resetModules();
  const tabB = await modules();
  expect(tabB.currentTarget()).toEqual(fresh);
  expect(await tabB.commitAction(old, { type: "card/dismiss", id: "late" })).toMatchObject({ ok: false, reason: "replaced" });
  expect(tabB.currentState()).not.toHaveProperty("epoch");
});

it("keeps a replacement that cannot be saved, with its new lifetime, in the replacing tab only", async () => {
  const storage = tab(createDemoState(today));
  const tabA = await modules();
  const old = tabA.currentTarget()!;
  const before = storage.items.get("salong-eko-demo");
  storage.hooks.refuse = (key) => key === "salong-eko-demo";
  await tabA.startBusiness();
  const fresh = tabA.currentTarget()!;
  expect(fresh.epoch).not.toBe(old.epoch);
  expect(await tabA.commitAction(old, { type: "card/dismiss", id: "late" })).toMatchObject({ ok: false, reason: "replaced" });
  // Another tab still reads the earlier salon, whole: its commands still fit it.
  expect(storage.items.get("salong-eko-demo")).toBe(before);
  storage.hooks.refuse = undefined;
  vi.resetModules();
  const tabB = await modules();
  expect(tabB.currentTarget()).toEqual(old);
});

it("reads a lifetime from the earlier separate key and moves it into the salon on the next save", async () => {
  const storage = tab(createDemoState(today));
  storage.items.set("salong-eko-demo-epoch", "earlier");
  const { commitAction, currentTarget } = await modules();
  const target = currentTarget()!;
  expect(target.epoch).toBe(`earlier:${today}`);
  expect((await commitAction(target, { type: "card/dismiss", id: "x" })).ok).toBe(true);
  expect(JSON.parse(storage.items.get("salong-eko-demo")!).epoch).toBe("earlier");
  expect(storage.items.has("salong-eko-demo-epoch")).toBe(false);
  expect(currentTarget()).toEqual(target);
});

it("sends nothing for a change that holds the same data as before", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitAction, currentTarget, sms } = await modules();
  const { textWaitlistAboutGaps } = await import("@/concept/booking/waitlist-offer");
  const before = storage.items.get("salong-eko-demo");
  const result = await commitAction(currentTarget()!, { type: "service/price", id: "no-such-service", price: 500 }, { send: (current) => textWaitlistAboutGaps(current, today) });
  expect(result).toMatchObject({ ok: false, reason: "rejected" });
  expect(sms()).toEqual([]);
  expect(storage.items.get("salong-eko-demo")).toBe(before);
});

it("publishes a commit's effects once, after the save, and nothing for a refusal", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitAction, currentTarget, sms } = await modules();
  const target = currentTarget()!;
  expect(await commitAction(target, remind(state), { send: () => false })).toMatchObject({ ok: false, reason: "rejected" });
  expect(sms()).toEqual([]);
  let atSave = -1;
  storage.hooks.beforeSave = () => { atSave = sms().length; };
  const result = await commitAction(target, remind(state));
  expect(atSave).toBe(0);
  expect(result.ok && result.effects.map((effect) => effect.record.id)).toEqual(sms().map((record) => record.id));
  expect(sms()).toHaveLength(1);
});

it("shows Undo bound to the salon the change was made in", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitWithUndoToast, currentTarget, dispatchWithLog } = await modules();
  const result = await commitWithUndoToast(currentTarget()!, { type: "booking/cancel", id: upcoming(state).id }, "Cancelled");
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const [message, undo] = showToast.mock.calls.at(-1)!;
  expect(message).toBe("Cancelled");
  expect(undo.label).toBeTruthy();
  // Before Undo is pressed, another tab replaces the salon, and a change there gets the same log id.
  const other = createDemoState(today);
  storage.items.set("salong-eko-demo", JSON.stringify(other));
  storage.items.set("salong-eko-demo-epoch", "another-tab");
  const visit = upcoming(other);
  expect(dispatchWithLog({ type: "booking/cancel", id: visit.id })).toBe(result.logId);
  const replaced = storage.items.get("salong-eko-demo");
  undo.run();
  await vi.waitFor(() => expect(showToast.mock.calls.length + showActionFailure.mock.calls.length).toBeGreaterThan(1));
  expect(storage.items.get("salong-eko-demo")).toBe(replaced);
  expect(storage.saved().bookings.find((b) => b.id === visit.id)?.status).toBe("cancelled");
  // The other salon's entry with that id is not consulted: the generic refusal, not its booking reason.
  expect(showActionFailure).not.toHaveBeenCalled();
  expect(showToast).toHaveBeenLastCalledWith(t("log.cannotUndo"));
});

it("takes the change back when Undo is pressed in the same salon", async () => {
  const state = createDemoState(today);
  const storage = tab(state);
  const { commitWithUndoToast, currentTarget } = await modules();
  const booking = upcoming(state);
  await commitWithUndoToast(currentTarget()!, { type: "booking/cancel", id: booking.id }, "Cancelled");
  const [, undo] = showToast.mock.calls.at(-1)!;
  undo.run();
  await vi.waitFor(() => expect(storage.saved().bookings.find((b) => b.id === booking.id)?.status).toBe("booked"));
});

it("keeps the dispatch helpers synchronous with their return types", async () => {
  const state = createDemoState(today);
  tab(state);
  const { dispatch, dispatchWithLog, dispatchWithUndoToast } = await modules();
  const results = [
    dispatch({ type: "card/dismiss", id: "a" }),
    dispatch({ type: "card/dismiss", id: "a" }),
    dispatchWithLog({ type: "card/dismiss", id: "b" }),
    dispatchWithLog({ type: "booking/cancel", id: upcoming(state).id }),
    dispatchWithLog({ type: "booking/cancel", id: "no-such-booking" }),
    dispatchWithUndoToast({ type: "card/dismiss", id: "c" }, "Hidden"),
  ];
  expect(results.map((value) => (value === null ? "null" : typeof value))).toEqual(["boolean", "boolean", "null", "string", "boolean", "boolean"]);
  expect(results).toEqual([true, false, null, expect.stringMatching(/^l-/), false, true]);
});

it("runs one commit at a time behind useCommit's gate", async () => {
  const { pendingGate } = await import("@/concept/ui/use-commit");
  const changes: boolean[] = [];
  const run = pendingGate((pending) => changes.push(pending));
  let release!: () => void;
  const first = run(() => new Promise<string>((resolve) => { release = () => resolve("saved"); }));
  expect(await run(async () => "second")).toBeUndefined();
  release();
  expect(await first).toBe("saved");
  expect(await run(async () => "third")).toBe("third");
  expect(changes).toEqual([true, false, true, false]);
  await expect(run(async () => { throw new Error("refused"); })).rejects.toThrow("refused");
  expect(await run(async () => "after a failure")).toBe("after a failure");
});
