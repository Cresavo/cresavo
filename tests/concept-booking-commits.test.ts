import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { addDays, toKey, weekday } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { payAtSalon } from "./helpers/pay-at-salon";
import { freeStarts, needOf } from "@/concept/data/slots";
import type { DemoState, StaffId } from "@/concept/data/types";

// The booking, payment and undo flows on the commit-result API
// (docs/design/BROWSER_STORE_IDB.md, PR 4), driven without a browser over the
// real store: each reports a refusal with its existing message, a second tap
// while a save is running does nothing, and a replaced salon is never changed.
// Fictional data only.

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], index: 0 }));
vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();
  return {
    ...react,
    useState: <S,>(initial?: S | (() => S)) => {
      const slot = hooks.index++;
      if (slot === hooks.slots.length) hooks.slots.push(typeof initial === "function" ? (initial as () => S)() : initial);
      return [hooks.slots[slot] as S, (next: S | ((value: S) => S)) => {
        hooks.slots[slot] = typeof next === "function" ? (next as (value: S) => S)(hooks.slots[slot] as S) : next;
      }];
    },
    useContext: () => null,
    useEffect: () => undefined,
    useRef: <T,>(value: T) => ({ current: value }),
    useMemo: <T,>(make: () => T) => make(),
    useSyncExternalStore: <T,>(_subscribe: unknown, read: () => T) => read(),
  };
});
const { showToast, showActionFailure } = vi.hoisted(() => ({ showToast: vi.fn(), showActionFailure: vi.fn() }));
vi.mock("@/concept/ui/toast", () => ({ showToast, showActionFailure }));
const studio = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/concept/studio/use-studio", () => ({ useStudio: () => studio.current }));
vi.mock("@/concept/use-now", async (importOriginal) => {
  const { salonClock } = await import("@/concept/tools/clock");
  return { ...(await importOriginal<object>()), useSalonNow: () => salonClock(new Date()) };
});

const today = toKey(new Date());
const KEY = "salong-eko-demo";

function elements(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(tree).flatMap((node) =>
    isValidElement<Record<string, unknown>>(node)
      ? [node, ...elements(node.props.children as ReactNode), ...elements(node.props.footer as ReactNode)]
      : [],
  );
}

/** Calls a component function with stable state slots, like repeated renders. */
function rendered(render: () => ReactNode) {
  hooks.slots = [];
  return () => {
    hooks.index = 0;
    return render();
  };
}

const button = (tree: ReactNode, label: string) => {
  const found = elements(tree).find((node) => typeof node.props.onClick === "function" && Children.toArray(node.props.children as ReactNode).join("") === label);
  if (!found) throw new Error(`No button "${label}"`);
  return found.props.onClick as () => unknown;
};

const reads = { hook: undefined as (() => void) | undefined };

async function open(seed: DemoState) {
  vi.resetModules();
  reads.hook = undefined;
  const items = new Map([[KEY, JSON.stringify(seed)]]);
  const memory = new Map<string, string>();
  vi.stubGlobal("window", Object.assign(new EventTarget(), {
    localStorage: { getItem: (k: string) => { if (k === KEY) reads.hook?.(); return items.get(k) ?? null; }, setItem: (k: string, v: string) => { items.set(k, v); }, removeItem: (k: string) => { items.delete(k); } },
    sessionStorage: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v); }, removeItem: (k: string) => { memory.delete(k); } },
    setTimeout, clearTimeout,
  }));
  const store = await import("@/concept/store");
  const { t } = await import("@/concept/i18n");
  const saved = () => JSON.parse(items.get(KEY)!) as DemoState;
  /** Another tab starts a new sample business; this tab has not read it. */
  const replace = () => items.set(KEY, JSON.stringify({ ...createDemoState(today), epoch: "another-tab" }));
  const state = store.currentState()!;
  studio.current = { state, today, minutes: 0, target: store.targetOf(state) };
  return { store, t, saved, replace, state };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A free start on a later day for the first bookable treatment. */
