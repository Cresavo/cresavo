import { afterEach, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { addDays, toKey } from "@/concept/data/dates";
import { freeStarts } from "@/concept/data/slots";

const { changed, showToast, showActionFailure, unsubscribe, note } = vi.hoisted(() => ({
  changed: vi.fn(), showToast: vi.fn(), showActionFailure: vi.fn(), unsubscribe: { current: () => {} }, note: { draft: "" },
}));
vi.mock("@/concept/ui/toast", () => ({ showToast, showActionFailure }));
vi.mock("react", () => ({
  useState: () => [note.draft, vi.fn()],
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, read: () => unknown) => {
    unsubscribe.current = subscribe(changed);
    return read();
  },
}));

afterEach(() => {
  unsubscribe.current();
  vi.unstubAllGlobals();
});

it("the cancellation toast reports a conflict after another tab takes the slot", async () => {
  const today = toKey(new Date());
  const base = createDemoState(today);
  const booking = base.bookings.find((b) => b.status === "booked" && b.date > today)!;
  const customer = base.customers.find((c) => c.id !== booking.customerId)!;
  let raw = JSON.stringify(base);
  const localStorage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  showToast.mockClear();
  const { applyAction } = await import("@/concept/log/capture");
  const { dispatchWithUndoToast } = await import("@/concept/studio/log/undo-toast");

  expect(dispatchWithUndoToast({ type: "booking/cancel", id: booking.id }, "Booking cancelled")).toBe(true);
  const action = showToast.mock.calls[0][1];
  expect(action.label).toBe("Undo");
  const taken = applyAction(JSON.parse(raw), {
    type: "booking/create", customerId: customer.id, serviceId: booking.serviceId,
    staffId: booking.staffId, date: booking.date, start: booking.start, source: "phone",
  }, { actor: "owner", source: "button", at: Date.now() });
  expect(taken.bookings.at(-1)?.customerId).toBe(customer.id);
  const rebooked = JSON.stringify(taken);
  raw = rebooked;

  action.run();

  expect(showActionFailure).toHaveBeenLastCalledWith("Can't undo: that time is no longer available.");
  expect(raw).toBe(rebooked);
});

it("retains reminder settings when the sample bookings regenerate for a new day", async () => {
  const today = toKey(new Date());
  const saved = createDemoState(addDays(today, -1));
  saved.reminderSettings = { channel: "email", smsPriceOre: 80 };
  const localStorage = { getItem: () => JSON.stringify(saved) };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  const { useDemo } = await import("@/concept/store");
  const regenerated = useDemo();
  expect(regenerated?.generatedFor).toBe(today);
  expect(regenerated?.reminderSettings).toEqual(saved.reminderSettings);
});

it("reloads another tab's booking and rejects a stale attempt for the same slot", async () => {
  const today = toKey(new Date());
  const key = "salong-eko-demo";
  const base = { ...createDemoState(today), bookings: [] };
  let raw = JSON.stringify(base);
  const localStorage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  const tab = Object.assign(new EventTarget(), { localStorage });
  vi.stubGlobal("window", tab);
  const { useDemo, currentState, dispatch, dispatchWithLog } = await import("@/concept/store");
  useDemo();
  changed.mockClear();

  const service = base.services.find((item) => item.id === "medical-foot-care")!;
  const staffId = service.staffIds[0];
  const day = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1))
    .find((date) => freeStarts(base, staffId, date, { serviceId: service.id, duration: service.duration }).length)!;
  const [start] = freeStarts(base, staffId, day, { serviceId: service.id, duration: service.duration });
  const booking = {
    id: "booking-from-tab-one", customerId: base.customers[0].id, serviceId: service.id,
    staffId, date: day, start, duration: service.duration, price: service.price, status: "booked" as const, source: "online" as const,
  };
  raw = JSON.stringify({ ...base, bookings: [...base.bookings, booking] });
  tab.dispatchEvent(Object.assign(new Event("storage"), { key, storageArea: localStorage }));
  expect(changed).toHaveBeenCalledOnce();
  expect(currentState()?.bookings.at(-1)?.id).toBe(booking.id);

  expect(dispatch({
    type: "online/book", serviceId: booking.serviceId, staffId: booking.staffId, date: booking.date, start,
    guest: { name: "Second Tab", phone: "070-000 99 32", at: { date: today, time: 0 } }, notice: { title: "Test", body: "" },
  })).toBe(false);
  expect(JSON.parse(raw).bookings.at(-1).id).toBe(booking.id);

  // A further write can arrive before the storage event is delivered.
  raw = JSON.stringify({ ...JSON.parse(raw), dismissedCards: ["another-tab"] });
  const id = dispatchWithLog({ type: "customer/note", id: base.customers[0].id, note: "Local note" });
  expect(typeof id).toBe("string");
  expect(currentState()?.dismissedCards).toContain("another-tab");
  if (typeof id !== "string") throw new Error("Expected a log entry");
  expect(dispatch({ type: "log/undo", id })).toBe(true);
  expect(currentState()?.bookings.at(-1)?.id).toBe(booking.id);
});

