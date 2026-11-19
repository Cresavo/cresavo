import { describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import { DEFAULT_REMINDER_SETTINGS } from "@/concept/booking/reminders";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState, DEMO_VERSION } from "@/concept/data/generate";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { DemoState, Service, StaffId } from "@/concept/data/types";
import { createSalon, salonDraft } from "@/concept/onboarding/salon";
import { bookableServices } from "@/concept/selectors";
import type { OutboxEntry } from "@/concept/connections/simulated/outbox";
import type { StoreChange, StudioStore, TenantId } from "@/concept/store/studio-store";

// The behaviour every StudioStore must have. Each implementation runs it with
// `runStudioStoreContract(name, makeStore)`; the Postgres store in step 2
// must pass it unchanged. All people, phone numbers and salons are fictional.

/** Saved documents for two tenants: `a` is a sample business, `b` an owner's own salon. */
export interface ContractSeeds {
  a: unknown;
  b: unknown;
}

export interface ContractHarness {
  store: StudioStore;
  tenants: { a: TenantId; b: TenantId };
  /**
   * Makes a tenant the open one, for stores that serve one at a time (a
   * browser tab). A no-op for stores that serve every tenant at once.
   */
  open(tenantId: TenantId): Promise<void>;
  /** Every payment the store has actually published for this tenant (the recording sink), oldest first. */
  payments(tenantId: TenantId): OutboxEntry[];
}

export type MakeStore = (seeds: ContractSeeds) => Promise<ContractHarness>;

const today = toKey(new Date());

interface Slot { staffId: StaffId; date: string; start: number }

/** The first free start for a treatment from tomorrow on. */
function freeSlot(state: DemoState, service: Service): Slot {
  for (let i = 1; i <= 21; i++) {
    const date = addDays(today, i);
    for (const staffId of service.staffIds) {
      const start = freeStarts(state, staffId, date, needOf(service))[0];
      if (start !== undefined) return { staffId, date, start };
    }
  }
  throw new Error(`No free slot for ${service.id}`);
}

/** Sample business with a card deposit on one treatment, so paying it stages a payment. */
function sampleSeed(): DemoState {
  const base = createDemoState(today);
  const [deposit] = bookableServices(base);
  return { ...base, cancellationPolicy: { ...DEFAULT_POLICY, deposits: { [deposit.id]: 20_000 } } };
}

function ownSeed(): DemoState {
  return createSalon(today, { ...salonDraft("en"), name: "Studio Vide" });
}

function fixture(state: DemoState) {
  const [deposit, ...rest] = bookableServices(state);
  const plain = rest.find((service) => service.price > 0) ?? rest[0];
  const [first, second] = state.customers;
  return { deposit, plain, first, second };
}

function create(customerId: string, service: Service, slot: Slot): DemoAction {
  return { type: "booking/create", customerId, serviceId: service.id, ...slot, source: "phone" };
}

function hold(service: Service, slot: Slot): DemoAction {
  return {
    type: "online/hold", serviceId: service.id, ...slot,
    guest: { name: "Fictional Guest", phone: "0700009911", at: { date: today, time: 8 * 60 } },
    notice: { title: "Demo request", body: "Demo appointment" },
  };
}

const at = (state: DemoState, slot: Slot) =>
  state.bookings.filter((b) => b.status !== "cancelled" && b.staffId === slot.staffId && b.date === slot.date && b.start === slot.start);

