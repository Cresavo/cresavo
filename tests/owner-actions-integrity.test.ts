import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { payAtSalon } from "./helpers/pay-at-salon";
import { freeStarts } from "@/concept/data/slots";
import { readBoundedJson } from "@/lib/owner-http";
import { actionTooLarge } from "@/lib/owner-actions/parse";
import { MAX_ACTION_BYTES } from "@/lib/owner-actions/types";
import { sliceWhole } from "@/lib/whole-slice";
import { selectedCopy } from "@/concept/campaigns/draft";
import { cleanSignOff } from "@/concept/campaigns/channels";
import { ownerAction } from "@/lib/owner-store";

const today = "2026-11-16";
const base = payAtSalon(createDemoState(today));
const service = base.services[0];
const customer = base.customers[0];
const at = { date: today, time: 600 };

const post = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/owner/salon/actions", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

describe("owner action reducer integrity", () => {
  it("refuses a caller's booking id that is taken, and allocates around a taken one", () => {
    const [start] = freeStarts(base, service.staffIds[0], "2026-12-07", { serviceId: service.id, duration: service.duration });
    const taken = { ...base, bookings: [{ ...base.bookings[0], id: `b-${base.seq}` }, ...base.bookings] };
    const action = { type: "booking/create", customerId: customer.id, serviceId: service.id, staffId: service.staffIds[0], date: "2026-12-07", start, source: "phone" } as const;
    expect(reduce(taken, { ...action, id: `b-${base.seq}` })).toBe(taken);
    const allocated = reduce(taken, action);
    expect(allocated.bookings).toHaveLength(taken.bookings.length + 1);
    expect(allocated.bookings.at(-1)?.id).not.toBe(`b-${base.seq}`);
    expect(reduce(base, action).bookings).toHaveLength(base.bookings.length + 1);
  });

  it("refuses resource ids the salon does not have, and still clears the list when it is empty", () => {
    const withRoom = reduce(base, { type: "resource/add", name: "Room one", kind: "room" });
    const room = withRoom.resources.at(-1)!;
    expect(reduce(withRoom, { type: "service/resources", id: service.id, resourceIds: ["stock-1"] })).toBe(withRoom);
    expect(reduce(withRoom, { type: "service/resources", id: service.id, resourceIds: [room.id, "stock-1"] })).toBe(withRoom);
    const assigned = reduce(withRoom, { type: "service/resources", id: service.id, resourceIds: [room.id] });
    expect(assigned.services.find((s) => s.id === service.id)?.resourceIds).toEqual([room.id]);
    expect(reduce(assigned, { type: "service/resources", id: service.id, resourceIds: [] }).services.find((s) => s.id === service.id)?.resourceIds).toEqual([]);
  });

  it("moves a booking to another person only when the treatment is theirs", () => {
    const booking = base.bookings.find((b) => b.status === "booked" && b.date > today)!;
    const theService = base.services.find((s) => s.id === booking.serviceId)!;
    const other = base.staff.find((s) => s.id !== booking.staffId && !theService.staffIds.includes(s.id));
    if (!other) throw new Error("the fixture needs someone who does not do this treatment");
    const date = "2026-12-14";
    const [start] = freeStarts(base, other.id, date, booking);
    expect(reduce(base, { type: "booking/move", id: booking.id, date, start, staffId: other.id })).toBe(base);
    const allowed = { ...base, services: base.services.map((s) => (s.id === theService.id ? { ...s, staffIds: [...s.staffIds, other.id] } : s)) };
    expect(reduce(allowed, { type: "booking/move", id: booking.id, date, start, staffId: other.id }).bookings.find((b) => b.id === booking.id)?.staffId).toBe(other.id);
  });

  it("files a journal entry only for a real customer and staff member, and a booking of that customer", () => {
    const entry = { customerId: customer.id, date: today, staffId: base.staff[0].id, treatment: "Fictional", observations: "Fictional", advice: "Rest" };
    expect(reduce(base, { type: "journal/add", entry }).journals).toHaveLength(base.journals.length + 1);
    expect(reduce(base, { type: "journal/add", entry: { ...entry, customerId: base.stock[0].id } })).toBe(base);
    expect(reduce(base, { type: "journal/add", entry: { ...entry, staffId: "staff-999" } })).toBe(base);
    const own = base.bookings.find((b) => b.customerId === customer.id)!;
    const foreign = base.bookings.find((b) => b.customerId !== customer.id)!;
    expect(reduce(base, { type: "journal/add", entry: { ...entry, bookingId: own.id } }).journals).toHaveLength(base.journals.length + 1);
    expect(reduce(base, { type: "journal/add", entry: { ...entry, bookingId: foreign.id } })).toBe(base);
    expect(reduce(base, { type: "journal/add", entry: { ...entry, bookingId: "b-missing" } })).toBe(base);
  });

  it("orders only stock the salon carries, and records nothing as received", () => {
    const item = base.stock[0];
    const email = { title: "Order", body: "Please send." };
    const line = { stockId: item.id, quantity: 3, unitCost: 10 };
    const placed = reduce(base, { type: "stock/order", orders: [{ supplier: item.supplier, lines: [{ ...line, received: 3 }], email }], at });
    expect(placed.orders[0].lines).toEqual([line]);
    expect(reduce(base, { type: "stock/order", orders: [{ supplier: "Nobody", lines: [{ ...line, stockId: "customer-1" }], email }], at })).toBe(base);
  });

  it("receives against an order only what the order holds", () => {
    const [first, second] = base.stock;
    const placed = reduce(base, { type: "stock/order", orders: [{ supplier: first.supplier, lines: [{ stockId: first.id, quantity: 2, unitCost: 5 }], email: { title: "Order", body: "Send." } }], at });
    const order = placed.orders[0];
    expect(reduce(placed, { type: "stock/receive", orderId: order.id, deliveries: [{ stockId: second.id, quantity: 1 }], date: today })).toBe(placed);
    expect(reduce(placed, { type: "stock/receive", orderId: order.id, deliveries: [{ stockId: first.id, quantity: 2 }, { stockId: second.id, quantity: 1 }], date: today })).toBe(placed);
    expect(reduce(placed, { type: "stock/receive", orderId: order.id, deliveries: [{ stockId: first.id, quantity: 2 }], date: today }).orders[0].status).toBe("received");
  });

  it("applies a policy only with deposits and exemptions the price list has", () => {
    const policy = base.cancellationPolicy;
    expect(reduce(base, { type: "salon/policy", policy: { ...policy, deposits: { [service.id]: 5000 } } }).cancellationPolicy.deposits).toEqual({ [service.id]: 5000 });
    expect(reduce(base, { type: "salon/policy", policy: { ...policy, deposits: { "s-later": 5000 } } })).toBe(base);
    expect(reduce(base, { type: "salon/policy", policy: { ...policy, exemptServices: ["s-later"] } })).toBe(base);
  });

  it("stamps a help request with the store clock", () => {
    const ticket = { createdAt: 8.64e15, question: "How?", path: "/studio", requestId: "5b0f6a3e-9f64-4c0e-8f1d-2f0d3b8f6a11", screen: [], activity: [] };
    const now = Date.UTC(2026, 10, 16, 9, 0);
    expect(reduce(base, { type: "ticket/create", ticket }, now).tickets[0].createdAt).toBe(now);
  });
});

