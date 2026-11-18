import { afterEach, expect, it, vi } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { addDays, toKey } from "@/concept/data/dates";
import { freeStarts } from "@/concept/data/slots";

const { changed, unsubscribe } = vi.hoisted(() => ({ changed: vi.fn(), unsubscribe: { current: () => {} } }));
vi.mock("react", () => ({
  useSyncExternalStore: (subscribe: (notify: () => void) => () => void, read: () => unknown) => {
    unsubscribe.current = subscribe(changed);
    return read();
  },
}));

afterEach(() => {
  unsubscribe.current();
  vi.unstubAllGlobals();
});

it("reloads another tab's booking and rejects a stale attempt for the same slot", async () => {
  const today = toKey(new Date());
  const key = "salong-eko-demo";
  const base = { ...createDemoState(today), bookings: [] };
  let raw = JSON.stringify(base);
  const localStorage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  const tab = Object.assign(new EventTarget(), { localStorage });
  vi.stubGlobal("window", tab);
  const { useDemo, currentState, dispatch, undo } = await import("@/concept/store");
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
  const first = base.inbox[0];
  raw = JSON.stringify({ ...JSON.parse(raw), dismissedCards: ["another-tab"] });
  expect(dispatch({ type: "inbox/read", id: first.id })).toBe(true);
  expect(currentState()?.dismissedCards).toContain("another-tab");
  undo();
  expect(currentState()?.bookings.at(-1)?.id).toBe(booking.id);
});