export function runStudioStoreContract(name: string, makeStore: MakeStore) {
  describe(`StudioStore contract: ${name}`, () => {
    async function setup(seeds: Partial<ContractSeeds> = {}) {
      const harness = await makeStore({ a: seeds.a ?? sampleSeed(), b: seeds.b ?? ownSeed() });
      const { store, tenants } = harness;
      const loaded = await store.load(tenants.a);
      if (!loaded) throw new Error("Tenant a did not load");
      return { ...harness, store, a: tenants.a, b: tenants.b, initial: loaded, ...fixture(loaded.state) };
    }

    /** Holds the deposit treatment and returns the pay action for it. */
    async function heldPayment(store: StudioStore, tenant: TenantId, state: DemoState) {
      const { deposit } = fixture(state);
      const held = await store.apply(tenant, hold(deposit, freeSlot(state, deposit)));
      if (!held.ok) throw new Error(`Hold refused: ${held.reason}`);
      const pay: DemoAction = { type: "online/pay", id: held.state.checkoutHolds.at(-1)!.id, method: "card" };
      return { held, pay };
    }

    it("returns what it committed: apply, then load sees the same state and version", async () => {
      const { store, a, initial, plain, first } = await setup();
      const slot = freeSlot(initial.state, plain);
      const result = await store.apply(a, create(first.id, plain, slot));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.replayed).toBe(false);
      expect(at(result.state, slot)).toHaveLength(1);
      const loaded = await store.load(a);
      expect(loaded?.version).toBe(result.version);
      expect(at(loaded!.state, slot).map((b) => b.customerId)).toEqual([first.id]);
      expect(loaded!.state.version).toBe(DEMO_VERSION);
    });

    it("increments the version by one per commit and not for a refusal", async () => {
      const { store, a, initial } = await setup();
      const one = await store.apply(a, { type: "card/dismiss", id: "card-one" });
      const two = await store.apply(a, { type: "card/dismiss", id: "card-two" });
      const refused = await store.apply(a, { type: "card/dismiss", id: "card-two" });
      expect(one.ok && one.version).toBe(initial.version + 1);
      expect(two.ok && two.version).toBe(initial.version + 2);
      expect(refused).toMatchObject({ ok: false, reason: "rejected" });
      expect((await store.load(a))?.version).toBe(initial.version + 2);
    });

    it("refuses a stale expectedVersion with conflict and changes nothing", async () => {
      const { store, a, initial, plain, first } = await setup();
      await store.apply(a, { type: "card/dismiss", id: "moved-on" }, {}, { expectedVersion: initial.version });
      const before = await store.load(a);
      const result = await store.apply(a, create(first.id, plain, freeSlot(initial.state, plain)), {}, { expectedVersion: initial.version });
      expect(result).toMatchObject({ ok: false, reason: "conflict" });
      const after = await store.load(a);
      expect(after?.version).toBe(before?.version);
      expect(JSON.stringify(after?.state)).toBe(JSON.stringify(before?.state));
      expect((await store.history(a, { limit: 10 })).entries).toHaveLength(1);
      const current = await store.apply(a, create(first.id, plain, freeSlot(initial.state, plain)), {}, { expectedVersion: after!.version });
      expect(current.ok).toBe(true);
    });

    it("replays an idempotency key: same result, one log entry, the card is charged once", async () => {
      const harness = await setup();
      const { store, a, initial } = harness;
      const { pay } = await heldPayment(store, a, initial.state);
      const changes: StoreChange[] = [];
      store.subscribe(a, (change) => changes.push(change));
      const sunk = harness.payments(a).length;
      const first = await store.apply(a, pay, {}, { idempotencyKey: "pay-1" });
      expect(harness.payments(a)).toHaveLength(sunk + 1);
      // A later commit must not leak into the replayed result.
      expect((await store.apply(a, { type: "card/dismiss", id: "in-between" })).ok).toBe(true);
      const again = await store.apply(a, pay, {}, { idempotencyKey: "pay-1" });
      expect(first.ok && again.ok).toBe(true);
      if (!first.ok || !again.ok) return;
      expect(again.replayed).toBe(true);
      expect(again.version).toBe(first.version);
      expect(JSON.stringify(again.state)).toBe(JSON.stringify(first.state));
      expect(again.state.dismissedCards).not.toContain("in-between");
      expect(again.entry).toEqual(first.entry);
      expect(again.effects.map((e) => e.record.id)).toEqual(first.effects.map((e) => e.record.id));
      expect(first.effects.length).toBeGreaterThan(0);
      expect(harness.payments(a)).toHaveLength(sunk + 1);
      expect(harness.payments(a).at(-1)?.id).toBe(first.effects.find((e) => e.kind === "payment")?.record.id);
      expect(changes).toHaveLength(2);
      const log = (await store.history(a, { limit: 10 })).entries;
      expect(log.filter((entry) => entry.action.type === "online/pay")).toHaveLength(1);
      expect(log.find((entry) => entry.action.type === "online/pay")?.idempotencyKey).toBe("pay-1");
      expect((await store.load(a))?.version).toBe(first.version + 1);
      // Without the key the reducer still refuses to charge a spent hold again.
      expect(await store.apply(a, pay)).toMatchObject({ ok: false, reason: "rejected" });
      expect(changes).toHaveLength(2);
      expect(harness.payments(a)).toHaveLength(sunk + 1);
    });

    it("refuses an idempotency key reused for a different action", async () => {
      const { store, a } = await setup();
      expect((await store.apply(a, { type: "card/dismiss", id: "k1" }, {}, { idempotencyKey: "same" })).ok).toBe(true);
      expect(await store.apply(a, { type: "card/dismiss", id: "k2" }, {}, { idempotencyKey: "same" })).toMatchObject({ ok: false, reason: "idempotency-mismatch" });
      expect((await store.history(a, { limit: 10 })).entries).toHaveLength(1);
    });

    it("does not remember a refused apply's key, so a retry runs the rules again", async () => {
      const { store, a, initial, plain, first, second } = await setup();
      const slot = freeSlot(initial.state, plain);
      const booked = await store.apply(a, create(first.id, plain, slot));
      if (!booked.ok) throw new Error("booking refused");
      const attempt = create(second.id, plain, slot);
      expect(await store.apply(a, attempt, {}, { idempotencyKey: "retry" })).toMatchObject({ ok: false, reason: "rejected" });
      const id = at(booked.state, slot)[0].id;
      expect((await store.apply(a, { type: "booking/cancel", id })).ok).toBe(true);
      const retried = await store.apply(a, attempt, {}, { idempotencyKey: "retry" });
      expect(retried.ok && retried.replayed).toBe(false);
    });

    it("leaves state, version and log unchanged when the reducer refuses", async () => {
      const { store, a, initial, plain, first, second } = await setup();
      const slot = freeSlot(initial.state, plain);
      await store.apply(a, create(first.id, plain, slot));
      const before = await store.load(a);
      const changes: StoreChange[] = [];
      store.subscribe(a, (change) => changes.push(change));
      const refusals: DemoAction[] = [
        { type: "booking/cancel", id: "no-such-booking" },
        create(second.id, plain, slot),
        { type: "booking/create", customerId: second.id, serviceId: "no-such-service", ...slot, source: "phone" },
        // A valid price for a treatment that does not exist: the reducer returns an identical copy.
        { type: "service/price", id: "no-such-service", price: 500 },
      ];
      for (const [i, action] of refusals.entries()) {
        expect(await store.apply(a, action, {}, { idempotencyKey: `refused-${i}` })).toMatchObject({ ok: false, reason: "rejected" });
      }
      const after = await store.load(a);
      expect(after?.version).toBe(before?.version);
      expect(JSON.stringify(after?.state)).toBe(JSON.stringify(before?.state));
      expect((await store.history(a, { limit: 10 })).entries).toHaveLength(1);
      expect(changes).toHaveLength(0);
    });

    it("publishes effects only after the commit, and never for a conflict or refusal", async () => {
      const harness = await setup();
      const { store, a, initial } = harness;
      const { held, pay } = await heldPayment(store, a, initial.state);
      const sunk = harness.payments(a).length;
      const changes: StoreChange[] = [];
      let seenByListener: Promise<unknown> | undefined;
      store.subscribe(a, (change) => {
        changes.push(change);
        seenByListener ??= store.load(a);
      });
      expect(await store.apply(a, pay, {}, { expectedVersion: held.version - 1 })).toMatchObject({ ok: false, reason: "conflict" });
      expect(await store.apply(a, { ...pay, id: "no-such-hold" })).toMatchObject({ ok: false, reason: "rejected" });
      expect(changes).toHaveLength(0);
      expect(harness.payments(a)).toHaveLength(sunk);
      const paid = await store.apply(a, pay, {}, { expectedVersion: held.version });
      expect(paid.ok).toBe(true);
      if (!paid.ok) return;
      expect(paid.effects.filter((e) => e.kind === "payment")).toEqual([expect.objectContaining({ kind: "payment", record: expect.objectContaining({ port: "payments", action: "checkout" }) })]);
      expect(harness.payments(a).slice(sunk)).toEqual([paid.effects.find((e) => e.kind === "payment")!.record]);
      expect(changes).toEqual([{ tenantId: a, version: paid.version, entry: paid.entry, effects: paid.effects }]);
      // The listener already reads the committed state.
      const loaded = (await seenByListener) as Awaited<ReturnType<StudioStore["load"]>>;
      expect(loaded?.version).toBe(paid.version);
      expect(loaded?.state.bookings.some((b) => b.protection?.deposit?.id)).toBe(true);
    });

    it("never double-books: two concurrent applies for one slot, one wins", async () => {
      const { store, a, initial, plain, first, second } = await setup();
      const slot = freeSlot(initial.state, plain);
      const results = await Promise.all([
        store.apply(a, create(first.id, plain, slot)),
        store.apply(a, create(second.id, plain, slot)),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, reason: "rejected" });
      expect(at((await store.load(a))!.state, slot)).toHaveLength(1);

      const next = freeSlot((await store.load(a))!.state, plain);
      const { version } = (await store.load(a))!;
      const raced = await Promise.all([
        store.apply(a, create(first.id, plain, next), {}, { expectedVersion: version }),
        store.apply(a, create(second.id, plain, next), {}, { expectedVersion: version }),
      ]);
      expect(raced.filter((r) => r.ok)).toHaveLength(1);
      expect(raced.find((r) => !r.ok)).toMatchObject({ ok: false, reason: "conflict" });
      expect(at((await store.load(a))!.state, next)).toHaveLength(1);
    });

    it("frees a cancelled slot for a new booking", async () => {
      const { store, a, initial, plain, first, second } = await setup();
      const slot = freeSlot(initial.state, plain);
      const booked = await store.apply(a, create(first.id, plain, slot));
      if (!booked.ok) throw new Error("booking refused");
      const id = at(booked.state, slot)[0].id;
      expect((await store.apply(a, { type: "booking/cancel", id })).ok).toBe(true);
      expect(await store.apply(a, { type: "booking/cancel", id })).toMatchObject({ ok: false, reason: "rejected" });
      const rebooked = await store.apply(a, create(second.id, plain, slot));
      expect(rebooked.ok).toBe(true);
      expect(at((await store.load(a))!.state, slot).map((b) => b.customerId)).toEqual([second.id]);
    });

    it("deletes a customer so a later load no longer has them", async () => {
      const { store, a, second } = await setup();
      expect((await store.apply(a, { type: "customer/delete", id: second.id })).ok).toBe(true);
      const state = (await store.load(a))!.state;
      expect(state.customers.some((c) => c.id === second.id)).toBe(false);
      expect(state.bookings.some((b) => b.customerId === second.id && b.status === "booked")).toBe(false);
    });

    it("keeps history in commit order and pages through it", async () => {
      const { store, a, initial } = await setup();
      const ids = ["h1", "h2", "h3", "h4", "h5"];
      for (const id of ids) await store.apply(a, { type: "card/dismiss", id }, { actor: "staff" });
      const first = await store.history(a, { limit: 2 });
      expect(first.entries.map((e) => e.seq)).toEqual([1, 2]);
      expect(first.next).toBe(2);
      const second = await store.history(a, { after: first.next!, limit: 2 });
      expect(second.entries.map((e) => e.seq)).toEqual([3, 4]);
      const last = await store.history(a, { after: second.next!, limit: 2 });
      expect(last.entries.map((e) => e.seq)).toEqual([5]);
      expect(last.next).toBeNull();
      const all = (await store.history(a, { limit: 100 })).entries;
      expect(all.map((e) => (e.action as { id: string }).id)).toEqual(ids);
      expect(all.map((e) => e.resultingVersion)).toEqual(ids.map((_, i) => initial.version + i + 1));
      expect(all.every((e, i) => e.tenantId === a && e.actor === "staff" && (i === 0 || e.at >= all[i - 1].at))).toBe(true);
      expect((await store.history(a, { after: 5, limit: 10 })).entries).toEqual([]);
    });

    it("isolates tenants: state, log, keys and notifications", async () => {
      const { store, a, b, open, initial } = await setup();
      const heard: TenantId[] = [];
      store.subscribe(b, (change) => heard.push(change.tenantId));
      expect((await store.apply(a, { type: "card/dismiss", id: "only-a" }, {}, { idempotencyKey: "shared-key" })).ok).toBe(true);
      expect(heard).toEqual([]);
      expect(await store.history(b, { limit: 10 })).toEqual({ entries: [], next: null });

      await open(b);
      const ownBefore = await store.load(b);
      expect(ownBefore?.state.salon.slug).not.toBe(initial.state.salon.slug);
      expect(ownBefore?.state.dismissedCards).not.toContain("only-a");
      const inB = await store.apply(b, { type: "card/dismiss", id: "only-b" }, {}, { idempotencyKey: "shared-key" });
      expect(inB.ok && inB.replayed).toBe(false);
      expect(heard).toEqual([b]);

      await open(a);
      const aAfter = await store.load(a);
      expect(aAfter?.state.dismissedCards).toContain("only-a");
      expect(aAfter?.state.dismissedCards).not.toContain("only-b");
      expect((await store.history(a, { limit: 10 })).entries.map((e) => e.tenantId)).toEqual([a]);
      expect((await store.history(b, { limit: 10 })).entries.map((e) => e.tenantId)).toEqual([b]);
    });

    it("hands out copies: editing results, actions, history or notifications changes nothing stored", async () => {
      const { store, a, initial, plain, first } = await setup();
      const slot = freeSlot(initial.state, plain);
      const action = create(first.id, plain, slot) as Extract<DemoAction, { type: "booking/create" }>;
      const payloads: StoreChange[] = [];
      store.subscribe(a, (change) => {
        payloads.push(change);
        (change.entry!.action as { start: number }).start = -1;
      });
      store.subscribe(a, (change) => payloads.push(change));
      const result = await store.apply(a, action, {}, { idempotencyKey: "copy" });
      if (!result.ok) throw new Error("booking refused");
      const before = JSON.stringify((await store.load(a))!.state);
      action.start = 0;
      result.state.bookings.length = 0;
      (result.entry.action as { start: number }).start = 1;
      const loaded = (await store.load(a))!;
      loaded.state.customers[0].firstName = "Changed";
      loaded.state.bookings.push({ ...loaded.state.bookings[0], id: "smuggled" });
      const page = await store.history(a, { limit: 10 });
      (page.entries[0].action as { start: number }).start = 2;
      expect(payloads[1].entry?.action).toMatchObject({ start: slot.start });
      expect(JSON.stringify((await store.load(a))!.state)).toBe(before);
      expect((await store.history(a, { limit: 10 })).entries[0].action).toMatchObject({ start: slot.start });
      const replay = await store.apply(a, { ...create(first.id, plain, slot) }, {}, { idempotencyKey: "copy" });
      expect(replay.ok && replay.replayed && at(replay.state, slot)).toHaveLength(1);
    });

    it("never throws on a malformed saved document", async () => {
      const harness = await makeStore({ a: { version: 21 }, b: ownSeed() });
      const loaded = await harness.store.load(harness.tenants.a);
      expect(loaded === null || loaded.state.version === DEMO_VERSION).toBe(true);
      const applied = await harness.store.apply(harness.tenants.a, { type: "card/dismiss", id: "x" });
      expect(applied.ok || ["not-found", "rejected"].includes(applied.reason)).toBe(true);
    });

    it("migrates an older saved state on load and keeps the owner's data", async () => {
      const seed = sampleSeed();
      const edited = { ...seed, customers: seed.customers.map((c, i) => (i === 0 ? { ...c, firstName: "Edited" } : c)) };
      // A v20 save: from before reminder settings (v21) and checkout holds (v22).
      const older: Record<string, unknown> = { ...edited, version: 20 };
      delete older.reminderSettings;
      delete older.checkoutHolds;
      const { store, a, initial, plain, first } = await setup({ a: older });
      expect(initial.state.version).toBe(DEMO_VERSION);
      expect(initial.state.reminderSettings).toEqual(DEFAULT_REMINDER_SETTINGS);
      expect(initial.state.checkoutHolds).toEqual([]);
      expect(initial.state.customers[0].firstName).toBe("Edited");
      expect(initial.state.bookings.map((b) => b.id)).toEqual(seed.bookings.map((b) => b.id));
      expect((await store.apply(a, create(first.id, plain, freeSlot(initial.state, plain)))).ok).toBe(true);
    });
  });
}
