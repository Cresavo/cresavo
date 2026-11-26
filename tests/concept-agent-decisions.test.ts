import { describe, expect, it, vi } from "vitest";
import { decisionOutbox, type DecisionStorage } from "@/concept/studio/inbox/agent-decisions";

const memoryStorage = (): DecisionStorage => {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) };
};
const proposals = [{ id: "ap-1" }, { id: "ap-2" }];

describe("agent proposal decisions", () => {
  it("applies an approval once even when the server never acknowledged it", async () => {
    const storage = memoryStorage();
    const apply = vi.fn(() => "log-1");
    const failing = vi.fn(() => Promise.reject(new Error("offline")));
    const first = decisionOutbox(() => storage);
    expect(first.decide("ap-1", true, apply, failing, 1_000)).toBe("log-1");
    expect(failing).toHaveBeenCalledWith("ap-1", "approved");

    // A reload: the server still lists the proposal as pending.
    const reloaded = decisionOutbox(() => storage);
    expect(reloaded.undecided(proposals)).toEqual([{ id: "ap-2" }]);
    expect(reloaded.decide("ap-1", true, apply, failing, 2_000)).toBeNull();
    expect(apply).toHaveBeenCalledTimes(1);

    const send = vi.fn(() => Promise.resolve());
    await reloaded.reconcile(["ap-1", "ap-2"], 3_000, send);
    expect(send).toHaveBeenCalledExactlyOnceWith("ap-1", "approved");
  });

  it("forgets a decision once the server no longer lists the proposal", async () => {
    const storage = memoryStorage();
    const outbox = decisionOutbox(() => storage);
    outbox.decide("ap-1", false, () => "unused", () => Promise.resolve(), 1_000);
    const send = vi.fn(() => Promise.resolve());

    await outbox.reconcile(["ap-2"], 500, send);
    expect(outbox.undecided(proposals)).toEqual([{ id: "ap-2" }]);
    await outbox.reconcile(["ap-2"], 1_500, send);
    expect(send).not.toHaveBeenCalled();
    expect(outbox.undecided(proposals)).toEqual(proposals);
  });

  it("reports a failed apply and keeps decisions in memory without storage", () => {
    const outbox = decisionOutbox(() => {
      throw new Error("storage blocked");
    });
    const send = vi.fn(() => Promise.resolve());
    expect(outbox.decide("ap-1", true, () => false, send)).toBe(false);
    expect(send).toHaveBeenCalledWith("ap-1", "failed");
    expect(outbox.undecided(proposals)).toEqual([{ id: "ap-2" }]);
  });
});