function freeSlot(state: DemoState, serviceIndex = 1) {
  const service = state.services.filter((s) => !s.hidden)[serviceIndex];
  for (let i = 1; i <= 21; i++) {
    const date = addDays(today, i);
    for (const staffId of service.staffIds) {
      const start = freeStarts(state, staffId, date, needOf(service))[0];
      if (start !== undefined) return { service, slot: { staffId, date, start } };
    }
  }
  throw new Error("no free slot");
}

const guest = { name: "Alva Berg", phone: "0700000001" };
const contact = { guest, setGuest: () => undefined, remember: false, chooseRemember: () => undefined, saveContact: () => undefined };
const upcoming = (state: DemoState) => state.bookings.find((b) => b.status === "booked" && b.date > today)!;

beforeEach(() => {
  showToast.mockClear();
  showActionFailure.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function details(state: DemoState, slot: { staffId: StaffId; date: string; start: number }, serviceId: string) {
  const { DetailsStep } = await import("@/concept/booking/details-step");
  const taken: unknown[] = [];
  const booked: unknown[] = [];
  const render = rendered(() => DetailsStep({ state, now: { today, minutes: 0, instant: Date.now() } as never, serviceId, slot, contact: contact as never, suggested: false, onTaken: (f) => taken.push(f), onBooked: (b) => booked.push(b), onHeld: (h) => booked.push(h) }));
  const submit = () => (elements(render()).find((node) => node.type === "form")!.props.onSubmit as (e: { preventDefault(): void }) => void)({ preventDefault() {} });
  return { taken, booked, submit };
}

it("books once from the booking page, even when Confirm is pressed twice", async () => {
  const { state, saved } = await open(payAtSalon(createDemoState(today)));
  const { service, slot } = freeSlot(state);
  const page = await details(state, slot, service.id);
  page.submit();
  page.submit();
  await vi.waitFor(() => expect(page.booked).toHaveLength(1));
  await settle();
  expect(saved().bookings.filter((b) => b.date === slot.date && b.start === slot.start && b.staffId === slot.staffId)).toHaveLength(1);
  expect(page.taken).toEqual([]);
});

it("enforces the booking lead time when the booking is saved, not when Confirm is pressed", async () => {
  // The demo salon is closed at weekends, so the test runs on the next weekday.
  const day = [0, 1, 2, 3].map((i) => addDays(today, i)).find((d) => weekday(d) >= 1 && weekday(d) <= 5)!;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${day}T09:00:00`));
  const { state, saved } = await open(createDemoState(day));
  const service = state.services.filter((s) => !s.hidden)[1];
  const staffId = service.staffIds[0];
  // Free and outside the lead time when the customer presses Confirm…
  const start = freeStarts(state, staffId, day, needOf(service)).find((minute) => minute >= 10 * 60 + 30 && minute < 16 * 60);
  if (start === undefined) throw new Error("no free start today between 10:30 and 16:00");
  const page = await details(state, { staffId, date: day, start }, service.id);
  // …but the save happens 30 minutes before it (a slow tab, a queue behind another save).
  const late = new Date(`${day}T${String(Math.floor((start - 30) / 60)).padStart(2, "0")}:${String((start - 30) % 60).padStart(2, "0")}:00`);
  let pressed = false;
  reads.hook = () => { if (pressed) vi.setSystemTime(late); };
  pressed = true;
  page.submit();
  await vi.waitFor(() => expect(page.taken).toHaveLength(1));
  expect(page.taken[0]).toMatchObject({ reason: "booking.slotTaken" });
  expect(page.booked).toEqual([]);
  expect(saved().bookings.filter((b) => b.date === day && b.start === start && b.staffId === staffId && b.status === "booked")).toEqual(
    state.bookings.filter((b) => b.date === day && b.start === start && b.staffId === staffId && b.status === "booked"),
  );
});

it("sends the customer back to choose when the salon was replaced", async () => {
  const { state, saved, replace } = await open(createDemoState(today));
  const { service, slot } = freeSlot(state);
  const page = await details(state, slot, service.id);
  replace();
  const before = JSON.stringify(saved());
  page.submit();
  await vi.waitFor(() => expect(page.taken).toHaveLength(1));
  expect(page.booked).toEqual([]);
  expect(JSON.stringify(saved())).toBe(before);
});

it("pays a deposit once, and reports a refused payment with its message", async () => {
  const base = createDemoState(today);
  const { service, slot } = freeSlot(base, 0);
  const seed = { ...base, cancellationPolicy: { ...base.cancellationPolicy, deposits: { [service.id]: 20_000 } } };
  const { state, saved, store } = await open(seed);
  const { DepositCheckout } = await import("@/concept/booking/deposit-checkout");
  const page = await details(state, slot, service.id);
  page.submit();
  await vi.waitFor(() => expect(page.booked).toHaveLength(1));
  const hold = page.booked[0] as DemoState["checkoutHolds"][number];
  const paid: unknown[] = [];
  const target = store.targetOf(store.currentState())!;
  const render = rendered(() => DepositCheckout({ target, hold, serviceName: service.name, now: { today, minutes: 0 } as never, phone: "", packagesEnabled: false, onPaid: (b) => paid.push(b), onRelease: () => undefined }));
  const { t } = await import("@/concept/i18n");
  const pay = button(render(), t("protection.pay", { amount: (await import("@/concept/booking/policy-summary")).formatMinor(hold.terms.depositMinor, hold.terms.currency) }));
  pay();
  pay();
  await vi.waitFor(() => expect(paid).toHaveLength(1));
  await settle();
  expect(saved().bookings.filter((b) => b.protection?.deposit).length).toBe(1);
  // Paying again for the hold that is gone is refused with the payment message.
  rendered(() => DepositCheckout({ target, hold, serviceName: service.name, now: { today, minutes: 0 } as never, phone: "", packagesEnabled: false, onPaid: (b) => paid.push(b), onRelease: () => undefined }))();
  await (button(render(), t("protection.pay", { amount: (await import("@/concept/booking/policy-summary")).formatMinor(hold.terms.depositMinor, hold.terms.currency) }))() as Promise<unknown>);
  expect(showActionFailure).toHaveBeenLastCalledWith("protection.payFailed", undefined, "booking");
  expect(paid).toHaveLength(1);
});

it("lets a customer cancel once, and never in a salon that replaced theirs", async () => {
  const { state, saved, replace, t } = await open(createDemoState(today));
  const { BookingActions } = await import("@/concept/booking/booking-actions");
  // Two days ahead: outside the 24-hour window, so the customer may still cancel online.
  const booking = state.bookings.find((b) => b.status === "booked" && b.date >= addDays(today, 2))!;
  const render = rendered(() => BookingActions({ state, now: { today, minutes: 0, instant: Date.now() } as never, booking }));
  button(render(), t("booking.cancel"))();
  replace();
  const before = JSON.stringify(saved());
  await (button(render(), t("booking.cancel.confirm"))() as Promise<unknown>);
  expect(showActionFailure).toHaveBeenLastCalledWith("booking.visitChanged", expect.any(String), "booking");
  expect(JSON.stringify(saved())).toBe(before);
});

it("cancels from the studio once, with Undo bound to the salon, and refuses in a replaced salon", async () => {
  const { state, saved, replace, t } = await open(createDemoState(today));
  const { BookingSheet } = await import("@/concept/studio/booking/booking-sheet");
  const booking = upcoming(state);
  let closed = 0;
  const render = rendered(() => BookingSheet({ bookingId: booking.id, onClose: () => { closed += 1; }, initialMode: "cancel" }));
  const confirm = button(render(), t("cancel.confirm"));
  confirm();
  confirm();
  await vi.waitFor(() => expect(closed).toBe(1));
  await settle();
  expect(saved().bookings.find((b) => b.id === booking.id)?.status).toBe("cancelled");
  expect(saved().log.filter((entry) => entry.type === "booking/cancel")).toHaveLength(1);
  // The second tap did nothing: no refusal is shown.
  const { ActionFailure } = await import("@/concept/ui/action-failure");
  expect(elements(render()).some((node) => node.type === ActionFailure)).toBe(false);
  const [, undo] = showToast.mock.calls.at(-1)!;
  // Another tab replaces the salon before Undo is pressed: nothing in the new salon changes.
  replace();
  const before = JSON.stringify(saved());
  undo.run();
  await vi.waitFor(() => expect(showToast).toHaveBeenLastCalledWith(t("log.cannotUndo")));
  expect(JSON.stringify(saved())).toBe(before);
});

it("books from the studio once, even when Book is pressed twice", async () => {
  const { state, saved, t } = await open(createDemoState(today));
  const { NewBookingSheet } = await import("@/concept/studio/booking/new-booking-sheet");
  const { service, slot } = freeSlot(state);
  const customer = state.customers[0];
  let closed = 0;
  const render = rendered(() => NewBookingSheet({ preset: { customerId: customer.id, serviceId: service.id, ...slot }, onClose: () => { closed += 1; } }));
  const book = elements(render()).find((node) => typeof node.props.onClick === "function" && node.props.disabled === false && /Book|Boka/.test(Children.toArray(node.props.children as ReactNode).join("")))?.props.onClick as () => unknown;
  expect(book).toBeTypeOf("function");
  book();
  book();
  await vi.waitFor(() => expect(closed).toBe(1));
  await settle();
  expect(saved().bookings.filter((b) => b.date === slot.date && b.start === slot.start && b.staffId === slot.staffId && b.status === "booked")).toHaveLength(1);
  // The second tap did nothing: no "time taken" refusal is shown.
  expect(JSON.stringify(elements(render()).map((node) => node.props.failure ?? null))).not.toContain("newBooking.slotTaken");
  expect(t("newBooking.slotTaken")).toBeTruthy();
});

it("approves an assistant change once, and not after the salon was replaced", async () => {
  const { store, saved, replace } = await open(createDemoState(today));
  const thread = await import("@/concept/studio/assistant/thread-store");
  const actions = await import("@/concept/studio/assistant/reply-actions");
  const service = store.currentState()!.services[0];
  const ask = (id: string) => {
    const action = { type: "service/price" as const, id: service.id, price: service.price + 50 };
    thread.addMessages([
      { id: `q-${id}`, from: "owner", text: "raise the price", at: 1 },
      { id, from: "assistant", text: "New price", reply: { source: "rules", text: "New price", card: { kind: "change", title: "New price", rows: [], toast: "", action }, target: store.currentTarget()! }, at: 1 },
    ], { customerIds: [], date: today });
    return action;
  };
  const action = ask("r-1");
  const [first, second] = await Promise.all([actions.approveReply("r-1", action), actions.approveReply("r-1", action)]);
  expect([first, second].filter(Boolean)).toHaveLength(1);
  expect(saved().log.filter((entry) => entry.type === "service/price")).toHaveLength(1);
  const later = ask("r-2");
  replace();
  const before = JSON.stringify(saved());
  expect(await actions.approveReply("r-2", later)).toBe(false);
  expect(thread.replyOf("r-2")).toMatchObject({ status: "failed" });
  expect(JSON.stringify(saved())).toBe(before);
});

it("keeps the waiting-list form fixed while it saves and confirms the phone it saved", async () => {
  const { state, saved, t } = await open(createDemoState(today));
  const { WaitlistSheet } = await import("@/concept/booking/waitlist-sheet");
  const { GuestFields } = await import("@/concept/booking/guest-fields");
  const service = state.services.filter((s) => !s.hidden)[1];
  const render = rendered(() => WaitlistSheet({ state, now: { today, minutes: 0 } as never, request: { serviceId: service.id, date: addDays(today, 3) }, onClose: () => undefined }));
  const fields = () => elements(render()).find((node) => node.type === GuestFields)!.props as { onChange: (next: typeof guest) => void; disabled: boolean };
  fields().onChange(guest);
  const submit = button(render(), t("booking.waitlist.submit"));
  const saving = submit() as Promise<unknown>;
  expect(fields().disabled).toBe(true);
  // What the fields hold afterwards is not what was saved.
  fields().onChange({ ...guest, phone: "0700000099" });
  await saving;
  const text = JSON.stringify(elements(render()).map((node) => node.props.children ?? null));
  expect(text).toContain(guest.phone);
  expect(text).not.toContain("0700000099");
  expect(saved().customers.some((customer) => customer.phone === guest.phone)).toBe(true);
});
