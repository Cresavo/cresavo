import { expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import { bookableServices } from "@/concept/selectors";
import { MemoryStudioStore } from "@/concept/store/memory-studio-store";
import { runStudioStoreContract } from "./contract";

const today = toKey(new Date());

/** A fixed clock that moves one second per reading, so runs repeat exactly. */
function steppingClock(start = Date.now()) {
  let now = start;
  return () => (now += 1000);
}

runStudioStoreContract("MemoryStudioStore", async (seeds) => {
  const store = new MemoryStudioStore({ tenants: { "salon-a": seeds.a, "salon-b": seeds.b }, now: steppingClock() });
  return {
    store,
    tenants: { a: "salon-a", b: "salon-b" },
    open: async () => {},
    payments: (tenantId) => store.published(tenantId).filter((record) => record.port === "payments"),
  };
});

it("reports unknown, unmigratable and malformed tenants as missing", async () => {
  const store = new MemoryStudioStore({
    tenants: { ancient: { version: 3 }, broken: "not a state", halfV21: { version: 21 }, emptyCurrent: { version: DEMO_VERSION } },
  });
  for (const id of ["nobody", "ancient", "broken", "halfV21", "emptyCurrent"]) {
    expect(await store.load(id)).toBeNull();
    expect(await store.apply(id, { type: "card/dismiss", id: "x" })).toEqual({ ok: false, reason: "not-found" });
  }
});

it("stamps log entries with the injected clock and copies seeds like a database", async () => {
  const seed = createDemoState(today);
  const store = new MemoryStudioStore({ tenants: { t: seed }, now: () => 1_700_000_000_000 });
  seed.dismissedCards.push("mutated-after-seed");
  const result = await store.apply("t", { type: "card/dismiss", id: "c" });
  expect(result.ok && result.entry.at).toBe(1_700_000_000_000);
  expect((await store.load("t"))?.state.dismissedCards).not.toContain("mutated-after-seed");
});

it("judges checkout holds by the store clock, not the wall clock", async () => {
  const base = createDemoState(today);
  const service = bookableServices(base)[0];
  const state = { ...base, cancellationPolicy: { ...DEFAULT_POLICY, deposits: { [service.id]: 20_000 } } };
  const staffId = service.staffIds[0];
  const date = Array.from({ length: 21 }, (_, i) => addDays(today, i + 1)).find((day) => freeStarts(state, staffId, day, needOf(service)).length)!;
  const start = freeStarts(state, staffId, date, needOf(service))[0];
  // An hour behind the wall clock: a ten-minute hold is still active on the store's clock.
  const store = new MemoryStudioStore({ tenants: { t: state }, now: () => Date.now() - 3_600_000 });
  const hold = (phone: string): DemoAction => ({
    type: "online/hold", serviceId: service.id, staffId, date, start,
    guest: { name: "Fictional Guest", phone, at: { date: today, time: 8 * 60 } },
    notice: { title: "Demo request", body: "Demo appointment" },
  });
  expect((await store.apply("t", hold("0700009911"))).ok).toBe(true);
  expect(await store.apply("t", hold("0700009922"))).toMatchObject({ ok: false, reason: "rejected" });
  const customer = state.customers[0];
  expect(await store.apply("t", { type: "booking/create", customerId: customer.id, serviceId: service.id, staffId, date, start, source: "phone" }))
    .toMatchObject({ ok: false, reason: "rejected" });
});

it("sends each tenant's messages through its own adapter, after the commit", async () => {
  const base = createDemoState(today);
  const booking = base.bookings.find((b) => b.status === "booked" && b.date > today)!;
  const other = base.customers.find((c) => c.id !== booking.customerId)!;
  // Same booking id, slot and text; a different customer in the second salon.
  const twin = { ...base, bookings: base.bookings.map((b) => (b.id === booking.id ? { ...b, customerId: other.id } : b)) };
  const store = new MemoryStudioStore({ tenants: { one: base, two: twin } });
  const send: DemoAction = { type: "booking-message/send", bookingId: booking.id, kind: "confirmation", channel: "sms", at: { date: today, time: 0 } };
  const one = await store.apply("one", send);
  const two = await store.apply("two", send);
  expect(one.ok && two.ok).toBe(true);
  expect(one.ok && one.effects.map((e) => [e.kind, e.record.to])).toEqual([["message", `customer:${booking.customerId}`]]);
  expect(store.published("one").map((r) => r.to)).toEqual([`customer:${booking.customerId}`]);
  expect(store.published("two").map((r) => r.to)).toEqual([`customer:${other.id}`]);
  // A conflicting apply publishes no message.
  const conflict = await store.apply("one", { ...send, kind: "reminder" }, {}, { expectedVersion: 0 });
  expect(conflict).toMatchObject({ ok: false, reason: "conflict" });
  expect(store.published("one")).toHaveLength(1);
});

it("pages a long log in steps proportional to the page", async () => {
  const store = new MemoryStudioStore({ tenants: { t: createDemoState(today) } });
  for (let i = 0; i < 30; i++) await store.apply("t", { type: "card/dismiss", id: `p${i}` });
  const seqs: number[] = [];
  let after: number | null = 0;
  while (after !== null) {
    const page: Awaited<ReturnType<MemoryStudioStore["history"]>> = await store.history("t", { after, limit: 7 });
    seqs.push(...page.entries.map((e) => e.seq));
    after = page.next;
  }
  expect(seqs).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  expect((await store.history("t", { after: 30, limit: 7 }))).toEqual({ entries: [], next: null });
});
