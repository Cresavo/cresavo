import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { reduce } from "@/concept/actions";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import { readBoundedJson } from "@/lib/owner-http";
import { MAX_ACTION_BYTES } from "@/lib/owner-actions/types";
import { ownerAction } from "@/lib/owner-store";

const today = "2026-11-16";
const base = createDemoState(today);
const service = base.services[0];
const customer = base.customers[0];
const at = { date: today, time: 600 };

const post = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/owner/salon/actions", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });

describe("owner action reducer integrity", () => {
  it("refuses a booking id that is already taken, also when the reducer allocates it", () => {
    const [start] = freeStarts(base, service.staffIds[0], "2026-12-07", { serviceId: service.id, duration: service.duration });
    const taken = { ...base, bookings: [{ ...base.bookings[0], id: `b-${base.seq}` }, ...base.bookings] };
    const action = { type: "booking/create", customerId: customer.id, serviceId: service.id, staffId: service.staffIds[0], date: "2026-12-07", start, source: "phone" } as const;
    expect(reduce(taken, action)).toBe(taken);
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