it("refuses a public booking when another tab takes the slot before the save", async () => {
  const today = toKey(new Date());
  const base = { ...createDemoState(today), bookings: [] };
  const service = base.services.find((item) => item.id === "medical-foot-care")!;
  const staffId = service.staffIds[0];
  const need = { serviceId: service.id, duration: service.duration };
  const date = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1))
    .find((day) => freeStarts(base, staffId, day, need).length)!;
  const [start] = freeStarts(base, staffId, date, need);
  const action = {
    type: "online/book" as const, serviceId: service.id, staffId, date, start,
    guest: { name: "First Tab", phone: "070-000 99 31", at: { date: today, time: 0 } },
    notice: { title: "Test", body: "" },
  };
  const { applyAction, defaultMeta } = await import("@/concept/log/capture");
  const booked = applyAction(base, action, defaultMeta(action, Date.now()));
  expect(booked.bookings).toHaveLength(1);
  const stale = JSON.stringify(base);
  const fresh = JSON.stringify(booked);
  let raw = stale;
  const localStorage = { getItem: vi.fn(() => raw), setItem: vi.fn() };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  const { useDemo, currentState, dispatch } = await import("@/concept/store");
  useDemo();
  expect(currentState()?.bookings).toHaveLength(0);

  // The other tab commits after our first read. Its storage event has not arrived.
  localStorage.getItem.mockImplementationOnce(() => {
    raw = fresh;
    return stale;
  });
  expect(dispatch({
    ...action, guest: { ...action.guest, name: "Second Tab", phone: "070-000 99 32" },
  })).toBe(false);
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(currentState()?.bookings).toEqual(booked.bookings);
});

it("refuses a missing snapshot with a current receipt until an explicit reset supersedes it", async () => {
  const day = toKey(new Date());
  const firstReceipt = { day, seq: 7 };
  let receipt = firstReceipt;
  let raw: string | null = null;
  const localStorage = { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, data: string) => { raw = data; }) };
  const cache = {
    match: async () => Response.json(receipt),
    put: async (_url: string, response: Response) => { receipt = await response.json(); },
  };
  vi.stubGlobal("window", Object.assign(new EventTarget(), {
    localStorage, location: { origin: "https://demo.example" }, caches: { open: async () => cache },
    setTimeout: (callback: () => void) => queueMicrotask(callback),
  }));
  const request = vi.fn(async (_name: string, run: () => unknown) => run());
  vi.stubGlobal("navigator", { locks: { request } });
  const { startBusiness, withBookingLock } = await import("@/concept/store");
  const confirm = vi.fn(() => true);

  expect(await withBookingLock(confirm)).toBe(false);
  expect(confirm).not.toHaveBeenCalled();
  expect(localStorage.setItem).not.toHaveBeenCalled();

  await startBusiness();
  expect(receipt).toEqual({ day, seq: firstReceipt.seq + 1 });
  expect(JSON.parse(raw!).seq).toBe(receipt.seq);
  expect(request).toHaveBeenCalledTimes(2);

  const resetSnapshot = raw;
  raw = JSON.stringify({ ...createDemoState(day), seq: firstReceipt.seq });
  expect(await withBookingLock(confirm)).toBe(false);
  expect(confirm).not.toHaveBeenCalled();
  raw = resetSnapshot;
  expect(await withBookingLock(confirm)).toBe(true);
  expect(confirm).toHaveBeenCalledOnce();
});

it("undoing the first customer-note toast leaves the second edit in place", async () => {
  const base = createDemoState(toKey(new Date()));
  const [first, second] = base.customers;
  let raw = JSON.stringify(base);
  const localStorage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
  showToast.mockClear();
  const { Notes } = await import("@/concept/studio/customers/notes");
  const { currentState } = await import("@/concept/store");
  const save = (customer: typeof first, draft: string) => {
    note.draft = draft;
    const notes = Notes({ customer });
    notes.props.children[1].props.children[1].props.onClick();
  };

  save(first, "First edited note");
  save(second, "Second edited note");
  expect(showToast).toHaveBeenCalledTimes(2);
  showToast.mock.calls[0][1].run();
  const customers = currentState()!.customers;
  expect(customers.find((customer) => customer.id === first.id)?.note).toBe(first.note);
  expect(customers.find((customer) => customer.id === second.id)?.note).toBe("Second edited note");
});
