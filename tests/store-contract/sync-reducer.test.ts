import { expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { reduce } from "@/concept/actions";
import { DEFAULT_POLICY } from "@/concept/booking/protection";
import { DEMO_CHANNEL_CURRENCY, withDemoChannels } from "@/concept/connections/demo";
import { channelLedger } from "@/concept/connections/simulated/adapters";
import { createOutbox } from "@/concept/connections/simulated/outbox";
import { addDays, toKey } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts, needOf, withSlotClock } from "@/concept/data/slots";
import type { DemoState } from "@/concept/data/types";
import { defaultMeta, prepareAction } from "@/concept/log/capture";
import { bookableServices } from "@/concept/selectors";

// The stores stage sends and the slot clock ambiently:
// withSlotClock(at, () => withDemoChannels(stage, () => prepareAction(...))).
// Both helpers restore their previous value when the callback returns, so an
// async reducer would run its awaited part with the shared outbox and the wall
// clock. This guard fails as soon as the reducer stops being synchronous.

const today = toKey(new Date());
const isThenable = (value: unknown) =>
  !!value && (typeof value === "object" || typeof value === "function") && typeof (value as { then?: unknown }).then === "function";

it("declares prepareAction and reduce as plain (non-async) functions", () => {
  for (const fn of [prepareAction, reduce]) {
    expect(fn.constructor.name).toBe("Function");
    expect(Object.prototype.toString.call(fn)).toBe("[object Function]");
  }
});

it("returns a state, never a Promise, for every kind of action the stores stage", () => {
  const base = createDemoState(today);
  const [deposit, ...rest] = bookableServices(base);
  let state: DemoState = { ...base, cancellationPolicy: { ...DEFAULT_POLICY, deposits: { [deposit.id]: 20_000 } } };
  const plain = rest.find((service) => service.price > 0) ?? rest[0];
  const free = (serviceId: string) => {
    const service = bookableServices(state).find((s) => s.id === serviceId)!;
    for (let i = 1; i <= 21; i++) {
      const date = addDays(today, i);
      for (const staffId of service.staffIds) {
        const start = freeStarts(state, staffId, date, needOf(service))[0];
        if (start !== undefined) return { staffId, date, start };
      }
    }
    throw new Error("no free slot");
  };
  const booking = state.bookings.find((b) => b.status === "booked" && b.date > today)!;
  const [first, second] = state.customers;
  const steps: Array<(s: DemoState) => DemoAction> = [
    () => ({ type: "card/dismiss", id: "sync-check" }),
    () => ({ type: "booking/create", customerId: first.id, serviceId: plain.id, ...free(plain.id), source: "phone" }),
    () => ({
      type: "online/hold", serviceId: deposit.id, ...free(deposit.id),
      guest: { name: "Fictional Guest", phone: "0700009911", at: { date: today, time: 8 * 60 } },
      notice: { title: "Demo request", body: "Demo appointment" },
    }),
    (s) => ({ type: "online/pay", id: s.checkoutHolds.at(-1)!.id, method: "card" }),
    () => ({ type: "booking-message/send", bookingId: booking.id, kind: "confirmation", channel: "sms", at: { date: today, time: 0 } }),
    () => ({ type: "customer/note", id: second.id, note: "Fictional note" }),
    () => ({ type: "customer/delete", id: second.id }),
    () => ({ type: "booking/cancel", id: "no-such-booking" }),
  ];
  const at = Date.now();
  const ledger = channelLedger(createOutbox(Infinity), DEMO_CHANNEL_CURRENCY);
  let staged = 0;
  for (const step of steps) {
    const action = step(state);
    const stage = ledger.stage();
    const result: unknown = withSlotClock(at, () => withDemoChannels(stage, () => prepareAction(state, action, defaultMeta(action, at), stage)));
    expect(isThenable(result), action.type).toBe(false);
    expect(typeof (result as DemoState).version, action.type).toBe("number");
    state = result as DemoState;
    staged += stage.outbox.list().length;
  }
  // Payments and messages were staged while the call ran, not after it returned.
  expect(staged).toBeGreaterThan(0);
});
