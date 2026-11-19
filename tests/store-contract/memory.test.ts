import { expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { toKey } from "@/concept/data/dates";
import { MemoryStudioStore } from "@/concept/store/memory-studio-store";
import { runStudioStoreContract } from "./contract";

/** A fixed clock that moves one second per reading, so runs repeat exactly. */
function steppingClock(start = Date.now()) {
  let now = start;
  return () => (now += 1000);
}

runStudioStoreContract("MemoryStudioStore", async (seeds) => {
  const store = new MemoryStudioStore({ tenants: { "salon-a": seeds.a, "salon-b": seeds.b }, now: steppingClock() });
  return { store, tenants: { a: "salon-a", b: "salon-b" }, open: async () => {} };
});

it("reports unknown and unmigratable tenants as missing", async () => {
  const store = new MemoryStudioStore({ tenants: { ancient: { version: 3 }, broken: "not a state" } });
  expect(await store.load("nobody")).toBeNull();
  expect(await store.load("ancient")).toBeNull();
  expect(await store.load("broken")).toBeNull();
  expect(await store.apply("nobody", { type: "card/dismiss", id: "x" })).toEqual({ ok: false, reason: "not-found" });
});

it("stamps log entries with the injected clock and copies seeds like a database", async () => {
  const seed = createDemoState(toKey(new Date()));
  const store = new MemoryStudioStore({ tenants: { t: seed }, now: () => 1_700_000_000_000 });
  seed.dismissedCards.push("mutated-after-seed");
  const result = await store.apply("t", { type: "card/dismiss", id: "c" });
  expect(result.ok && result.entry.at).toBe(1_700_000_000_000);
  expect((await store.load("t"))?.state.dismissedCards).not.toContain("mutated-after-seed");
});
