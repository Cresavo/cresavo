import { describe, expect, it } from "vitest";
import type { DemoAction } from "@/concept/actions";
import { addDays } from "@/concept/data/dates";
import { createDemoState } from "@/concept/data/generate";
import { freeStarts } from "@/concept/data/slots";
import { applyAction, defaultMeta, LOG_LIMIT } from "@/concept/log/capture";
import { filterLog, present } from "@/concept/log/filter";
import { canUndo, isUndoable, undoBlockReason, undoEntry } from "@/concept/log/undo";
import type { LogMeta } from "@/concept/log/types";

const today = "2026-11-16";
const base = createDemoState(today);
const meta: LogMeta = { actor: "owner", source: "button", at: Date.UTC(2026, 10, 16, 9, 30) };
const upcoming = base.bookings.find((b) => b.status === "booked" && b.date > today)!;

function moveAction(): DemoAction {
  let date = addDays(upcoming.date, 1);
  while (!freeStarts(base, upcoming.staffId, date, upcoming).length) date = addDays(date, 1);
  return { type: "booking/move", id: upcoming.id, date, start: freeStarts(base, upcoming.staffId, date, upcoming)[0] };
}

describe("activity log", () => {
  it("records who, what, before/after and source for a change", () => {
    const next = applyAction(base, moveAction(), { actor: "ai", source: "command", at: meta.at });
    expect(next.log).toHaveLength(1);
    const [entry] = next.log;
    expect(entry).toMatchObject({ actor: "ai", source: "command", type: "booking/move", at: meta.at });
    expect(entry.summary).toMatch(/^Moved .+'s /);
    expect(entry.before).not.toBe(entry.after);
    expect(entry.patch).toBeDefined();
  });

  it("logs nothing when the reducer changed nothing or the action is only a read", () => {
    const taken = base.bookings.find((b) => b.id !== upcoming.id && b.staffId === upcoming.staffId && b.status === "booked" && b.date === upcoming.date)!;
    const refused = applyAction(base, { type: "booking/move", id: upcoming.id, date: taken.date, start: taken.start }, meta);
    expect(refused).toBe(base);
    const unknown = applyAction(base, { type: "booking/cancel", id: "nope" }, meta);
    expect(unknown.log).toHaveLength(0);
    const unread = base.inbox.find((i) => !i.read)!;
    expect(applyAction(base, { type: "inbox/read", id: unread.id }, meta).log).toHaveLength(0);
    expect(applyAction(base, { type: "card/dismiss", id: "x" }, meta).log).toHaveLength(0);
  });

  it("picks who and where from the action unless the caller says", () => {
    expect(defaultMeta({ type: "service/price", id: "a", price: 1 }, 5)).toEqual({ actor: "owner", source: "button", at: 5 });
    expect(defaultMeta({ type: "online/waitlist" } as DemoAction, 5)).toMatchObject({ actor: "customer", source: "customer-page" });
    expect(defaultMeta({ type: "booking/create", source: "campaign" } as DemoAction, 5)).toMatchObject({ actor: "customer", source: "campaign" });
  });

  it("undoes a move and then refuses to undo it twice", () => {
    const moved = applyAction(base, moveAction(), meta);
    const entry = moved.log[0];
    expect(isUndoable(moved, entry)).toBe(true);
    const undone = applyAction(moved, { type: "log/undo", id: entry.id }, meta);
    expect(undone.bookings.find((b) => b.id === upcoming.id)).toEqual(upcoming);
    expect(undone.log.find((e) => e.id === entry.id)?.undone).toBe(true);
    expect(undone.log[0].summary).toMatch(/^Undid: /);
    expect(applyAction(undone, { type: "log/undo", id: entry.id }, meta)).toBe(undone);
  });

  it("an undo is a change of its own and can be undone again", () => {
    const moved = applyAction(base, moveAction(), meta);
    const undone = applyAction(moved, { type: "log/undo", id: moved.log[0].id }, meta);
    const redone = applyAction(undone, { type: "log/undo", id: undone.log[0].id }, meta);
    expect(redone.bookings.find((b) => b.id === upcoming.id)).toEqual(moved.bookings.find((b) => b.id === upcoming.id));
  });

  it.each([
    ["a cancellation", { type: "booking/cancel", id: upcoming.id }],
    ["a move", moveAction()],
    ["a customer deletion", { type: "customer/delete", id: upcoming.customerId }],
  ] as const)(
    "refuses to undo %s after another customer books the original time",
    (_label, action) => {
      const changed = applyAction(base, action, meta);
      const [entry] = changed.log;
      const customer = base.customers.find((c) => c.id !== upcoming.customerId)!;
      const rebooked = applyAction(changed, {
        type: "booking/create", customerId: customer.id, serviceId: upcoming.serviceId,
        staffId: upcoming.staffId, date: upcoming.date, start: upcoming.start, source: "phone",
      }, meta);
      expect(rebooked.bookings.at(-1)).toMatchObject({ customerId: customer.id, start: upcoming.start });
      expect(undoBlockReason(rebooked, entry)).toBe("time-taken");
      expect(canUndo(rebooked, entry.id)).toBe(false);
      expect(undoEntry(rebooked, entry.id)).toBe(rebooked);
      expect(applyAction(rebooked, { type: "log/undo", id: entry.id }, meta)).toBe(rebooked);
      if (action.type === "booking/cancel") {
        expect(rebooked.bookings.find((b) => b.id === upcoming.id)?.status).toBe("cancelled");
      }
    },
  );

  it("undoes a cancellation when the original time is still free", () => {
    const cancelled = applyAction(base, { type: "booking/cancel", id: upcoming.id }, meta);
    const [entry] = cancelled.log;
    expect(canUndo(cancelled, entry.id)).toBe(true);
    const undone = applyAction(cancelled, { type: "log/undo", id: entry.id }, meta);
    expect(undone.bookings.find((b) => b.id === upcoming.id)).toMatchObject({ status: "booked", date: upcoming.date, start: upcoming.start });
  });

  it("checks room availability and assigns a free room when undoing a cancellation", () => {
    const [firstRoom, secondRoom] = base.resources;
    const state = { ...base, bookings: [] };
    const date = addDays(today, 1);
    const start = 600;
    const booked = applyAction(state, {
      type: "booking/create", customerId: base.customers[0].id, serviceId: "medical-foot-care", staffId: "anna", date, start, source: "phone",
    }, meta);
    const [booking] = booked.bookings;
    expect(booking.resourceId).toBe(firstRoom.id);
    const cancelled = applyAction(booked, { type: "booking/cancel", id: booking.id }, meta);
    const [entry] = cancelled.log;
    const roomTaken = applyAction(cancelled, {
      type: "booking/create", customerId: base.customers[1].id, serviceId: "classic-60", staffId: "erik", date, start, source: "phone",
    }, meta);
    expect(roomTaken.bookings.at(-1)?.resourceId).toBe(firstRoom.id);

    const oneRoom = { ...roomTaken, resources: [firstRoom] };
    expect(canUndo(oneRoom, entry.id)).toBe(false);
    expect(undoEntry(oneRoom, entry.id)).toBe(oneRoom);
    expect(undoEntry(roomTaken, entry.id).bookings.find((b) => b.id === booking.id)).toMatchObject({
      status: "booked", resourceId: secondRoom.id,
    });
  });

  it("refuses to undo when something changed the same record afterwards", () => {
    const first = applyAction(base, { type: "service/price", id: "classic-60", price: 700 }, meta);
    const second = applyAction(first, { type: "service/price", id: "classic-60", price: 800 }, meta);
    expect(isUndoable(second, second.log[1])).toBe(false);
    expect(applyAction(second, { type: "log/undo", id: first.log[0].id }, meta)).toBe(second);
    const back = applyAction(second, { type: "log/undo", id: second.log[0].id }, meta);
    expect(back.services.find((s) => s.id === "classic-60")?.price).toBe(700);
  });

  it("undoes added and removed records, including their position", () => {
    const added = applyAction(base, { type: "cost/add", kind: "rent", label: "Storage", amount: 500 }, meta);
    expect(added.costs).toHaveLength(base.costs.length + 1);
    const gone = applyAction(added, { type: "log/undo", id: added.log[0].id }, meta);
    expect(gone.costs).toEqual(base.costs);

    const first = base.costs[0];
    const removed = applyAction(base, { type: "cost/remove", id: first.id }, meta);
    expect(removed.costs).not.toContainEqual(first);
    const restored = applyAction(removed, { type: "log/undo", id: removed.log[0].id }, meta);
    expect(restored.costs).toEqual(base.costs);
  });

  it("undoes changes to whole values such as module switches", () => {
    const off = applyAction(base, { type: "module/toggle", key: "stock" }, meta);
    expect(off.log[0].summary).toContain("off");
    const on = applyAction(off, { type: "log/undo", id: off.log[0].id }, meta);
    expect(on.modules.stock).toBe(true);
  });

  it("never copies journal text or message bodies into the log", () => {
    const customer = base.customers[0];
    const text = "Secret observation about the customer's health";
    const next = applyAction(base, { type: "journal/add", entry: { customerId: customer.id, date: today, staffId: "anna", treatment: text, observations: text, advice: text } }, meta);
    expect(JSON.stringify(next.log[0].summary + next.log[0].before + next.log[0].after)).not.toContain("Secret");
    const note = applyAction(base, { type: "customer/note", id: customer.id, note: text }, meta);
    expect(note.log[0].summary + (note.log[0].after ?? "")).not.toContain("Secret");
  });

  it("keeps only the newest entries", () => {
    let state = base;
    for (let i = 0; i < LOG_LIMIT + 5; i++) state = applyAction(state, { type: "service/price", id: "classic-60", price: 100 + i }, meta);
    expect(state.log).toHaveLength(LOG_LIMIT);
    expect(state.log[0].after).toContain(String(100 + LOG_LIMIT + 4));
  });

  it("filters by who and where", () => {
    let state = applyAction(base, { type: "service/price", id: "classic-60", price: 650 }, meta);
    state = applyAction(state, { type: "service/price", id: "classic-60", price: 700 }, { actor: "ai", source: "voice", at: meta.at });
    expect(filterLog(state.log, { actor: "ai" })).toHaveLength(1);
    expect(filterLog(state.log, { source: "button" })).toHaveLength(1);
    expect(filterLog(state.log, {})).toHaveLength(2);
    expect(present(state.log, "actor")).toEqual(["ai", "owner"]);
  });
});
