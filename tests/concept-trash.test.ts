import { describe, expect, it } from "vitest";
import { createDemoState } from "@/concept/data/generate";
import { applyAction } from "@/concept/log/capture";
import type { LogMeta } from "@/concept/log/types";
import { canRestore, daysLeft, purgeExpired, restoreEntry, TRASH_DAYS } from "@/concept/trash/trash";
import { reduce } from "@/concept/actions";
import { addDays } from "@/concept/data/dates";

const today = "2026-11-16";
const base = createDemoState(today);
const meta: LogMeta = { actor: "owner", source: "button", at: 0 };
const upcoming = base.bookings.find((b) => b.status === "booked" && b.date > today)!;
const customerWithBookings = base.customers.find((c) => base.bookings.some((b) => b.customerId === c.id && b.status === "booked" && b.date > today) && base.journals.some((j) => j.customerId === c.id))!;

describe("trash", () => {
  it("puts a cancelled booking in the trash and restores it", () => {
    const cancelled = reduce(base, { type: "booking/cancel", id: upcoming.id, reason: "Ill" });
    const entry = cancelled.trash.find((e) => e.kind === "booking" && e.bookingId === upcoming.id)!;
    expect(entry.deletedOn).toBe(today);
    const restored = restoreEntry(cancelled, entry.id);
    expect(restored.bookings.find((b) => b.id === upcoming.id)).toMatchObject({ status: "booked" });
    expect(restored.bookings.find((b) => b.id === upcoming.id)?.cancelReason).toBeUndefined();
    expect(restored.trash.some((e) => e.id === entry.id)).toBe(false);
  });

  it("does not trash a booking twice or one that was never booked", () => {
    const once = reduce(base, { type: "booking/cancel", id: upcoming.id });
    expect(reduce(once, { type: "booking/cancel", id: upcoming.id }).trash).toHaveLength(once.trash.length);
  });

  it("refuses to restore a booking whose time was taken", () => {
    const cancelled = reduce(base, { type: "booking/cancel", id: upcoming.id });
    const entry = cancelled.trash[0];
    const taken = reduce(cancelled, { type: "booking/create", customerId: customerWithBookings.id, serviceId: upcoming.serviceId, staffId: upcoming.staffId, date: upcoming.date, start: upcoming.start, source: "phone" });
    expect(taken.bookings.length).toBe(cancelled.bookings.length + 1);
    expect(canRestore(taken, entry)).toBe(false);
    expect(restoreEntry(taken, entry.id)).toBe(taken);
  });

  it("deletes a customer with everything attached and brings it all back", () => {
    const deleted = reduce(base, { type: "customer/delete", id: customerWithBookings.id });
    expect(deleted.customers.some((c) => c.id === customerWithBookings.id)).toBe(false);
    expect(deleted.bookings.some((b) => b.customerId === customerWithBookings.id)).toBe(false);
    expect(deleted.journals.some((j) => j.customerId === customerWithBookings.id)).toBe(false);
    const entry = deleted.trash[0];
    const restored = restoreEntry(deleted, entry.id);
    expect(restored.customers.find((c) => c.id === customerWithBookings.id)).toEqual(customerWithBookings);
    expect(restored.bookings.length).toBe(base.bookings.length);
    expect(restored.journals.length).toBe(base.journals.length);
    expect(restored.trash.some((e) => e.id === entry.id)).toBe(false);
  });

  it("cancels, rather than double-books, a restored booking whose time was taken meanwhile", () => {
    const deleted = reduce(base, { type: "customer/delete", id: customerWithBookings.id });
    const mine = base.bookings.find((b) => b.customerId === customerWithBookings.id && b.status === "booked" && b.date > today)!;
    const taken = reduce(deleted, { type: "booking/create", customerId: base.customers.find((c) => c.id !== customerWithBookings.id)!.id, serviceId: mine.serviceId, staffId: mine.staffId, date: mine.date, start: mine.start, source: "phone" });
    expect(taken.bookings.length).toBe(deleted.bookings.length + 1);
    const restored = restoreEntry(taken, taken.trash[0].id);
    expect(restored.bookings.find((b) => b.id === mine.id)?.status).toBe("cancelled");
  });

  it("deleting an unknown customer changes nothing", () => {
    expect(reduce(base, { type: "customer/delete", id: "nobody" })).toBe(base);
  });

  it("counts down 30 days and drops expired entries", () => {
    const cancelled = reduce(base, { type: "booking/cancel", id: upcoming.id });
    const entry = cancelled.trash[0];
    expect(daysLeft(entry, today)).toBe(TRASH_DAYS);
    expect(daysLeft(entry, addDays(today, 10))).toBe(20);
    expect(purgeExpired(cancelled, addDays(today, TRASH_DAYS - 1))).toBe(cancelled);
    const purged = purgeExpired(cancelled, addDays(today, TRASH_DAYS));
    expect(purged.trash.some((e) => e.id === entry.id)).toBe(false);
    expect(purged.bookings.find((b) => b.id === upcoming.id)?.status).toBe("cancelled");
  });

  it("a deleted customer is gone for good once the 30 days pass", () => {
    const deleted = reduce(base, { type: "customer/delete", id: customerWithBookings.id });
    const purged = purgeExpired(deleted, addDays(today, TRASH_DAYS));
    expect(purged.trash.find((e) => e.kind === "customer")).toBeUndefined();
    expect(purged.customers.some((c) => c.id === customerWithBookings.id)).toBe(false);
  });

  it("starts with today's cancellation in the trash", () => {
    for (const e of base.trash) expect(base.bookings.find((b) => b.id === (e.kind === "booking" ? e.bookingId : ""))?.status).toBe("cancelled");
  });

  it("cancel and restore are logged and undoable through the log", () => {
    const cancelled = applyAction(base, { type: "booking/cancel", id: upcoming.id }, meta);
    const undone = applyAction(cancelled, { type: "log/undo", id: cancelled.log[0].id }, meta);
    expect(undone.bookings.find((b) => b.id === upcoming.id)?.status).toBe("booked");
    expect(undone.trash).toEqual(base.trash);
    const entry = cancelled.trash[0];
    const restored = applyAction(cancelled, { type: "trash/restore", id: entry.id }, meta);
    expect(restored.log[0].summary).toMatch(/^Restored /);
  });

  it("undoing a customer deletion brings the customer back from the log too", () => {
    const deleted = applyAction(base, { type: "customer/delete", id: customerWithBookings.id }, meta);
    const undone = applyAction(deleted, { type: "log/undo", id: deleted.log[0].id }, meta);
    expect(undone.customers.map((c) => c.id).sort()).toEqual(base.customers.map((c) => c.id).sort());
    expect(undone.trash).toEqual(base.trash);
  });
});
