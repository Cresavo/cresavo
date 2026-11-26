import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createProposal, decideProposal, findProposal, resetDemoBusiness } from "@/concept/server/demo-business";
import type { ChangeDraft } from "@/concept/tools/define";

// Monday 16 November 2026, 09:00 in Stockholm.
const NOW = Date.parse("2026-11-16T08:00:00Z");

const draft = (): ChangeDraft => ({ title: "Invented change", rows: [], action: { type: "inbox/read-all" }, toast: "Done" });
const propose = (key: string, fingerprint = `fp-${key}`, at = NOW) =>
  createProposal({ caller: "caller-1", key, tool: "propose_test", client: "agent", fingerprint, draft }, at);

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterAll(() => vi.useRealTimers());
beforeEach(() => resetDemoBusiness());

describe("agent proposal idempotency", () => {
  it("replays the first proposal for the same key and request", () => {
    const first = propose("key-1");
    expect(propose("key-1")).toEqual({ proposal: "proposal" in first && first.proposal, replayed: true });
    expect(propose("key-1", "other")).toEqual({ conflict: true });
  });

  it("never drafts again for a key whose proposal no longer fits in the list", () => {
    const first = propose("old-key");
    if (!("proposal" in first)) throw new Error("expected a proposal");
    for (let index = 0; index < 50; index += 1) propose(`newer-${index}`, undefined, NOW + index + 1);
    expect(findProposal(first.proposal.id)).toBeUndefined();

    expect(propose("old-key", undefined, NOW + 100)).toEqual({ expired: true });
    expect(propose("old-key", "other", NOW + 100)).toEqual({ conflict: true });
    expect(decideProposal(first.proposal.id, "approved", NOW + 100)).toBeUndefined();
  });
});