describe("owner request limits", () => {
  it("reads a body within the limit and refuses one over it while streaming", async () => {
    expect(await readBoundedJson(post('{"a":1}'), 100)).toEqual({ a: 1 });
    expect(await readBoundedJson(post(`{"a":"${"x".repeat(200)}"}`), 100)).toBe("too_large");
    expect(await readBoundedJson(post("{" + " ".repeat(200) + "}", { "content-length": "5" }), 100)).toBe("too_large");
    expect(await readBoundedJson(post("not json"), 100)).toBeNull();
  });

  it("answers a deeply nested action with a refusal, not an error", () => {
    let nested: unknown = { leaf: 1 };
    for (let level = 0; level < 20_000; level++) nested = { inner: nested };
    expect(ownerAction({ type: "inbox/read", id: "i-1", extra: nested })).toBeNull();
    expect(MAX_ACTION_BYTES).toBe(64 * 1024);
  });
});

describe("owner action id allocation", () => {
  const taken = (id: string) => ({ ...base, customers: [...base.customers, { ...base.customers[0], id }] });
  const phoneBooking = (start: number) => ({
    type: "booking/create", newCustomer: { name: "Sam Example", phone: "070-123 45 67", since: today },
    serviceId: service.id, staffId: service.staffIds[0], date: "2026-12-07", start, source: "phone",
  }) as const;
  const startFor = (state: typeof base) => freeStarts(state, service.staffIds[0], "2026-12-07", { serviceId: service.id, duration: service.duration })[0];

  it("gives a phone booking's new customer an id nothing holds", () => {
    const state = taken(`k-${base.seq}`);
    const next = reduce(state, phoneBooking(startFor(state)));
    const ids = next.customers.map((c) => c.id);
    expect(next.customers).toHaveLength(state.customers.length + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("does not reuse the id of a customer in the trash", () => {
    const state = reduce(taken(`k-${base.seq}`), { type: "customer/delete", id: `k-${base.seq}` });
    const next = reduce(state, phoneBooking(startFor(state)));
    expect(next.customers.some((c) => c.id === `k-${base.seq}`)).toBe(false);
  });

  it("gives imported customers free ids", () => {
    const state = taken(`k-${base.seq}`);
    const person: Omit<(typeof state.customers)[number], "id"> = { ...state.customers[0], phone: "070-555 01 02", email: "one@mail.example" };
    delete (person as { id?: string }).id;
    const next = reduce(state, { type: "customers/import", customers: [person, { ...person, phone: "070-555 01 03", email: "two@mail.example" }] });
    const ids = next.customers.map((c) => c.id);
    expect(next.customers).toHaveLength(state.customers.length + 2);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("confirms an online booking under its own id when the next one is taken", () => {
    const state = { ...base, bookings: [{ ...base.bookings[0], id: `b-${base.seq}` }, ...base.bookings] };
    const date = "2026-12-07";
    const start = freeStarts(state, service.staffIds[0], date, { serviceId: service.id, duration: service.duration })[0];
    const next = reduce(state, {
      type: "online/book", guest: { name: "Lena Example", phone: "0701234567", at: { date: "2026-11-16", time: 0 } },
      notice: { title: "New booking", body: "Online" }, serviceId: service.id, staffId: service.staffIds[0], date, start,
    });
    const created = next.bookings.filter((b) => !state.bookings.some((old) => old.id === b.id));
    expect(created).toHaveLength(1);
    expect(next.bookings.map((b) => b.id)).toHaveLength(new Set(next.bookings.map((b) => b.id)).size);
    expect(next.inbox[0].bookingId).toBe(created[0].id);
  });

  it("refuses to restore a customer or booking whose id was taken meanwhile", () => {
    const deleted = reduce(base, { type: "customer/delete", id: customer.id });
    const entry = deleted.trash[0];
    expect(reduce(deleted, { type: "trash/restore", id: entry.id }).customers.some((c) => c.id === customer.id)).toBe(true);
    const clash = { ...deleted, customers: [...deleted.customers, { ...customer }] };
    expect(reduce(clash, { type: "trash/restore", id: entry.id })).toBe(clash);
  });
});

describe("owner stock and policy edge cases", () => {
  const email = { title: "Order", body: "Send." };
  const [first, second] = base.stock;

  it("refuses a receipt with an unknown line before changing anything", () => {
    const placed = reduce(base, { type: "stock/order", orders: [{ supplier: first.supplier, lines: [{ stockId: first.id, quantity: 2, unitCost: 5 }], email }], at: { date: today, time: 0 } });
    const orderId = placed.orders[0].id;
    expect(reduce(placed, { type: "stock/receive", orderId, deliveries: [{ stockId: first.id, quantity: 2 }, { stockId: "nothing", quantity: 1 }], date: today })).toBe(placed);
    expect(reduce(placed, { type: "stock/receive", deliveries: [{ stockId: first.id, quantity: 2 }, { stockId: "nothing", quantity: 1 }], date: today })).toBe(placed);
  });

  it("refuses two lines for one item when an order is placed", () => {
    const line = { stockId: first.id, quantity: 2, unitCost: 5 };
    expect(reduce(base, { type: "stock/order", orders: [{ supplier: first.supplier, lines: [line, line], email }], at: { date: today, time: 0 } })).toBe(base);
  });

  it("records what arrived once across an old order's duplicate lines", () => {
    const line = { stockId: second.id, quantity: 2, unitCost: 5 };
    const old = { ...base, orders: [{ id: "o-old", supplier: second.supplier, date: today, status: "open" as const, lines: [line, line] }] };
    const next = reduce(old, { type: "stock/receive", orderId: "o-old", deliveries: [{ stockId: second.id, quantity: 3 }], date: today });
    expect(next.orders[0].lines.map((l) => l.received)).toEqual([2, 1]);
    expect(next.stock.find((s) => s.id === second.id)?.inStock).toBe(second.inStock + 3);
  });

  it("lets a stale policy entry stay or go, but not grow, and counts only own keys", () => {
    const stale = { ...base, cancellationPolicy: { ...base.cancellationPolicy, deposits: { "s-gone": 100 }, exemptServices: ["s-gone"] } };
    const policy = stale.cancellationPolicy;
    expect(reduce(stale, { type: "salon/policy", policy: { ...policy, freeHours: 12 } }).cancellationPolicy.freeHours).toBe(12);
    expect(reduce(stale, { type: "salon/policy", policy: { ...policy, deposits: {}, exemptServices: [] } }).cancellationPolicy.deposits).toEqual({});
    expect(reduce(stale, { type: "salon/policy", policy: { ...policy, deposits: { "s-gone": 300 } } })).toBe(stale);
    expect(reduce(base, { type: "salon/policy", policy: { ...base.cancellationPolicy, deposits: JSON.parse('{"constructor":100}') } })).toBe(base);
  });
});

describe("owner text and request edge cases", () => {
  it("cuts text at a whole character", () => {
    expect(sliceWhole("ab😀", 3)).toBe("ab");
    expect(sliceWhole("ab😀", 4)).toBe("ab😀");
    expect(cleanSignOff(`${"x".repeat(79)}😀`)).toBe("x".repeat(79));
  });

  it("submits only the texts of the selected channels", () => {
    expect(selectedCopy({ channels: ["instagram"], copy: { instagram: "Post", sms: "x".repeat(161) } })).toEqual({ instagram: "Post" });
  });

  it("tells an action over the cap from an invalid one, and reads a BOM-prefixed body", async () => {
    expect(actionTooLarge({ type: "customer/note", id: "k-7", note: "x".repeat(MAX_ACTION_BYTES) })).toBe(true);
    expect(actionTooLarge({ type: "customer/note", id: "k-7", note: "short" })).toBe(false);
    expect(await readBoundedJson(post("\uFEFF{\"a\":1}"), 100)).toEqual({ a: 1 });
  });
});

describe("owner id and receipt regressions", () => {
  it("refuses an assistant booking under the id of a customer in the trash", () => {
    const deleted = reduce(base, { type: "customer/delete", id: customer.id });
    const start = freeStarts(deleted, service.staffIds[0], "2026-12-07", { serviceId: service.id, duration: service.duration })[0];
    const action = {
      type: "booking/create", fictionalCustomer: { id: customer.id, name: "Sam Example", since: today },
      serviceId: service.id, staffId: service.staffIds[0], date: "2026-12-07", start, source: "assistant",
    } as const;
    expect(reduce(deleted, action)).toBe(deleted);
    const restored = reduce(deleted, { type: "trash/restore", id: deleted.trash[0].id });
    expect(restored.customers.filter((c) => c.id === customer.id)).toHaveLength(1);
  });

  it("receives an old order whose item is no longer stocked, and still refuses unrelated items", () => {
    const [first, second] = base.stock;
    const line = { stockId: "retired-item", quantity: 4, unitCost: 5 };
    const old = {
      ...base,
      orders: [{ id: "o-old", supplier: first.supplier, date: today, status: "open" as const, lines: [{ stockId: first.id, quantity: 2, unitCost: 5 }, line] }],
    };
    const next = reduce(old, { type: "stock/receive", orderId: "o-old", deliveries: [{ stockId: first.id, quantity: 2 }, { stockId: "retired-item", quantity: 4 }, { stockId: second.id, quantity: 0 }], date: today });
    expect(next.orders[0].status).toBe("received");
    expect(next.stock.find((s) => s.id === first.id)?.inStock).toBe(first.inStock + 2);
    expect(reduce(old, { type: "stock/receive", orderId: "o-old", deliveries: [{ stockId: first.id, quantity: 2 }, { stockId: second.id, quantity: 1 }], date: today })).toBe(old);
    expect(reduce(old, { type: "stock/receive", orderId: "o-old", deliveries: [{ stockId: "retired-item", quantity: 4 }], date: today })).toBe(old);
  });
});

